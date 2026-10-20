import type { AdminActionKind, SuspendInput } from '@lucko/shared'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { Prisma } from '../generated/prisma/client'
import { MailService } from '../mail/mail.service'
import { PrismaService } from '../prisma/prisma.service'
import { PushService } from '../push/push.service'
import {
  ACTION_TARGET,
  planFormatMerge,
  planProfileMerge,
  suspensionEnd,
  suspensionMail,
  warningMail,
} from './admin.rules'

type Tx = Prisma.TransactionClient
type Action = { action: AdminActionKind; targetId: string; data: Prisma.JsonValue }
type Target = { type: 'user' | 'venue' | 'game'; id: string; label: string }

const UPCOMING_ROOM = ['OPEN', 'FULL', 'CONFIRMED'] as const

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly mail: MailService,
  ) {}

  /**
   * Suspend un joueur : prévenu par e-mail, sessions et appareils supprimés (déconnecté partout, plus
   * de notification), rooms à venir qu'il organise annulées et leurs joueurs prévenus. La connexion
   * est refusée jusqu'à la fin de la suspension (better-auth.ts).
   */
  // ponytail: ses places dans les rooms des autres restent
  async suspend(userId: string, { reason, days }: SuspendInput, tx: Tx) {
    const user = await tx.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { role: true, email: true, pseudo: true },
    })
    if (!user) throw new NotFoundException('Joueur introuvable')
    if (user.role === 'ADMIN') throw new ForbiddenException('Impossible de suspendre un admin')
    const now = new Date()
    const suspension = { suspendedAt: now, suspendedUntil: suspensionEnd(days, now) }
    await tx.user.update({
      where: { id: userId },
      data: { ...suspension, suspendedReason: reason },
    })
    await this.mail.send(
      { to: user.email, ...suspensionMail({ ...user, ...suspension }, reason) },
      tx,
    )
    await tx.session.deleteMany({ where: { userId } })
    await tx.pushToken.deleteMany({ where: { userId } })
    const rooms = await tx.room.findMany({
      where: { hostId: userId, status: { in: [...UPCOMING_ROOM] }, startsAt: { gte: now } },
      select: { id: true, participants: { select: { userId: true, status: true } } },
    })
    await tx.room.updateMany({
      where: { id: { in: rooms.map((r) => r.id) } },
      data: { status: 'CANCELLED' },
    })
    for (const room of rooms) {
      await this.push.notify(
        room.participants
          .filter((p) => p.userId !== userId && p.status !== 'DECLINED' && p.status !== 'LEFT')
          .map((p) => p.userId),
        'ROOMS',
        {
          title: 'Room annulée',
          body: 'Une room où tu étais inscrit·e a été annulée.',
          url: `/rooms/${room.id}`,
        },
        tx,
      )
    }
  }

  async unsuspend(userId: string) {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, suspendedAt: { not: null } },
      data: { suspendedAt: null, suspendedUntil: null, suspendedReason: null },
    })
    if (!count) throw new NotFoundException('Aucune suspension en cours pour ce joueur')
  }

  /** Avertissement de la modération : e-mail et notification qu'on ne peut pas couper. */
  async warn(userId: string, reason: string, tx: Tx) {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, pseudo: true },
    })
    await this.mail.send({ to: user.email, ...warningMail(user.pseudo, reason) }, tx)
    await this.push.notify(
      [userId],
      null,
      { title: 'Avertissement de la modération', body: reason },
      tx,
    )
  }

  /**
   * Fusionne le jeu `sourceId` (doublon) dans `targetId` : formats, profils de jeu (LK), rooms,
   * événements, lieux et joueurs passent au jeu cible, puis le doublon est supprimé. Tout ou rien.
   */
  async mergeGames(sourceId: string, targetId: string) {
    if (sourceId === targetId) throw new BadRequestException('Choisis un autre jeu cible')
    await this.prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all(
        [sourceId, targetId].map((id) =>
          tx.game.findUnique({ where: { id }, include: { formats: true } }),
        ),
      )
      if (!source || !target) throw new NotFoundException('Jeu introuvable')

      const { remap, move } = planFormatMerge(source.formats, target.formats)
      for (const [from, to] of remap) {
        const [fromProfiles, toProfiles] = await Promise.all(
          [from, to].map((formatId) => tx.playerGameProfile.findMany({ where: { formatId } })),
        )
        const profiles = planProfileMerge(fromProfiles ?? [], toProfiles ?? [])
        await tx.playerGameProfile.deleteMany({ where: { id: { in: profiles.remove } } })
        await tx.playerGameProfile.updateMany({
          where: { id: { in: profiles.move } },
          data: { formatId: to },
        })
        await tx.room.updateMany({ where: { formatId: from }, data: { formatId: to } })
      }
      await tx.gameFormat.updateMany({ where: { id: { in: move } }, data: { gameId: targetId } })
      await tx.room.updateMany({ where: { gameId: sourceId }, data: { gameId: targetId } })

      // Relations plusieurs-à-plusieurs : on ajoute le jeu cible là où le doublon était
      const swap = { connect: { id: targetId }, disconnect: { id: sourceId } }
      const linked = { games: { some: { id: sourceId } } }
      for (const { id } of await tx.event.findMany({ where: linked, select: { id: true } }))
        await tx.event.update({ where: { id }, data: { games: swap } })
      for (const { id } of await tx.venue.findMany({ where: linked, select: { id: true } }))
        await tx.venue.update({ where: { id }, data: { games: swap } })
      for (const { id } of await tx.user.findMany({
        where: { playedGames: { some: { id: sourceId } } },
        select: { id: true },
      }))
        await tx.user.update({ where: { id }, data: { playedGames: swap } })

      // Il ne reste au doublon que des formats vidés, supprimés avec lui
      await tx.game.delete({ where: { id: sourceId } })
    })
  }

  /** Fiche que désigne chaque action du journal (joueur, lieu ou jeu gardé), avec son nom. */
  async withTargets<A extends Action>(actions: A[]): Promise<(A & { target: Target | null })[]> {
    const ids = (kind: string) =>
      actions.filter((a) => ACTION_TARGET[a.action] === kind).map((a) => a.targetId)
    const mergedInto = (a: Action) => String((a.data as { intoId?: unknown } | null)?.intoId ?? '')
    const user = (u: { id: string; pseudo: string | null }): Target => ({
      type: 'user',
      id: u.id,
      label: u.pseudo ?? 'Sans pseudo',
    })
    const [reports, users, venues, events, games] = await Promise.all([
      this.prisma.report.findMany({
        where: { id: { in: ids('report') } },
        select: { id: true, target: { select: { id: true, pseudo: true } } },
      }),
      this.prisma.user.findMany({
        where: { id: { in: ids('user') } },
        select: { id: true, pseudo: true },
      }),
      this.prisma.venue.findMany({
        where: { id: { in: ids('venue') } },
        select: { id: true, name: true },
      }),
      this.prisma.event.findMany({
        where: { id: { in: ids('event') } },
        select: { id: true, title: true, venueId: true },
      }),
      this.prisma.game.findMany({
        where: {
          id: {
            in: [
              ...actions.filter((a) => a.action === 'GAME_MERGE').map(mergedInto),
              ...ids('game'),
            ],
          },
        },
        select: { id: true, name: true },
      }),
    ])
    const targets = new Map<string, Target>([
      ...reports.map((r) => [r.id, user(r.target)] as const),
      ...users.map((u) => [u.id, user(u)] as const),
      ...venues.map((v) => [v.id, { type: 'venue', id: v.id, label: v.name }] as const),
      ...events.map((e) => [e.id, { type: 'venue', id: e.venueId, label: e.title }] as const),
      ...games.map((g) => [g.id, { type: 'game', id: g.id, label: g.name }] as const),
    ])
    // Jeu supprimé : son nom reste dans le journal (renvoyé par la suppression)
    for (const a of actions)
      if (a.action === 'GAME_DELETE' && !targets.has(a.targetId))
        targets.set(a.targetId, {
          type: 'game',
          id: a.targetId,
          label: String((a.data as { name?: unknown } | null)?.name ?? 'Jeu supprimé'),
        })
    return actions.map((a) => ({
      ...a,
      target: targets.get(a.action === 'GAME_MERGE' ? mergedInto(a) : a.targetId) ?? null,
    }))
  }
}
