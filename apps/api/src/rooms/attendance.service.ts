import { type AttendanceEntry, addDays, type attendanceSheetSchema } from '@lucko/shared'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common'
import type { z } from 'zod'
import { businessDate } from '../checkin/qr.rules'
import { formatLabel } from '../explore/explore.service'
import type { Prisma, User, VisitSource } from '../generated/prisma/client'
import { JobsService } from '../jobs/jobs.service'
import { PrismaService } from '../prisma/prisma.service'
import { PushService } from '../push/push.service'
import { attendanceClosed, type Marker, presenceLocked } from './attendance.rules'
import { lifecycleStatus } from './rooms.rules'

type Tx = Prisma.TransactionClient

/** Rappel à l'hôte en fin de partie : pointer les présents (programmé à la création de la room). */
export const ATTENDANCE_REMINDER_JOB = 'rooms.attendance-reminder'

const sheetInclude = {
  game: { select: { name: true } },
  format: { select: { name: true } },
  participants: {
    where: { status: 'ACCEPTED' },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { pseudo: true } } },
  },
} satisfies Prisma.RoomInclude

type Sheet = z.output<typeof attendanceSheetSchema>
type SheetRoom = Prisma.RoomGetPayload<{ include: typeof sheetInclude }>
/** Venues du soir dans le lieu, par joueur (une seule par joueur, lieu et soirée). */
type Visits = Map<string, { source: VisitSource; spentCents: number | null }>

const dbDate = (date: string) => new Date(`${date}T00:00:00Z`)

/**
 * Pointage des présents (LKO-78) : l'hôte ou le staff du lieu, en complément du scan du QR (LKO-77).
 * La présence est gardée sur la place du joueur dans la room ; dans un lieu, elle crée aussi la venue
 * du soir (Visit) qui porte le montant du ticket, visible du lieu seulement.
 */
