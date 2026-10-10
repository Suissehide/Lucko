import {
  type createRoomSchema,
  HOME_FUZZY_RADIUS_M,
  HOME_SAFETY_REQUIRED,
  HOME_SAFETY_VERSION,
  type HostAction,
  openingStatus,
  RATING_PROVISIONAL_GAMES,
  type RoomStatus,
  type roomDetailSchema,
} from '@lucko/shared'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common'
import type { z } from 'zod'
import {
  isMinor,
  MINOR_REFUSED,
  minorRefusal,
  roomVisibleTo,
  type Viewer,
  venueRefuses,
} from '../common/minors.rules'
import { loadEnv } from '../config/env'
import { closureRange, formatLabel, notBlockedWith } from '../explore/explore.service'
import type { Prisma, User } from '../generated/prisma/client'
import { JobsService } from '../jobs/jobs.service'
import { PlayIntentsService } from '../play-intents/play-intents.service'
import { PrismaService } from '../prisma/prisma.service'
import { PushService } from '../push/push.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import {
  addressKeys,
  addressRefusal,
  fuzzyCenter,
  openAddress,
  purgeBefore,
  revealAt,
  sealAddress,
} from './home.rules'
import {
  ACTIVE,
  acceptRefusal,
  createRoomRefusal,
  fillStatus,
  hostActionRefusal,
  joinOutcome,
  lifecycleStatus,
  promotedStatus,
  type ReminderKind,
  reminderContent,
  reminderTimes,
} from './rooms.rules'

type Tx = Prisma.TransactionClient

/** Adresse d'une room à domicile ouverte aux acceptés (LKO-71). */
const HOME_REVEAL_JOB = 'rooms.home-reveal'
/** Suppression des adresses des rooms passées (filet de sécurité, l'annulation les supprime tout de suite). */
const HOME_PURGE_JOB = 'rooms.home-purge'
/** Rappels la veille et 2 h avant (LKO-59). */
const REMINDER_JOB = 'rooms.reminder'

const detailInclude = {
  host: { select: { pseudo: true } },
  game: { select: { slug: true, name: true } },
  format: { select: { name: true } },
  venue: {
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      isPartner: true,
      acceptsUnaccompaniedMinors: true,
    },
  },
  privateAddress: { select: { keyVersion: true } },
  participants: {
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          pseudo: true,
          birthDate: true,
          parentId: true,
          xp: true,
          gameProfiles: true,
        },
      },
    },
  },
} satisfies Prisma.RoomInclude

