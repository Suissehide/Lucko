import {
  addDays,
  EVENT_CREATIONS_PER_DAY,
  EVENT_MATERIALIZE_DAYS,
  type eventCreateSchema,
  type eventUpdateSchema,
  localDateTime,
  occurrenceDates,
  type reportSchema,
  toRrule,
  type venueEventSchema,
} from '@lucko/shared'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common'
import type { z } from 'zod'
import { AuthService } from '../auth/auth.service'
import type { Prisma, User } from '../generated/prisma/client'
import { JobsService } from '../jobs/jobs.service'
import { MailService } from '../mail/mail.service'
import { PrismaService } from '../prisma/prisma.service'
import { PushService } from '../push/push.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import {
  durationOf,
  type EventChange,
  eventChangeMessages,
  fromLocalDate,
  isEditable,
  minuteOf,
  occurrenceTimes,
  seriesView,
  timesChanged,
  toLocalDate,
} from './events.rules'

const MATERIALIZE_JOB = 'events-materialize'
const DAY_MS = 24 * 60 * 60 * 1000
const LIVE = { in: ['DRAFT', 'PUBLISHED'] } satisfies Prisma.EnumEventStatusFilter
const WAITING = { in: ['REGISTERED', 'WAITLISTED'] } satisfies Prisma.EnumRegistrationStatusFilter

type CreateInput = z.output<typeof eventCreateSchema>
type UpdateInput = z.output<typeof eventUpdateSchema>
/** Champs d'une occurrence ou d'une série, hors dates. */
type Fields = Omit<CreateInput, 'date' | 'recurrence' | 'untilDate'>

type Columns = Pick<
  Fields,
  | 'type'
  | 'title'
  | 'description'
  | 'capacity'
  | 'priceCents'
  | 'minAge'
  | 'registrationMode'
  | 'externalUrl'
>

/** Colonnes communes à Event et EventSeries ; le lien externe ne sert qu'en inscription externe. */
const columns = (f: Columns) => ({
  type: f.type,
  title: f.title,
  description: f.description,
  capacity: f.capacity,
  priceCents: f.priceCents,
  minAge: f.minAge,
  registrationMode: f.registrationMode,
  externalUrl: f.registrationMode === 'EXTERNAL' ? f.externalUrl : null,
})

const gameRefs = (ids: string[]) => ids.map((id) => ({ id }))

const venueEventInclude = {
  games: { select: { id: true } },
  series: { select: { id: true, rrule: true, startDate: true, untilDate: true } },
  registrations: { where: { status: WAITING }, select: { status: true } },
} satisfies Prisma.EventInclude

function toVenueEvent({
  games,
  series,
  registrations,
  occurrenceDate: _date,
  venueId: _venue,
  seriesId: _series,
  createdById: _author,
  createdAt: _created,
  updatedAt: _updated,
  ...event
}: Prisma.EventGetPayload<{ include: typeof venueEventInclude }>): z.output<
  typeof venueEventSchema
> {
  const view = series && seriesView(series)
  return {
    ...event,
    gameIds: games.map((g) => g.id),
    registered: registrations.filter((r) => r.status === 'REGISTERED').length,
    waitlisted: registrations.filter((r) => r.status === 'WAITLISTED').length,
    series:
      series && view
        ? {
            id: series.id,
            ...view,
            untilDate: series.untilDate ? toLocalDate(series.untilDate) : null,
          }
        : null,
  }
}

/** Date locale jusqu'à laquelle les occurrences d'une série existent (exclue). */
const horizon = (now = new Date()) => addDays(localDateTime(now).date, EVENT_MATERIALIZE_DAYS)

/**
 * Publication d'événements par les lieux (LKO-61), partenaires ou non : ponctuels ou en série
 * (RRULE), brouillons, modification d'une date ou de la série, annulation, masquage et signalement.
 * Le back-office admin passe aussi par ici pour créer et annuler.
 */
