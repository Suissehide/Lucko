import { CHAT_EVENTS, type Channel, channelName, channelSchema, REALTIME } from '@lucko/shared'
import {
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import type { DefaultEventsMap, Server, Socket } from 'socket.io'
import { AuthService } from '../auth/auth.service'
import { chatAccess } from '../chat/chat.access'
import { eventVisibleTo, roomVisibleTo } from '../common/minors.rules'
import { loadEnv } from '../config/env'
import type { User } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

type Client = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, { user: User }>

/** Salle Socket.IO de tous les appareils d'un joueur : pour exclure un joueur bloqué d'un envoi. */
const userRoom = (id: string) => `user:${id}`

/** Membres d'une room : l'hôte et les joueurs acceptés, en attente ou sur liste d'attente. */
const MEMBER_STATUSES = ['ACCEPTED', 'PENDING', 'WAITLISTED'] as const

/**
 * Temps réel (LKO-105) : un joueur connecté suit une room dont il est membre ou un événement qu'il peut voir,
 * et l'API lui signale chaque changement (places restantes, statut). Contrat dans @lucko/shared (REALTIME).
 * Il suit aussi le chat (LKO-80) d'une room ou d'un événement dont il est membre (CHAT_EVENTS).
 */
// ponytail: une seule instance d'API ; adaptateur Redis (@socket.io/redis-adapter) si on en lance plusieurs
@WebSocketGateway({ cors: { origin: loadEnv().CORS_ORIGINS, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Server

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Connexion refusée sans session. Sur téléphone, pas de cookie automatique : l'app envoie le sien
   * (et le joueur de démo en dev) dans `auth`.
   */
  afterInit(server: Server) {
    server.use(async (socket, next) => {
      const { cookie, devUserId } = socket.handshake.auth as Record<string, unknown>
      const headers = { ...socket.handshake.headers }
      if (typeof cookie === 'string') headers.cookie = cookie
      if (typeof devUserId === 'string') headers['x-dev-user-id'] = devUserId
      const user = await this.auth.resolveUser(headers).catch(() => null)
      if (!user) return next(new Error('Connexion requise'))
      socket.data.user = user
      next()
    })
  }

  handleConnection(client: Client) {
    void client.join(userRoom(client.data.user.id))
  }

  /** Suivre un canal ; l'accusé de réception vaut false si le joueur n'y a pas droit. */
  @SubscribeMessage(REALTIME.WATCH)
  async watch(client: Client, payload: unknown) {
    const channel = channelSchema.safeParse(payload)
    if (!channel.success || !(await this.canWatch(channel.data, client.data.user))) return false
    await client.join(channelName(channel.data))
    return true
  }

  @SubscribeMessage(REALTIME.UNWATCH)
  async unwatch(client: Client, payload: unknown) {
    const channel = channelSchema.safeParse(payload)
    if (channel.success) await client.leave(channelName(channel.data))
    return true
  }

  /** Saisie en cours, relayée aux autres lecteurs du chat (seulement si l'émetteur le suit). */
  @SubscribeMessage(CHAT_EVENTS.TYPING)
  typing(client: Client, payload: unknown) {
    const channel = channelSchema.safeParse(payload)
    if (!channel.success || !channel.data.type.endsWith('-chat')) return
    const name = channelName(channel.data)
    if (client.rooms.has(name))
      client.to(name).emit(CHAT_EVENTS.TYPING, {
        channel: channel.data,
        pseudo: client.data.user.pseudo,
      })
  }

  /** Message du chat aux lecteurs du canal, sauf `except` (joueurs bloqués par l'auteur ou qui l'ont bloqué). */
  emit(channel: Channel, event: string, payload: object, except: string[] = []) {
    this.server
      .to(channelName(channel))
      .except(except.map(userRoom))
      .emit(event, { channel, ...payload })
  }

  /**
   * Coupe tous les appareils d'un joueur suspendu ou supprimé (LKO-139) : la session n'est lue qu'à la
   * connexion. À appeler après le commit, sinon il se reconnecterait avant que le refus ne vaille.
   */
  disconnectUser(id: string) {
    this.server.in(userRoom(id)).disconnectSockets(true)
  }

  /** Joueurs qui ont le canal ouvert en ce moment. */
  async watchers(channel: Channel) {
    const sockets = await this.server.in(channelName(channel)).fetchSockets()
    return new Set(sockets.map((socket) => socket.data.user.id as string))
  }

  /** À appeler après le commit : les clients qui suivent le canal rechargent la fiche. */
  changed(channel: Channel) {
    const message = channelSchema.parse(channel)
    this.server.to(channelName(message)).emit(REALTIME.CHANGED, message)
  }

  /** Joueurs qui ne sont plus membres (départ, retrait, refus) : ils ne suivent plus le canal, ni le chat d'une room. */
  async revoke(channel: Channel, userIds: string[]) {
    const channels =
      channel.type === 'room'
        ? [channel, { type: 'room-chat' as const, id: channel.id }]
        : [channel]
    for (const { type, id } of channels) {
      const name = channelName({ type, id })
      const sockets = await this.server.in(name).fetchSockets()
      for (const socket of sockets) if (userIds.includes(socket.data.user.id)) socket.leave(name)
    }
  }

  private async canWatch({ type, id }: Channel, user: User) {
    if (type === 'room-chat' || type === 'event-chat') {
      const chat = { type: type === 'room-chat' ? 'room' : 'event', id } as const
      return (await chatAccess(this.prisma, chat, user)) !== null
    }
    if (type === 'room') {
      const room = await this.prisma.room.findUnique({
        where: { id },
        select: {
          minorsAllowed: true,
          atHome: true,
          hostId: true,
          venue: { select: { acceptsUnaccompaniedMinors: true } },
          participants: {
            where: { userId: user.id, status: { in: [...MEMBER_STATUSES] } },
            select: { userId: true },
          },
        },
      })
      if (!room || !roomVisibleTo(room, user)) return false
      return room.hostId === user.id || room.participants.length > 0
    }
    const event = await this.prisma.event.findUnique({ where: { id }, select: { minAge: true } })
    return event !== null && eventVisibleTo(event, user)
  }
}
