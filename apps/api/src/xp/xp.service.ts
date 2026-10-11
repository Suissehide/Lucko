import { presenceXp, type XpBonus, xpLevel } from '@lucko/shared'
import { Injectable } from '@nestjs/common'
import { businessDate } from '../checkin/qr.rules'
import { formatLabel } from '../explore/explore.service'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { quietUntil } from '../push/push.rules'
import { PushService } from '../push/push.service'
import { xpChange } from './xp.rules'

type Tx = Prisma.TransactionClient

const dbDate = (date: string) => new Date(`${date}T00:00:00Z`)

/**
 * XP de participation (LKO-89, archi §14) : gagnée sur une présence vérifiée dans une room, scan du QR
 * au comptoir ou pointage « Là », une seule fois par joueur et par room, retirée si la présence est
 * corrigée. Même barème quel que soit le jeu ou le mode ; gagner la partie ne rapporte rien de plus.
 */
@Injectable()
export class XpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /** Recalcule le gain d'un joueur pour une room, après un scan ou un pointage. */
  async syncRoom(tx: Tx, roomId: string, userId: string) {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: {
        startsAt: true,
        status: true,
        venueId: true,
        venue: { select: { isPartner: true } },
        participants: { where: { status: 'ACCEPTED' }, select: { userId: true, present: true } },
      },
    })
    if (!room) return
    const date = businessDate(room.startsAt)
    const visit = room.venueId
      ? await tx.visit.findUnique({
          where: {
            userId_venueId_businessDate: {
              userId,
              venueId: room.venueId,
              businessDate: dbDate(date),
            },
          },
          select: { source: true },
        })
      : null
    const me = room.participants.find((p) => p.userId === userId)
    const where = { userId_roomId: { userId, roomId } }
    const [existing, awardedTonight] = await Promise.all([
      tx.xpEvent.findUnique({ where }),
      tx.xpEvent.count({ where: { userId, businessDate: dbDate(date) } }),
    ])
    const change = xpChange({
      present: me?.present ?? null,
      scanned: me !== undefined && visit?.source === 'QR_SCAN',
      cancelled: room.status === 'CANCELLED',
      players: room.participants.length,
      awarded: existing !== null,
      awardedTonight,
    })
    if (change === 'keep') return
    if (change === 'revoke' && existing) {
      await tx.xpEvent.delete({ where })
      await tx.user.update({ where: { id: userId }, data: { xp: { decrement: existing.amount } } })
      return
    }

    const { amount, bonuses } = presenceXp({
      partnerVisit: room.venue?.isPartner === true && visit !== null,
    })
    // ON CONFLICT DO NOTHING : un scan et un pointage simultanés ne comptent qu'une fois
    const { count } = await tx.xpEvent.createMany({
      data: [{ userId, roomId, amount, bonuses, businessDate: dbDate(date) }],
      skipDuplicates: true,
    })
    if (!count) return
    const user = await tx.user.update({
      where: { id: userId },
      data: { xp: { increment: amount } },
      select: { id: true, xp: true, birthDate: true, parentId: true },
    })
    const level = xpLevel(user.xp)
    // Mineurs : pas de notification de gamification le soir (21 h - 8 h), on ne la décale pas
    if (level.level > xpLevel(user.xp - amount).level && !quietUntil(user))
      await this.push.notify(
        [userId],
        'ROOMS',
        {
          title: `Niveau ${level.level} : ${level.name}`,
          body: 'Merci de venir jouer !',
          url: '/xp',
        },
        tx,
      )
  }

  /** Rooms du soir dans ce lieu où le joueur est inscrit : son scan au comptoir les valide. */
  async scanned(userId: string, venueId: string, date: string) {
    const rooms = await this.prisma.roomParticipant.findMany({
      where: {
        userId,
        status: 'ACCEPTED',
        room: {
          venueId,
          startsAt: { gte: dbDate(date), lt: new Date(dbDate(date).getTime() + 2 * 86_400_000) },
        },
      },
      select: { roomId: true, room: { select: { startsAt: true } } },
    })
    for (const { roomId, room } of rooms)
      if (businessDate(room.startsAt) === date)
        await this.prisma.$transaction((tx) => this.syncRoom(tx, roomId, userId))
  }

  async mine(user: { id: string; xp: number }) {
    const events = await this.prisma.xpEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        room: {
          select: {
            game: { select: { name: true } },
            format: { select: { name: true } },
            boardGameCategory: true,
          },
        },
      },
    })
    return {
      xp: user.xp,
      ...xpLevel(user.xp),
      recent: events.map((e) => ({
        id: e.id,
        amount: e.amount,
        bonuses: e.bonuses as XpBonus[],
        label: [e.room.game.name, formatLabel(e.room)].filter(Boolean).join(' · '),
        createdAt: e.createdAt,
      })),
    }
  }
}
