import { randomUUID } from 'node:crypto'
import {
  type AgendaPeriod,
  type agendaItemSchema,
  ageOn,
  DIGITAL_MAJORITY_AGE,
  HOME_SAFETY_VERSION,
  type meSchema,
  type myGamesSchema,
  RATING_PROVISIONAL_GAMES,
  type updateProfileSchema,
} from '@lucko/shared'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common'
import type { z } from 'zod'
import { needsParentalConsent } from '../common/minors.rules'
import { loadEnv } from '../config/env'
import { withdrawnChildMail } from '../consent/consent.rules'
import { Prisma, type User } from '../generated/prisma/client'
import { MailService } from '../mail/mail.service'
import { PrismaService } from '../prisma/prisma.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { StorageService } from '../storage/storage.service'
import { eventStatus, roomStatus, STILL_UPCOMING_MS } from './agenda.rules'
import { avatarVerdict, type ImageScores, imageType, SIGHTENGINE_MODELS } from './avatar.rules'
import { myGamesRefusal, profileData } from './my-games.rules'

type AgendaItem = z.output<typeof agendaItemSchema>

// ponytail: historique limité aux 50 dernières parties, paginer quand un joueur en aura plus
const PAST_LIMIT = 50

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)
  private readonly env = loadEnv()

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async profile(user: User): Promise<z.output<typeof meSchema>> {
    const [profiles, staffOf, childCount] = await Promise.all([
      this.prisma.playerGameProfile.findMany({
        where: { userId: user.id },
        orderBy: [{ rankedGames: 'desc' }, { rating: 'desc' }],
        include: { format: { include: { game: true } } },
      }),
      this.prisma.venueStaff.findMany({
        where: { userId: user.id },
        orderBy: { venue: { name: 'asc' } },
        select: {
          role: true,
          venue: { select: { id: true, slug: true, name: true, isPartner: true } },
        },
      }),
      this.prisma.user.count({ where: { parentId: user.id, deletedAt: null } }),
    ])
    const main = profiles[0]
    return {
      ...user,
      hasBirthDate: user.birthDate !== null,
      parentalConsentPending: needsParentalConsent(user),
      childCount,
      homeSafetyAccepted: (user.homeSafetyVersion ?? 0) >= HOME_SAFETY_VERSION,
      mainRating: main
        ? { game: main.format.game.name, format: main.format.name, rating: main.rating }
        : null,
      rankings: profiles.map((p) => ({
        game: { slug: p.format.game.slug, name: p.format.game.name },
        format: p.format.name,
        rating: p.rankedGames < RATING_PROVISIONAL_GAMES ? null : p.rating,
        rankedGames: p.rankedGames,
        reliabilityPct: p.reliabilityPct,
      })),
      venues: staffOf.map(({ role, venue }) => ({ ...venue, role })),
    }
  }

  async update(user: User, body: z.output<typeof updateProfileSchema>) {
    const data: Prisma.UserUpdateInput = { ...body }
    // Ville saisie à la main sans position : l'ancienne position ne correspond plus
    if (body.city !== undefined && body.latitude === undefined) {
      data.latitude = null
      data.longitude = null
    }
    if (body.pseudo) {
      const taken = await this.prisma.user.findFirst({
        where: { pseudo: { equals: body.pseudo, mode: 'insensitive' }, NOT: { id: user.id } },
        select: { id: true },
      })
      if (taken) throw new ConflictException('Ce pseudo est déjà pris')
    }
    try {
      return await this.prisma.user.update({ where: { id: user.id }, data })
    } catch (error) {
      // Pseudo pris entre la vérification et l'écriture
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Ce pseudo est déjà pris')
      throw error
    }
  }

  /**
   * Nouvelle photo de profil, analysée avant d'être enregistrée : refusée d'office (422, l'ancienne
   * reste), validée tout de suite ou mise en attente d'un admin au moindre doute.
   */
  async setAvatar(user: User, file: Buffer) {
    const type = imageType(file)
    if (!type) throw new BadRequestException('Photo en JPEG, PNG ou WebP uniquement')
    const status = avatarVerdict(await this.scan(file, type.mime))
    if (status === 'REJECTED')
      throw new UnprocessableEntityException(
        'Cette photo ne respecte pas la charte de la communauté',
      )
    const avatarUrl = await this.storage.put(
      `avatars/${user.id}/${randomUUID()}.${type.ext}`,
      file,
      type.mime,
    )
    const saved = await this.prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl, avatarStatus: status },
    })
    await this.storage.remove(user.avatarUrl)
    return saved
  }

  /** Scores Sightengine ; null sans clé ou si le service ne répond pas (la photo attend alors un admin). */
  private async scan(file: Buffer, mime: string): Promise<ImageScores | null> {
    const { SIGHTENGINE_API_USER: apiUser, SIGHTENGINE_API_SECRET: apiSecret } = this.env
    if (!apiUser || !apiSecret) return null
    const form = new FormData()
    form.append('media', new Blob([new Uint8Array(file)], { type: mime }), 'avatar')
    form.append('models', SIGHTENGINE_MODELS)
    form.append('api_user', apiUser)
    form.append('api_secret', apiSecret)
    try {
      const response = await fetch('https://api.sightengine.com/1.0/check.json', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(10_000),
      })
      const result = (await response.json()) as ImageScores & { status: string; error?: unknown }
      if (result.status === 'success') return result
      this.logger.warn(`Analyse Sightengine en échec : ${JSON.stringify(result.error)}`)
    } catch (error) {
      this.logger.warn(`Sightengine injoignable : ${error}`)
    }
    return null
  }

  /** Mes parties : événements où le joueur est inscrit et rooms qu'il a rejointes ou demandées. */
  async agenda(userId: string, period: AgendaPeriod): Promise<AgendaItem[]> {
    const past = period === 'past'
    const cutoff = new Date(Date.now() - STILL_UPCOMING_MS)
    const startsAt = past ? { lt: cutoff } : { gte: cutoff }

    const [registrations, participations] = await Promise.all([
      this.prisma.eventRegistration.findMany({
        where: {
          userId,
          status: past ? 'REGISTERED' : { in: ['REGISTERED', 'WAITLISTED'] },
          event: { startsAt, status: 'PUBLISHED' },
        },
        include: {
          event: {
            include: {
              venue: { select: { name: true } },
              games: { select: { slug: true, name: true }, orderBy: { name: 'asc' } },
              _count: { select: { registrations: { where: { status: 'REGISTERED' } } } },
            },
          },
        },
        orderBy: { event: { startsAt: past ? 'desc' : 'asc' } },
        take: past ? PAST_LIMIT : undefined,
      }),
      this.prisma.roomParticipant.findMany({
        where: {
          userId,
          status: past ? 'ACCEPTED' : { in: ['PENDING', 'ACCEPTED', 'WAITLISTED'] },
          room: { startsAt, status: { not: 'CANCELLED' } },
        },
        include: {
          room: {
            include: {
              venue: { select: { name: true } },
              game: { select: { slug: true, name: true } },
              format: { select: { name: true } },
              _count: { select: { participants: { where: { status: 'ACCEPTED' } } } },
            },
          },
        },
        orderBy: { room: { startsAt: past ? 'desc' : 'asc' } },
        take: past ? PAST_LIMIT : undefined,
      }),
    ])

    const items: AgendaItem[] = [
      ...registrations.map(({ status, event }) => ({
        id: event.id,
        kind: 'EVENT' as const,
        eventType: event.type,
        roomMode: null,
        title: event.title,
        // Plusieurs jeux : le premier suffit pour le libellé et le filtre
        game: event.games[0] ?? null,
        place: event.venue.name,
        startsAt: event.startsAt,
        playerCount: event._count.registrations,
        capacity: event.capacity,
        status: past ? ('PLAYED' as const) : eventStatus(status),
      })),
      ...participations.map(({ status, room }) => ({
        id: room.id,
        kind: 'ROOM' as const,
        eventType: null,
        roomMode: room.mode,
        title: `${room.format?.name ?? room.game.name} à ${room.capacity}`,
        game: room.game,
        place: room.venue?.name ?? room.homeAreaLabel,
        startsAt: room.startsAt,
        playerCount: room._count.participants,
        capacity: room.capacity,
        status: past
          ? ('PLAYED' as const)
          : roomStatus(status, room._count.participants, room.capacity),
      })),
    ]
    const sorted = items.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    return past ? sorted.reverse().slice(0, PAST_LIMIT) : sorted
  }

  /** Mes jeux (A6, F3) : jeux joués et niveau déclaré par format TCG. */
  async myGames(userId: string): Promise<z.output<typeof myGamesSchema>> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        playedGames: { select: { id: true } },
        gameProfiles: { select: { formatId: true, declaredLevel: true } },
      },
    })
    return { gameIds: user.playedGames.map((g) => g.id), formats: user.gameProfiles }
  }

  /**
   * Remplace mes jeux. Un nouveau format part des LK de son niveau déclaré ; un format retiré
   * n'est effacé que s'il n'a pas de partie classée (ses LK sont gardés sinon).
   */
  async setMyGames(userId: string, input: z.output<typeof myGamesSchema>) {
    const catalog = await this.prisma.game.findMany({
      include: { formats: { select: { id: true } } },
    })
    const refusal = myGamesRefusal(
      input,
      catalog.map((g) => ({ ...g, formatIds: g.formats.map((f) => f.id) })),
    )
    if (refusal) throw new BadRequestException(refusal)

    const formatIds = input.formats.map((f) => f.formatId)
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { playedGames: { set: [...new Set(input.gameIds)].map((id) => ({ id })) } },
      })
      await tx.playerGameProfile.deleteMany({
        where: { userId, formatId: { notIn: formatIds }, rankedGames: 0 },
      })
      const existing = await tx.playerGameProfile.findMany({ where: { userId } })
      for (const { formatId, declaredLevel } of input.formats) {
        const current = existing.find((p) => p.formatId === formatId) ?? null
        const data = profileData(current, declaredLevel)
        await tx.playerGameProfile.upsert({
          where: { userId_formatId: { userId, formatId } },
          update: data,
          create: { userId, formatId, ...data },
        })
      }
    })
    return this.myGames(userId)
  }

  /**
   * Suppression du compte (exigence Apple, RGPD, retrait de l'accord parental) : le joueur est
   * anonymisé et ne peut plus se connecter (`deletedAt`). La ligne reste pour les venues facturées aux
   * lieux et l'historique des parties, mais plus rien ne l'identifie ; ses places à venir sont libérées.
   */
  async deleteAccount(user: User) {
    const now = new Date()
    const upcoming = { startsAt: { gte: now } }
    // Parent : supprimer son compte retire son accord (LKO-148). Un enfant de moins de 15 ans perd le sien,
    // comme après « Retirer mon accord » ; un plus grand ne dépend plus de lui et reste, simplement détaché.
    const children = await this.prisma.user.findMany({
      where: { parentId: user.id, deletedAt: null },
    })
    for (const child of children.filter(
      (c) => c.birthDate && ageOn(c.birthDate, now) < DIGITAL_MAJORITY_AGE,
    )) {
      await this.deleteAccount(child)
      await this.prisma.parentalConsent.updateMany({
        where: { childId: child.id, status: 'GRANTED' },
        data: { status: 'WITHDRAWN', withdrawnAt: now },
      })
      await this.mail.send({ to: child.email, ...withdrawnChildMail() })
    }
    await this.prisma.$transaction([
      this.prisma.user.updateMany({ where: { parentId: user.id }, data: { parentId: null } }),
      this.prisma.playerGameProfile.deleteMany({ where: { userId: user.id } }),
      this.prisma.venueStaff.deleteMany({ where: { userId: user.id } }),
      // Appareils oubliés : plus aucune notification
      this.prisma.pushToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.playIntent.deleteMany({ where: { userId: user.id } }),
      // Blocages levés ; les signalements restent pour la modération
      this.prisma.block.deleteMany({
        where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
      }),
      // Sessions et moyens de connexion Better Auth : plus aucune connexion possible
      this.prisma.session.deleteMany({ where: { userId: user.id } }),
      this.prisma.account.deleteMany({ where: { userId: user.id } }),
      this.prisma.eventRegistration.deleteMany({ where: { userId: user.id, event: upcoming } }),
      this.prisma.roomParticipant.deleteMany({ where: { userId: user.id, room: upcoming } }),
      this.prisma.room.updateMany({
        where: { hostId: user.id, ...upcoming, status: { in: ['OPEN', 'FULL', 'CONFIRMED'] } },
        data: { status: 'CANCELLED' },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: `${user.id}@supprime.invalid`,
          name: '',
          image: null,
          pseudo: null,
          birthDate: null,
          avatarUrl: null,
          avatarStatus: null,
          city: null,
          latitude: null,
          longitude: null,
          availability: [],
          vibes: [],
          parentId: null,
          parentalConsentAt: null,
          playedGames: { set: [] },
          deletedAt: now,
        },
      }),
    ])
    // Plus de temps réel sur ses appareils encore connectés (LKO-139)
    this.realtime.disconnectUser(user.id)
    await this.storage.remove(user.avatarUrl)
  }
}