@Injectable()
export class RoomsService implements OnModuleInit {
  private readonly logger = new Logger('Rooms')
  private readonly addressKeys = addressKeys(loadEnv().HOME_ADDRESS_KEYS)

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimeGateway,
    private readonly intents: PlayIntentsService,
    private readonly jobs: JobsService,
  ) {}

  async onModuleInit() {
    // Rotation : une clé retirée trop tôt rendrait des adresses illisibles, l'API refuse de démarrer
    const versions = await this.prisma.roomPrivateAddress.groupBy({ by: ['keyVersion'] })
    const missing = versions.filter(({ keyVersion }) => !this.addressKeys.keys.has(keyVersion))
    if (missing.length)
      throw new Error(
        `HOME_ADDRESS_KEYS : clé version ${missing.map((m) => m.keyVersion).join(', ')} encore utilisée par des adresses`,
      )
    await this.jobs.handle<{ roomId: string }>(HOME_REVEAL_JOB, ({ roomId }) =>
      this.addressRevealed(roomId),
    )
    await this.jobs.handle(
      HOME_PURGE_JOB,
      async () => {
        await this.prisma.roomPrivateAddress.deleteMany({
          where: {
            room: { OR: [{ startsAt: { lt: purgeBefore() } }, { status: 'CANCELLED' }] },
          },
        })
      },
      { cron: '0 * * * *' },
    )
    await this.jobs.handle<{ roomId: string; kind: ReminderKind }>(
      REMINDER_JOB,
      ({ roomId, kind }) => this.remind(roomId, kind),
    )
  }

  /** Crée la room ; l'hôte en est le premier joueur accepté. */
  async create(host: User, { home, ...input }: z.output<typeof createRoomSchema>) {
    const now = new Date()
    if (home) requireHomeSafety(host)
    const [game, venue, hostOpenRooms] = await Promise.all([
      this.prisma.game.findUnique({
        where: { id: input.gameId },
        include: { formats: true },
      }),
      input.venueId
        ? this.prisma.venue.findFirst({
            where: { id: input.venueId, status: 'PUBLISHED' },
            include: { openingHours: true, closures: { where: { endsOn: { gte: now } } } },
          })
        : null,
      this.prisma.room.count({
        where: { hostId: host.id, status: { in: ['OPEN', 'FULL'] }, startsAt: { gte: now } },
      }),
    ])
    if (!game) throw new NotFoundException('Jeu introuvable')
    if (input.venueId && !venue) throw new NotFoundException('Lieu introuvable')

    const refusal = createRoomRefusal(
      { ...input, home },
      {
        game,
        venueOpen: venue
          ? openingStatus(venue.openingHours, venue.closures.map(closureRange), input.startsAt)
              .openNow
          : null,
        hostIsMinor: isMinor(host, now),
        venueRefusesHost: venueRefuses(venue, host, now),
        hostOpenRooms,
      },
      now,
    )
    if (refusal) throw new BadRequestException(refusal)

    // Seule la zone floue est gardée en clair ; position exacte et adresse, chiffrées, si l'hôte la donne
    const center = home ? fuzzyCenter(home.lat, home.lng) : null
    const room = await this.prisma.room.create({
      data: {
        ...input,
        venueId: input.venueId ?? null,
        ...(home && center
          ? {
              atHome: true,
              homeAreaLabel: home.areaLabel,
              fuzzyLat: center.lat,
              fuzzyLng: center.lng,
              ...(home.address
                ? {
                    privateAddress: {
                      create: sealAddress(this.addressKeys, {
                        address: home.address,
                        lat: home.lat,
                        lng: home.lng,
                      }),
                    },
                  }
                : {}),
            }
          : {}),
        formatId: input.formatId ?? null,
        boardGameCategory: input.boardGameCategory ?? null,
        bracket: input.bracket ?? null,
        description: input.description || null,
        hostId: host.id,
        participants: { create: { userId: host.id, status: 'ACCEPTED' } },
      },
      select: { id: true },
    })
    if (home?.address)
      await this.jobs.send(
        HOME_REVEAL_JOB,
        { roomId: room.id },
        { startAfter: revealAt(input.startsAt), singletonKey: room.id },
      )
    // L'heure d'une room ne change pas : les rappels sont programmés une fois pour toutes
    for (const [kind, at] of reminderTimes(input.startsAt, now))
      await this.jobs.send(
        REMINDER_JOB,
        { roomId: room.id, kind },
        { startAfter: at, singletonKey: `${room.id}:${kind}` },
      )
    // Joueurs qui attendent ce jeu près du lieu (LKO-17)
    await this.intents.roomOpened(room.id)
    return room
  }

  /**
   * Adresse d'une room à domicile (LKO-71) : l'hôte, et les joueurs acceptés à partir de 24 h avant le
   * début. 403 avec le motif sinon, 404 si l'hôte la donne dans le chat ou si elle a été supprimée.
   */
  async address(id: string, user: User) {
    const room = await this.prisma.room.findFirst({
      where: { id, atHome: true, ...notBlockedWith(user.id) },
      include: {
        participants: { select: { userId: true, status: true } },
        privateAddress: true,
      },
    })
    if (!room) throw new NotFoundException('Room introuvable')
    const refusal = addressRefusal(room, user.id)
    if (refusal) throw new ForbiddenException(refusal)
    if (!room.privateAddress)
      throw new NotFoundException('Pas d’adresse enregistrée : l’hôte la donne dans le chat')
    // Journal des accès, sans l'adresse
    this.logger.log(`Adresse de la room ${id} lue par ${user.id}`)
    return openAddress(this.addressKeys, room.privateAddress)
  }

  /** 24 h avant : les joueurs acceptés sont prévenus que l'adresse est visible. */
  private async addressRevealed(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        privateAddress: { select: { keyVersion: true } },
        participants: { where: { status: 'ACCEPTED' }, select: { userId: true } },
      },
    })
    if (!room?.privateAddress || room.status === 'CANCELLED') return
    await this.push.notify(
      room.participants.map((p) => p.userId).filter((id) => id !== room.hostId),
      'ROOMS',
      {
        title: 'Adresse disponible',
        body: 'L’adresse de la room à domicile est visible dans la room.',
        url: `/rooms/${roomId}`,
      },
    )
  }

  /**
   * Rappel aux joueurs acceptés à ce moment-là, hôte compris (LKO-59) : un joueur parti ou retiré
   * n'est plus dans la liste ; rien pour une room annulée ou déjà commencée.
   */
  // ponytail: un mineur aux heures calmes reçoit le rappel « dans 2 h » à 8 h (quietUntil) ; le jeter s'il arrive après la partie
  private async remind(roomId: string, kind: ReminderKind) {
    const now = new Date()
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        game: { select: { name: true } },
        venue: { select: { name: true } },
        privateAddress: { select: { keyVersion: true } },
        participants: { where: { status: 'ACCEPTED' }, select: { userId: true } },
      },
    })
    if (!room || room.status === 'CANCELLED' || room.startsAt <= now) return
    const addressVisible = room.privateAddress ? now >= revealAt(room.startsAt) : null
    await this.push.notify(
      room.participants.map((p) => p.userId),
      'ROOMS',
      {
        ...reminderContent(kind, { ...room, addressVisible }),
        url: `/rooms/${roomId}`,
      },
    )
  }

  /**
   * Fiche room (B6). Introuvable si le joueur ne peut pas la voir (règles mineurs, blocage).
   * Pseudos des joueurs pour les membres, initiales pour les autres ; candidatures pour l'hôte seulement.
   */
  async detail(id: string, viewer: Viewer): Promise<z.output<typeof roomDetailSchema>> {
    const now = new Date()
    const room = await this.prisma.room.findFirst({
      where: { id, ...notBlockedWith(viewer?.id) },
      include: detailInclude,
    })
    const mine = room?.participants.find((p) => p.userId === viewer?.id)
    // Un joueur déjà passé par la room la voit encore si les règles ont changé depuis (lieu qui refuse désormais les mineurs seuls)
    if (!room || (!mine && !roomVisibleTo(withAccepted(room), viewer, now)))
      throw new NotFoundException('Room introuvable')

    const isHost = room.hostId === viewer?.id
    const member = isHost || mine?.status === 'ACCEPTED'
    const accepted = room.participants.filter((p) => p.status === 'ACCEPTED')
    const waiting = room.participants.filter(
      (p) => p.status === 'PENDING' || p.status === 'WAITLISTED',
    )
    return {
      ...room,
      home:
        room.atHome && room.fuzzyLat !== null && room.fuzzyLng !== null
          ? {
              areaLabel: room.homeAreaLabel ?? 'À domicile',
              lat: room.fuzzyLat,
              lng: room.fuzzyLng,
              radiusM: HOME_FUZZY_RADIUS_M,
              revealAt: revealAt(room.startsAt),
              hasAddress: room.privateAddress !== null,
            }
          : null,
      status: lifecycleStatus(room, now),
      format: formatLabel(room),
      players: accepted.map(({ userId, user }) => ({
        initial: user.pseudo?.slice(0, 1) ?? '?',
        pseudo: member ? user.pseudo : null,
        userId: isHost ? userId : null,
      })),
      waitlistCount: room.participants.filter((p) => p.status === 'WAITLISTED').length,
      myStatus: isHost ? 'ACCEPTED' : (mine?.status ?? null),
      isHost,
      candidates: isHost
        ? waiting.map(({ userId, status, createdAt, user }) => {
            const profile = user.gameProfiles.find((g) => g.formatId === room.formatId)
            return {
              userId,
              pseudo: user.pseudo,
              status: status as 'PENDING' | 'WAITLISTED',
              minor: isMinor(user, now),
              xp: user.xp,
              rating:
                profile && profile.rankedGames >= RATING_PROVISIONAL_GAMES ? profile.rating : null,
              rankedGames: profile?.rankedGames ?? 0,
              appliedAt: createdAt,
            }
          })
        : [],
    }
  }

  /** Demander à rejoindre : en attente de l'hôte, acceptée d'office ou liste d'attente (rooms.rules). */
  async join(id: string, user: User) {
    await this.prisma.$transaction(async (tx) => {
      const room = await this.lock(tx, id, user, { minorCode: true })
      const current = room.participants.find((p) => p.userId === user.id)?.status ?? null
      // Avertissement sécurité avant toute première demande pour une room à domicile (LKO-72)
      if (room.atHome && !(current && ACTIVE.includes(current))) requireHomeSafety(user)
      const outcome = joinOutcome(room, accepted(room), user.id, current)
      if ('refused' in outcome) throw new ConflictException(outcome.refused)
      if (outcome.status === current) return
      await tx.roomParticipant.upsert({
        where: { roomId_userId: { roomId: id, userId: user.id } },
        // Nouvelle demande après un départ : en fin de file
        update: { status: outcome.status, createdAt: new Date() },
        create: { roomId: id, userId: user.id, status: outcome.status },
      })
      await this.refreshStatus(tx, id)
    })
    this.realtime.changed({ type: 'room', id })
    return this.detail(id, user)
  }

  /**
   * Quitter la room ou retirer sa demande. Une place libérée revient au premier de la liste d'attente.
   */
  async leave(id: string, user: User) {
    await this.prisma.$transaction(async (tx) => {
      const room = await this.lock(tx, id, user)
      if (room.hostId === user.id)
        throw new ConflictException('L’hôte ne peut pas quitter sa room : annule-la')
      const mine = room.participants.find((p) => p.userId === user.id)
      if (!mine || mine.status === 'LEFT' || mine.status === 'DECLINED') return
      await tx.roomParticipant.update({
        where: { roomId_userId: { roomId: id, userId: user.id } },
        data: { status: 'LEFT' },
      })
      if (mine.status === 'ACCEPTED') await this.promote(tx, room)
      await this.refreshStatus(tx, id)
    })
    await this.realtime.revoke({ type: 'room', id }, [user.id])
    this.realtime.changed({ type: 'room', id })
    return this.detail(id, user)
  }

  /** L'hôte accepte (`accept`) ou refuse une demande. */
  async decide(id: string, host: User, userId: string, accept: boolean) {
    await this.prisma.$transaction(async (tx) => {
      const room = await this.lock(tx, id, host)
      if (room.hostId !== host.id) throw new ForbiddenException('Réservé à l’hôte de la room')
      const candidate = room.participants.find((p) => p.userId === userId)?.status ?? null
      const refusal = accept
        ? acceptRefusal(candidate, accepted(room), room.capacity)
        : candidate === 'PENDING' || candidate === 'WAITLISTED'
          ? null
          : 'Pas de demande en attente'
      if (refusal) throw new ConflictException(refusal)
      await tx.roomParticipant.update({
        where: { roomId_userId: { roomId: id, userId } },
        data: { status: accept ? 'ACCEPTED' : 'DECLINED' },
      })
      await this.refreshStatus(tx, id)
      if (accept)
        await this.push.notify(
          [userId],
          'ROOMS',
          {
            title: 'Candidature acceptée',
            body: 'Ta place est réservée. Retrouve la room dans Mes parties.',
            url: `/rooms/${id}`,
          },
          tx,
        )
    })
    if (!accept) await this.realtime.revoke({ type: 'room', id }, [userId])
    this.realtime.changed({ type: 'room', id })
    return this.detail(id, host)
  }

  /**
   * Action de l'hôte (LKO-57) : retirer un joueur (il ne peut plus revenir, sa place revient à la liste
   * d'attente), transférer le rôle d'hôte à un joueur accepté, fermer / rouvrir les inscriptions, annuler.
   */
  // ponytail: annulation sans délai ni effet sur la fiabilité
  async hostAction(id: string, host: User, action: HostAction) {
    await this.prisma.$transaction(async (tx) => {
      const room = await this.lock(tx, id, host)
      if (room.hostId !== host.id) throw new ForbiddenException('Réservé à l’hôte de la room')
      const target = 'userId' in action ? action.userId : null
      const participant = room.participants.find((p) => p.userId === target)?.status ?? null
      const refusal = hostActionRefusal(room, action, participant)
      if (refusal) throw new ConflictException(refusal)
      switch (action.type) {
        case 'remove':
          await tx.roomParticipant.update({
            where: { roomId_userId: { roomId: id, userId: action.userId } },
            data: { status: 'DECLINED' },
          })
          await this.promote(tx, room)
          break
        case 'transfer':
          await tx.room.update({ where: { id }, data: { hostId: action.userId } })
          break
        case 'close':
          await tx.room.update({ where: { id }, data: { status: 'CONFIRMED' } })
          break
        case 'reopen':
          // refreshStatus la repasse ensuite en ouverte ou complète ; places libérées pendant la fermeture
          await tx.room.update({ where: { id }, data: { status: 'OPEN' } })
          await this.promote(tx, { ...room, status: 'OPEN' }, room.capacity - accepted(room))
          break
        case 'cancel':
          await tx.room.update({ where: { id }, data: { status: 'CANCELLED' } })
          await tx.roomPrivateAddress.deleteMany({ where: { roomId: id } })
          // Joueurs acceptés, en attente ou sur liste d'attente : tous prévenus
          await this.push.notify(
            room.participants
              .filter((p) => p.userId !== host.id && p.status !== 'DECLINED' && p.status !== 'LEFT')
              .map((p) => p.userId),
            'ROOMS',
            {
              title: 'Room annulée',
              body: 'L’hôte a annulé une room où tu étais inscrit·e.',
              url: `/rooms/${id}`,
            },
            tx,
          )
          break
      }
      await this.refreshStatus(tx, id)
    })
    if (action.type === 'remove') await this.realtime.revoke({ type: 'room', id }, [action.userId])
    this.realtime.changed({ type: 'room', id })
    return this.detail(id, host)
  }

  /**
   * Verrou sur la room (deux demandes simultanées ne prennent pas la même dernière place), visibilité comprise.
   * Règles mineurs ignorées pour un joueur qui y a déjà une place ou une demande : il peut toujours la quitter.
   * `minorCode` : 403 `MINOR_REFUSED` avec le motif au lieu de « Room introuvable » (candidature, LKO-51).
   */
  private async lock(tx: Tx, id: string, user: User, { minorCode = false } = {}) {
    await tx.$queryRaw`SELECT 1 FROM "Room" WHERE "id" = ${id} FOR UPDATE`
    const room = await tx.room.findFirst({
      where: { id, ...notBlockedWith(user.id) },
      include: {
        participants: { orderBy: { createdAt: 'asc' } },
        venue: { select: { acceptsUnaccompaniedMinors: true } },
      },
    })
    if (!room) throw new NotFoundException('Room introuvable')
    const active = room.participants.some((p) => p.userId === user.id && ACTIVE.includes(p.status))
    const refusal = active ? null : minorRefusal(withAccepted(room), user)
    if (refusal && minorCode)
      throw new ForbiddenException({ code: MINOR_REFUSED, message: refusal })
    if (refusal) throw new NotFoundException('Room introuvable')
    return room
  }

  /**
   * Places libérées (`count`) : les premiers de la liste d'attente passent devant. Rien si les inscriptions
   * sont fermées (room confirmée) : ce sera fait à la réouverture.
   */
  private async promote(
    tx: Tx,
    room: { id: string; autoAccept: boolean; status: RoomStatus },
    count = 1,
  ) {
    if (count <= 0 || (room.status !== 'OPEN' && room.status !== 'FULL')) return
    const next = await tx.roomParticipant.findMany({
      where: { roomId: room.id, status: 'WAITLISTED' },
      orderBy: { createdAt: 'asc' },
      take: count,
    })
    await tx.roomParticipant.updateMany({
      where: { roomId: room.id, userId: { in: next.map((p) => p.userId) } },
      data: { status: promotedStatus(room.autoAccept) },
    })
    if (room.autoAccept)
      await this.push.notify(
        next.map((p) => p.userId),
        'ROOMS',
        {
          title: 'Une place s’est libérée',
          body: 'Tu passes de la liste d’attente à la table.',
          url: `/rooms/${room.id}`,
        },
        tx,
      )
  }

  /** Ouverte / complète selon les acceptés (une room confirmée, annulée… ne bouge pas). */
  private async refreshStatus(tx: Tx, id: string) {
    const room = await tx.room.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { participants: { where: { status: 'ACCEPTED' } } } } },
    })
    if (room.status !== 'OPEN' && room.status !== 'FULL') return
    const status = fillStatus(room._count.participants, room.capacity)
    if (status !== room.status) await tx.room.update({ where: { id }, data: { status } })
  }
}

/** 403 `HOME_SAFETY_REQUIRED` tant que l'avertissement sécurité n'est pas accepté dans sa version actuelle. */
function requireHomeSafety(user: User) {
  if ((user.homeSafetyVersion ?? 0) < HOME_SAFETY_VERSION)
    throw new ForbiddenException({
      code: HOME_SAFETY_REQUIRED,
      message: 'Lis et accepte les conseils de sécurité des rooms à domicile',
    })
}

/** Mineur avec son parent accepté dans la room (LKO-72) : voir `minorRefusal`. */
const withAccepted = <T extends { participants: { userId: string; status: string }[] }>(
  room: T,
) => ({
  ...room,
  acceptedUserIds: room.participants.filter((p) => p.status === 'ACCEPTED').map((p) => p.userId),
})

const accepted = (room: { participants: { status: string }[] }) =>
  room.participants.filter((p) => p.status === 'ACCEPTED').length
