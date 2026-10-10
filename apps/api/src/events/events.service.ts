import type { eventDetailSchema } from '@lucko/shared'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { z } from 'zod'
import type { User } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { registrationOutcome, seriesView, withUtm } from './events.rules'

const registered = { registrations: { where: { status: 'REGISTERED' as const } } }

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Fiche événement ; `user` ajoute l'inscription du joueur connecté. Un brouillon ou un événement
   * masqué n'existe que pour le staff du lieu et les admins.
   */
  async detail(id: string, user?: User): Promise<z.output<typeof eventDetailSchema>> {
    const userId = user?.id
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        games: { select: { slug: true, name: true }, orderBy: { name: 'asc' } },
        venue: {
          select: {
            id: true,
            slug: true,
            name: true,
            address: true,
            isPartner: true,
            staff: { where: { userId: userId ?? '' }, select: { userId: true } },
          },
        },
        series: { select: { rrule: true, startDate: true } },
        _count: { select: registered },
        // Sans joueur connecté, aucun id ne correspond : liste vide
        registrations: { where: { userId: userId ?? '' }, select: { status: true } },
      },
    })
    if (!event) throw new NotFoundException('Événement introuvable')
    const hidden = event.status === 'DRAFT' || event.status === 'HIDDEN'
    if (hidden && user?.role !== 'ADMIN' && !event.venue.staff.length)
      throw new NotFoundException('Événement introuvable')
    const {
      _count,
      registrations,
      series,
      venue: { staff: _staff, ...venue },
      ...rest
    } = event
    const mine = registrations[0]?.status
    return {
      ...rest,
      venue,
      externalUrl: withUtm(rest.externalUrl),
      recurrenceLabel: series ? (seriesView(series)?.label ?? null) : null,
      registeredCount: _count.registrations,
      myRegistration: mine && mine !== 'CANCELLED' ? mine : null,
    }
  }

  /** Inscrit le joueur (ou le met en liste d'attente si c'est complet). Sans effet s'il l'est déjà. */
  async register(id: string, user: User) {
    await this.prisma.$transaction(async (tx) => {
      // Verrou sur l'événement : deux inscriptions simultanées ne prennent pas la même dernière place
      await tx.$queryRaw`SELECT 1 FROM "Event" WHERE "id" = ${id} FOR UPDATE`
      const event = await tx.event.findUnique({
        where: { id },
        include: {
          _count: { select: registered },
          registrations: { where: { userId: user.id } },
        },
      })
      if (!event) throw new NotFoundException('Événement introuvable')
      const current = event.registrations[0]?.status
      if (current === 'REGISTERED' || current === 'WAITLISTED') return
      const outcome = registrationOutcome(event, event._count.registrations, user.birthDate)
      if ('refused' in outcome) throw new ConflictException(outcome.refused)
      await tx.eventRegistration.upsert({
        where: { eventId_userId: { eventId: id, userId: user.id } },
        // Réinscription après annulation : retour en fin de file d'attente
        update: { status: outcome.status, createdAt: new Date() },
        create: { eventId: id, userId: user.id, status: outcome.status },
      })
    })
    this.realtime.changed({ type: 'event', id })
    return this.detail(id, user)
  }

  /** Désinscription ; la place libérée revient au premier de la liste d'attente. */
  async cancel(id: string, user: User) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "Event" WHERE "id" = ${id} FOR UPDATE`
      const mine = await tx.eventRegistration.findUnique({
        where: { eventId_userId: { eventId: id, userId: user.id } },
      })
      if (!mine || mine.status === 'CANCELLED') return
      await tx.eventRegistration.update({
        where: { eventId_userId: { eventId: id, userId: user.id } },
        data: { status: 'CANCELLED' },
      })
      if (mine.status !== 'REGISTERED') return
      const next = await tx.eventRegistration.findFirst({
        where: { eventId: id, status: 'WAITLISTED' },
        orderBy: { createdAt: 'asc' },
      })
      // ponytail: le joueur promu n'est pas encore prévenu, notification avec LKO-108
      if (next) {
        await tx.eventRegistration.update({
          where: { eventId_userId: { eventId: id, userId: next.userId } },
          data: { status: 'REGISTERED' },
        })
      }
    })
    await this.realtime.revoke({ type: 'event-chat', id }, [user.id])
    this.realtime.changed({ type: 'event', id })
    return this.detail(id, user)
  }
}