// ponytail: effets à brancher quand ils existeront : no-show sur la note de confiance (LKO-84), XP (LKO-89),
// venue facturable (LKO-79) ; pas encore de détection des pointages massifs suspects
@Injectable()
export class AttendanceService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly push: PushService,
  ) {}

  async onModuleInit() {
    await this.jobs.handle<{ roomId: string }>(ATTENDANCE_REMINDER_JOB, ({ roomId }) =>
      this.remind(roomId),
    )
  }

  async sheet(roomId: string, user: User): Promise<Sheet> {
    const { room, role } = await this.access(roomId, user)
    return this.toSheet(room, role, await this.visits(room.venueId, [room]))
  }

  async mark(roomId: string, user: User, entries: AttendanceEntry[]) {
    const now = new Date()
    const { room, role } = await this.access(roomId, user)
    const closed = attendanceClosed(room, role, now)
    if (closed) throw new ConflictException(closed)
    if (role === 'HOST' && entries.some((e) => e.ticketCents !== undefined))
      throw new ForbiddenException('Seul le lieu saisit le montant du ticket')
    const visits = await this.visits(room.venueId, [room])
    const date = businessDate(room.startsAt)

    await this.prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const player = room.participants.find((p) => p.userId === entry.userId)
        if (!player) throw new BadRequestException('Ce joueur ne fait pas partie de la room')
        const visit = visits.get(entry.userId)
        const locked = presenceLocked(
          {
            userId: player.userId,
            source: player.presenceSource,
            scanned: visit?.source === 'QR_SCAN',
          },
          role,
          room.hostId,
        )
        if (!locked)
          await tx.roomParticipant.update({
            where: { roomId_userId: { roomId, userId: entry.userId } },
            data: {
              present: entry.present,
              presenceSource: role,
              presenceMarkedById: user.id,
              checkedInAt: now,
            },
          })
        if (!room.venueId) continue
        const key = { userId: entry.userId, venueId: room.venueId, businessDate: dbDate(date) }
        const where = { userId_venueId_businessDate: key }
        const ticket = entry.ticketCents === undefined ? {} : { spentCents: entry.ticketCents }
        if (locked) {
          // Joueur scanné : le lieu peut quand même saisir son ticket
          if (visit && role === 'VENUE') await tx.visit.update({ where, data: ticket })
        } else if (entry.present) {
          await tx.visit.upsert({
            where,
            create: { ...key, source: 'CHECK_IN', ...ticket },
            update: ticket,
          })
        } else if (
          visit?.source === 'CHECK_IN' &&
          !(await this.presentElsewhere(tx, entry.userId, room.venueId, date, roomId))
        ) {
          await tx.visit.delete({ where })
        }
      }
    })
    return this.sheet(roomId, user)
  }

  /** Toutes les rooms d'un lieu pour une soirée (date locale, par défaut celle en cours). */
  async venueSheets(venueId: string, date = businessDate()): Promise<Sheet[]> {
    const rooms = (
      await this.prisma.room.findMany({
        where: {
          venueId,
          status: { not: 'CANCELLED' },
          // La soirée déborde après minuit : on prend large, puis on filtre sur la date de rattachement
          startsAt: { gte: dbDate(addDays(date, -1)), lt: dbDate(addDays(date, 2)) },
        },
        include: sheetInclude,
        orderBy: { startsAt: 'asc' },
      })
    ).filter((room) => businessDate(room.startsAt) === date)
    const visits = await this.visits(venueId, rooms)
    return rooms.map((room) => this.toSheet(room, 'VENUE', visits))
  }

  /** Hôte, ou staff du lieu de la room (le lieu fait foi s'il est les deux) ; admin comme le lieu. */
  private async access(roomId: string, user: User) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: sheetInclude })
    if (!room) throw new NotFoundException('Room introuvable')
    const staff =
      room.venueId &&
      (user.role === 'ADMIN' ||
        (await this.prisma.venueStaff.findUnique({
          where: { userId_venueId: { userId: user.id, venueId: room.venueId } },
        })))
    const role: Marker | null = staff ? 'VENUE' : room.hostId === user.id ? 'HOST' : null
    if (!role) throw new ForbiddenException('Réservé à l’hôte et au lieu de la room')
    return { room, role }
  }

  private async visits(venueId: string | null, rooms: SheetRoom[]): Promise<Visits> {
    if (!venueId || !rooms.length) return new Map()
    const dates = [...new Set(rooms.map((r) => businessDate(r.startsAt)))]
    const rows = await this.prisma.visit.findMany({
      where: {
        venueId,
        businessDate: { in: dates.map(dbDate) },
        userId: { in: rooms.flatMap((r) => r.participants.map((p) => p.userId)) },
      },
      select: { userId: true, source: true, spentCents: true },
    })
    return new Map(rows.map(({ userId, ...visit }) => [userId, visit]))
  }

  /** Pointé présent dans une autre room du même lieu le même soir : sa venue reste due. */
  private async presentElsewhere(
    tx: Tx,
    userId: string,
    venueId: string,
    date: string,
    roomId: string,
  ) {
    const others = await tx.roomParticipant.findMany({
      where: {
        userId,
        present: true,
        roomId: { not: roomId },
        room: {
          venueId,
          startsAt: { gte: dbDate(addDays(date, -1)), lt: dbDate(addDays(date, 2)) },
        },
      },
      select: { room: { select: { startsAt: true } } },
    })
    return others.some((p) => businessDate(p.room.startsAt) === date)
  }

  private toSheet(room: SheetRoom, role: Marker, visits: Visits, now = new Date()): Sheet {
    return {
      roomId: room.id,
      title: [room.game.name, formatLabel(room)].filter(Boolean).join(' · '),
      startsAt: room.startsAt,
      status: lifecycleStatus(room, now),
      role,
      closed: attendanceClosed(room, role, now),
      players: room.participants.map((p) => {
        const visit = visits.get(p.userId)
        const scanned = visit?.source === 'QR_SCAN'
        return {
          userId: p.userId,
          pseudo: p.user.pseudo,
          isHost: p.userId === room.hostId,
          present: scanned ? true : p.present,
          source: scanned ? 'SCAN' : p.presenceSource,
          ticketCents: role === 'VENUE' ? (visit?.spentCents ?? null) : null,
          locked: presenceLocked(
            { userId: p.userId, source: p.presenceSource, scanned },
            role,
            room.hostId,
          ),
        }
      }),
    }
  }

  /** Fin de partie : si personne n'est encore pointé, l'hôte est invité à le faire. */
  private async remind(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: sheetInclude })
    if (!room || room.status === 'CANCELLED' || room.participants.length < 2) return
    if (room.participants.some((p) => p.present !== null)) return
    await this.push.notify([room.hostId], 'ROOMS', {
      title: 'Qui était là ?',
      body: 'Pointe les présents de ta room : ça compte pour leur XP et leur fiabilité.',
      url: `/attendance/${roomId}`,
    })
  }
}