@Injectable()
export class VenueEventsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly jobs: JobsService,
    private readonly push: PushService,
    private readonly mail: MailService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async onModuleInit() {
    // Chaque nuit, les séries avancent pour garder 3 mois d'occurrences devant elles
    await this.jobs.handle(MATERIALIZE_JOB, () => this.materializeAll(), { cron: '0 4 * * *' })
  }

  /** Événements du lieu, brouillons et annulés compris : à venir (date croissante) ou passés. */
  async list(venueId: string, when: 'upcoming' | 'past') {
    const now = new Date()
    const events = await this.prisma.event.findMany({
      where: { venueId, startsAt: when === 'upcoming' ? { gte: now } : { lt: now } },
      orderBy: { startsAt: when === 'upcoming' ? 'asc' : 'desc' },
      take: when === 'upcoming' ? 300 : 100,
      include: venueEventInclude,
    })
    return events.map(toVenueEvent)
  }

  async view(ids: string[]) {
    const events = await this.prisma.event.findMany({
      where: { id: { in: ids } },
      orderBy: { startsAt: 'asc' },
      include: venueEventInclude,
    })
    return events.map(toVenueEvent)
  }

  /**
   * Crée un événement ponctuel, ou une série et ses occurrences des 3 prochains mois.
   * Renvoie les ids des occurrences créées. `limit: false` : back-office admin (démarrage à froid).
   */
  async create(venueId: string, input: CreateInput, author: User, { limit = true } = {}) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true },
    })
    if (!venue) throw new NotFoundException('Lieu introuvable')
    if (limit) await this.assertCreationLimit(venueId)
    await this.gamesOr400(input.gameIds)
    const { date, recurrence, untilDate, ...fields } = input
    const startMinute = minuteOf(fields.startTime)
    const durationMinutes = durationOf(fields.startTime, fields.endTime)

    if (!recurrence) {
      const event = await this.prisma.event.create({
        data: {
          ...columns(fields),
          ...occurrenceTimes(date, startMinute, durationMinutes),
          status: fields.status,
          venueId,
          createdById: author.id,
          games: { connect: gameRefs(fields.gameIds) },
        },
        select: { id: true },
      })
      return [event.id]
    }

    const series = await this.prisma.eventSeries.create({
      data: {
        ...columns(fields),
        venueId,
        createdById: author.id,
        rrule: toRrule(recurrence, date),
        startDate: fromLocalDate(date),
        untilDate: untilDate ? fromLocalDate(untilDate) : null,
        startMinute,
        durationMinutes,
        status: fields.status,
        materializedUntil: fromLocalDate(date),
        games: { connect: gameRefs(fields.gameIds) },
      },
    })
    await this.materialize(series.id)
    const occurrences = await this.prisma.event.findMany({
      where: { seriesId: series.id },
      orderBy: { startsAt: 'asc' },
      select: { id: true },
    })
    return occurrences.map((o) => o.id)
  }

  /**
   * Crée les occurrences manquantes de la série jusqu'à l'horizon (3 mois). Une date qui existe déjà,
   * même annulée ou déplacée, n'est jamais recréée (`occurrenceDate` unique par série).
   */
  async materialize(seriesId: string, now = new Date()) {
    await this.prisma.$transaction(async (tx) => {
      // Verrou sur la série : le job de nuit et une modification ne créent pas deux fois la même date
      await tx.$queryRaw`SELECT 1 FROM "EventSeries" WHERE "id" = ${seriesId} FOR UPDATE`
      const series = await tx.eventSeries.findUnique({
        where: { id: seriesId },
        include: { games: { select: { id: true } } },
      })
      if (!series || (series.status !== 'DRAFT' && series.status !== 'PUBLISHED')) return
      const to = horizon(now)
      const from = toLocalDate(series.materializedUntil)
      if (from >= to) return
      const dates = occurrenceDates(series.rrule, toLocalDate(series.startDate), {
        from,
        to,
        until: series.untilDate ? toLocalDate(series.untilDate) : null,
      })
      const existing = await tx.event.findMany({
        where: { seriesId, occurrenceDate: { in: dates.map(fromLocalDate) } },
        select: { occurrenceDate: true },
      })
      const taken = new Set(existing.map((e) => e.occurrenceDate && toLocalDate(e.occurrenceDate)))
      for (const date of dates) {
        const times = occurrenceTimes(date, series.startMinute, series.durationMinutes)
        if (taken.has(date) || times.startsAt <= now) continue
        await tx.event.create({
          data: {
            ...columns(series),
            ...times,
            status: series.status,
            venueId: series.venueId,
            seriesId,
            occurrenceDate: fromLocalDate(date),
            createdById: series.createdById,
            games: { connect: series.games },
          },
        })
      }
      await tx.eventSeries.update({
        where: { id: seriesId },
        data: { materializedUntil: fromLocalDate(to) },
      })
    })
  }

  /** Job de nuit : avance toutes les séries actives. */
  async materializeAll(now = new Date()) {
    const series = await this.prisma.eventSeries.findMany({
      where: { status: LIVE, materializedUntil: { lt: fromLocalDate(horizon(now)) } },
      select: { id: true },
    })
    for (const { id } of series) await this.materialize(id, now)
  }

  /** Événement que `user` peut gérer : gérant du lieu, ou admin. */
  async manageable(eventId: string, user: User) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { venue: { select: { name: true } } },
    })
    if (!event) throw new NotFoundException('Événement introuvable')
    if (user.role !== 'ADMIN' && (await this.auth.venueRole(user.id, event.venueId)) !== 'MANAGER')
      throw new ForbiddenException('Réservé au gérant du lieu')
    return event
  }

  /** Modifie cette date seulement (elle sort de la série), ou la série et ses dates à venir. */
  async update(eventId: string, input: UpdateInput, user: User) {
    const event = await this.manageable(eventId, user)
    if (!isEditable(event)) throw new ConflictException('Date passée, annulée ou masquée')
    await this.gamesOr400(input.gameIds)
    const startMinute = minuteOf(input.startTime)
    const durationMinutes = durationOf(input.startTime, input.endTime)

    if (input.scope === 'occurrence') {
      const times = occurrenceTimes(input.date, startMinute, durationMinutes)
      await this.prisma.$transaction(async (tx) => {
        if (input.status === 'DRAFT' && event.status === 'PUBLISHED')
          await this.assertNoRegistrations(tx, { id: eventId })
        await tx.event.update({
          where: { id: eventId },
          data: {
            ...columns(input),
            ...times,
            status: input.status,
            overridden: event.seriesId !== null,
            games: { set: gameRefs(input.gameIds) },
          },
        })
        if (event.status === 'PUBLISHED' && timesChanged(event, times))
          await this.notify(tx, [eventId], 'moved')
      })
      this.realtime.changed({ type: 'event', id: eventId })
      return [eventId]
    }

    const seriesId = event.seriesId
    if (!seriesId) throw new BadRequestException('Cet événement ne fait pas partie d’une série')
    const series = await this.prisma.eventSeries.findUniqueOrThrow({ where: { id: seriesId } })
    if (input.untilDate && input.untilDate < toLocalDate(series.startDate))
      throw new BadRequestException('La date de fin est avant la première date de la série')
    const now = new Date()
    const upcoming = {
      seriesId,
      overridden: false,
      status: LIVE,
      startsAt: { gt: now },
    } satisfies Prisma.EventWhereInput
    const moved: string[] = []
    await this.prisma.$transaction(async (tx) => {
      if (input.status === 'DRAFT' && series.status === 'PUBLISHED')
        await this.assertNoRegistrations(tx, upcoming)
      await tx.eventSeries.update({
        where: { id: seriesId },
        data: {
          ...columns(input),
          startMinute,
          durationMinutes,
          untilDate: input.untilDate ? fromLocalDate(input.untilDate) : null,
          status: input.status,
          games: { set: gameRefs(input.gameIds) },
          // Repartir d'aujourd'hui : une date de fin repoussée crée les dates manquantes
          materializedUntil: fromLocalDate(localDateTime(now).date),
        },
      })
      const occurrences = await tx.event.findMany({ where: upcoming })
      const beyond: string[] = []
      for (const occurrence of occurrences) {
        const date = occurrence.occurrenceDate && toLocalDate(occurrence.occurrenceDate)
        if (!date) continue
        if (input.untilDate && date > input.untilDate) {
          beyond.push(occurrence.id)
          continue
        }
        const times = occurrenceTimes(date, startMinute, durationMinutes)
        await tx.event.update({
          where: { id: occurrence.id },
          data: {
            ...columns(input),
            ...times,
            status: input.status,
            games: { set: gameRefs(input.gameIds) },
          },
        })
        if (occurrence.status === 'PUBLISHED' && timesChanged(occurrence, times))
          moved.push(occurrence.id)
      }
      await this.notify(tx, moved, 'moved')
      // Date de fin avancée : les dates d'après sont annulées
      await this.stopEvents(tx, beyond, 'CANCELLED')
    })
    await this.materialize(seriesId)
    for (const id of moved) this.realtime.changed({ type: 'event', id })
    return [eventId]
  }

  /**
   * Annule (ou masque, admin) cette date, ou avec `series` celle-ci et toutes les suivantes :
   * la série s'arrête la veille. Inscrits et liste d'attente sont prévenus.
   */
  async stop(eventId: string, user: User, series: boolean, status: 'CANCELLED' | 'HIDDEN') {
    const event = await this.manageable(eventId, user)
    if (status === 'CANCELLED' && !isEditable(event))
      throw new ConflictException('Date passée, déjà annulée ou masquée')
    const ids = await this.prisma.$transaction(async (tx) => {
      let ids = [eventId]
      if (series && event.seriesId) {
        const parent = await tx.eventSeries.findUniqueOrThrow({ where: { id: event.seriesId } })
        const day = event.occurrenceDate ?? fromLocalDate(localDateTime(event.startsAt).date)
        const first = day.getTime() <= parent.startDate.getTime()
        await tx.eventSeries.update({
          where: { id: parent.id },
          data: first
            ? { status }
            : {
                untilDate: new Date(
                  Math.min(day.getTime() - DAY_MS, parent.untilDate?.getTime() ?? Infinity),
                ),
              },
        })
        const following = await tx.event.findMany({
          where: {
            seriesId: event.seriesId,
            startsAt: { gte: event.startsAt },
            status: status === 'HIDDEN' ? { not: 'HIDDEN' } : LIVE,
          },
          select: { id: true },
        })
        ids = following.map((e) => e.id)
      }
      await this.stopEvents(tx, ids, status)
      return ids
    })
    for (const id of ids) this.realtime.changed({ type: 'event', id })
  }

  /**
   * Signalement d'un événement par un joueur : rejoint la file des admins, avec pour cible son auteur
   * (ou à défaut le gérant du lieu). Un même joueur ne signale qu'une fois tant que ce n'est pas traité.
   */
  async report(eventId: string, reporter: User, input: z.output<typeof reportSchema>) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        status: true,
        createdById: true,
        series: { select: { createdById: true } },
        venue: { select: { staff: { where: { role: 'MANAGER' }, select: { userId: true } } } },
      },
    })
    if (!event || event.status === 'DRAFT' || event.status === 'HIDDEN')
      throw new NotFoundException('Événement introuvable')
    const targetId =
      event.createdById ?? event.series?.createdById ?? event.venue.staff[0]?.userId ?? null
    if (!targetId)
      throw new ConflictException('Signalement impossible : écris-nous à contact@lucko.fr')
    if (targetId === reporter.id)
      throw new BadRequestException('Tu ne peux pas signaler ton événement')
    const pending = await this.prisma.report.findFirst({
      where: { eventId, reporterId: reporter.id, resolvedAt: null },
      select: { id: true },
    })
    if (pending) return
    await this.prisma.report.create({
      data: { reporterId: reporter.id, targetId, eventId, ...input },
    })
  }

  /** Passe des dates à annulé ou masqué et prévient leurs inscrits (si elles étaient publiées). */
  private async stopEvents(
    tx: Prisma.TransactionClient,
    ids: string[],
    status: 'CANCELLED' | 'HIDDEN',
  ) {
    if (!ids.length) return
    const published = await tx.event.findMany({
      where: { id: { in: ids }, status: 'PUBLISHED', startsAt: { gt: new Date() } },
      select: { id: true },
    })
    await tx.event.updateMany({ where: { id: { in: ids } }, data: { status } })
    await this.notify(
      tx,
      published.map((e) => e.id),
      'cancelled',
    )
  }

  /** Push et e-mail aux inscrits et à la liste d'attente, envoyés si la transaction réussit. */
  private async notify(tx: Prisma.TransactionClient, ids: string[], change: EventChange) {
    if (!ids.length) return
    const events = await tx.event.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        startsAt: true,
        venue: { select: { name: true } },
        registrations: {
          where: { status: WAITING, user: { deletedAt: null } },
          select: { user: { select: { id: true, email: true, pseudo: true } } },
        },
      },
    })
    for (const event of events) {
      const users = event.registrations.map((r) => r.user)
      if (!users.length) continue
      const messages = eventChangeMessages(change, { ...event, venueName: event.venue.name })
      await this.push.notify(
        users.map((u) => u.id),
        'VENUES',
        messages.push,
        tx,
      )
      for (const user of users)
        await this.mail.send({ to: user.email, ...messages.mail(user.pseudo) }, tx)
    }
  }

  private async assertNoRegistrations(tx: Prisma.TransactionClient, where: Prisma.EventWhereInput) {
    const count = await tx.eventRegistration.count({
      where: { status: WAITING, event: where },
    })
    if (count)
      throw new ConflictException(
        'Des joueurs sont inscrits : annule la date plutôt que de la dépublier',
      )
  }

  /** Limite anti-abus : EVENT_CREATIONS_PER_DAY créations (une série compte pour une) par lieu et par 24 h. */
  private async assertCreationLimit(venueId: string) {
    const since = new Date(Date.now() - DAY_MS)
    const [single, series] = await Promise.all([
      this.prisma.event.count({ where: { venueId, seriesId: null, createdAt: { gte: since } } }),
      this.prisma.eventSeries.count({ where: { venueId, createdAt: { gte: since } } }),
    ])
    if (single + series >= EVENT_CREATIONS_PER_DAY)
      throw new HttpException(
        `${EVENT_CREATIONS_PER_DAY} événements créés en 24 h : réessaie demain`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
  }

  private async gamesOr400(ids: string[]) {
    const count = await this.prisma.game.count({ where: { id: { in: ids } } })
    if (count !== new Set(ids).size) throw new BadRequestException('Jeu introuvable')
  }
}
