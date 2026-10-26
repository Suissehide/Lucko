import {
  type GameDemand,
  type GeoQuery,
  metersBetween,
  PLAY_INTENT_DAYS,
  type PlayIntents,
  VENUE_TIME_ZONE,
} from '@lucko/shared'
import { BadRequestException, Injectable, type OnModuleInit } from '@nestjs/common'
import { JobsService } from '../jobs/jobs.service'
import { PrismaService } from '../prisma/prisma.service'
import { PushService } from '../push/push.service'
import { shouldNotify, visibleCount } from './play-intents.rules'

const ROOM_OPENED_JOB = 'play-intents-room-opened'
const PURGE_JOB = 'play-intents-purge'
const DAY_MS = 24 * 60 * 60 * 1000

const roomWhen = (date: Date) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: VENUE_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

/**
 * « Je veux jouer à… » (LKO-17) : envies de jeu des joueurs, demande agrégée par jeu, et notification
 * quand une room d'un jeu attendu s'ouvre dans leur rayon.
 */
@Injectable()
export class PlayIntentsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly push: PushService,
  ) {}

  async onModuleInit() {
    await this.jobs.handle<{ roomId: string }>(ROOM_OPENED_JOB, ({ roomId }) =>
      this.notifyRoom(roomId),
    )
    await this.jobs.handle(
      PURGE_JOB,
      async () => {
        await this.prisma.playIntent.deleteMany({ where: { expiresAt: { lt: new Date() } } })
      },
      { cron: '0 4 * * *' },
    )
  }

  async mine(userId: string) {
    const [user, intents] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { playWhen: true } }),
      this.prisma.playIntent.findMany({
        where: { userId, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'asc' },
      }),
    ])
    return {
      gameIds: intents.map((i) => i.gameId),
      when: user.playWhen,
      expiresAt: intents[0]?.expiresAt ?? null,
    }
  }

  /** Remplace mes envies ; celles gardées repartent pour PLAY_INTENT_DAYS. 400 si un jeu n'existe pas. */
  async set(userId: string, { gameIds, when }: PlayIntents) {
    const ids = [...new Set(gameIds)]
    const known = await this.prisma.game.count({ where: { id: { in: ids } } })
    if (known !== ids.length) throw new BadRequestException('Jeu introuvable')
    const expiresAt = new Date(Date.now() + PLAY_INTENT_DAYS * DAY_MS)
    await this.prisma.$transaction([
      this.prisma.playIntent.deleteMany({ where: { userId, gameId: { notIn: ids } } }),
      ...ids.map((gameId) =>
        this.prisma.playIntent.upsert({
          where: { userId_gameId: { userId, gameId } },
          update: { expiresAt },
          create: { userId, gameId, expiresAt },
        }),
      ),
      this.prisma.user.update({ where: { id: userId }, data: { playWhen: when } }),
    ])
    return this.mine(userId)
  }

  /** Joueurs qui attendent chaque jeu dans le rayon autour du point, les plus demandés d'abord. */
  async demand({ lat, lng, radiusKm }: GeoQuery): Promise<GameDemand[]> {
    // ponytail: tri en mémoire de toutes les envies actives, une requête PostGIS quand il y en aura des milliers
    const [games, intents] = await Promise.all([
      this.prisma.game.findMany({
        where: { hidden: false },
        select: { id: true, slug: true, name: true },
      }),
      this.prisma.playIntent.findMany({
        where: {
          expiresAt: { gt: new Date() },
          user: { deletedAt: null, latitude: { not: null }, longitude: { not: null } },
        },
        select: { gameId: true, user: { select: { latitude: true, longitude: true } } },
      }),
    ])
    const counts = new Map<string, number>()
    for (const { gameId, user } of intents) {
      const meters = metersBetween(
        { latitude: lat, longitude: lng },
        { latitude: user.latitude ?? 0, longitude: user.longitude ?? 0 },
      )
      if (meters <= radiusKm * 1000) counts.set(gameId, (counts.get(gameId) ?? 0) + 1)
    }
    return games
      .map((game) => ({ game, count: counts.get(game.id) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.game.name.localeCompare(b.game.name, 'fr'))
      .map(({ game, count }) => ({ game, waitingCount: visibleCount(count) }))
  }

  /** À appeler quand une room s'ouvre : la notification part en tâche de fond, après la création. */
  roomOpened(roomId: string) {
    return this.jobs.send(ROOM_OPENED_JOB, { roomId })
  }

  private async notifyRoom(roomId: string) {
    const now = new Date()
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        game: { select: { name: true } },
        venue: {
          select: { name: true, latitude: true, longitude: true, acceptsUnaccompaniedMinors: true },
        },
      },
    })
    if (room?.status !== 'OPEN') return
    const intents = await this.prisma.playIntent.findMany({
      where: {
        gameId: room.gameId,
        expiresAt: { gt: now },
        user: {
          deletedAt: null,
          blocksGiven: { none: { blockedId: room.hostId } },
          blocksReceived: { none: { blockerId: room.hostId } },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            birthDate: true,
            parentId: true,
            latitude: true,
            longitude: true,
            searchRadiusKm: true,
            playWhen: true,
          },
        },
      },
    })
    const userIds = intents.filter((i) => shouldNotify(i, i.user, room, now)).map((i) => i.userId)
    if (!userIds.length || !room.venue) return
    await this.prisma.playIntent.updateMany({
      where: { gameId: room.gameId, userId: { in: userIds } },
      data: { notifiedAt: now },
    })
    await this.push.notify(userIds, 'GAMES', {
      title: `Une room ${room.game.name} s'ouvre près de toi`,
      body: `${room.venue.name} · ${roomWhen(room.startsAt)}`,
      url: `/rooms/${room.id}`,
    })
  }
}
