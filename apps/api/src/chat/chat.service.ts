import {
  CHAT_EVENTS,
  CHAT_PAGE_SIZE,
  type ChatRef,
  type ChatType,
  chatChannel,
  chatMessageSchema,
  type chatPageSchema,
  hasBannedWord,
  type myChatsSchema,
  type reportSchema,
  type sendMessageSchema,
} from '@lucko/shared'
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { z } from 'zod'
import type { Prisma, User } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { PushService } from '../push/push.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { chatAccess } from './chat.access'
import { FLOOD, isPast, ONGOING_MS, pushRecipients, sortChats, startsBurst } from './chat.rules'

const withAuthor = {
  author: { select: { id: true, pseudo: true } },
} satisfies Prisma.MessageInclude

/** Message d'un joueur qui n'est pas bloqué par `userId` et ne l'a pas bloqué. */
const notBlockedWith = (userId: string): Prisma.MessageWhereInput => ({
  author: {
    blocksGiven: { none: { blockedId: userId } },
    blocksReceived: { none: { blockerId: userId } },
  },
})

const conversationKey = ({ type, id }: ChatRef) =>
  type === 'room' ? { roomId: id } : { eventId: id }

/** Aperçu d'un message dans une notification. */
const PREVIEW = 120

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** 404 pour un non-membre : il ne sait même pas qu'il y a une conversation. */
  private async access(ref: ChatRef, user: User) {
    const access = await chatAccess(this.prisma, ref, user)
    if (!access) throw new NotFoundException('Conversation introuvable')
    return access
  }

  /** Conversation créée au premier message ou au premier passage. */
  private async conversationId(ref: ChatRef) {
    const key = conversationKey(ref)
    const { id } = await this.prisma.conversation.upsert({
      where: key,
      create: key,
      update: {},
      select: { id: true },
    })
    return id
  }

  /** Une page d'historique, du plus récent au plus ancien, sans les messages des joueurs bloqués. */
  async page(ref: ChatRef, user: User, cursor?: string): Promise<z.output<typeof chatPageSchema>> {
    const { moderator, title, startsAt, venueName, players, capacity } = await this.access(
      ref,
      user,
    )
    const conversation = await this.prisma.conversation.findUnique({
      where: conversationKey(ref),
      select: { id: true, reads: { where: { userId: user.id } } },
    })
    const read = conversation?.reads[0]
    const meta = {
      title,
      lastReadAt: read?.lastReadAt ?? null,
      muted: read?.muted ?? false,
      moderator,
      startsAt,
      venueName,
      players,
      capacity,
    }
    if (!conversation) return { ...meta, messages: [], nextCursor: null, pinned: null }
    const where = { conversationId: conversation.id, deletedAt: null, ...notBlockedWith(user.id) }
    const [rows, pinned] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: CHAT_PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: withAuthor,
      }),
      this.prisma.message.findFirst({
        where: { ...where, kind: 'ANNOUNCEMENT' },
        orderBy: { createdAt: 'desc' },
        include: withAuthor,
      }),
    ])
    const messages = rows.slice(0, CHAT_PAGE_SIZE)
    return {
      ...meta,
      messages,
      nextCursor: rows.length > CHAT_PAGE_SIZE ? (messages.at(-1)?.id ?? null) : null,
      pinned,
    }
  }

  /**
   * Envoie un message : diffusé en direct aux lecteurs du chat, push aux autres membres
   * (une fois par salve de messages, toujours pour une annonce).
   */
  async send(ref: ChatRef, user: User, input: z.output<typeof sendMessageSchema>) {
    const access = await this.access(ref, user)
    if (input.announcement && !access.moderator)
      throw new ForbiddenException('Annonces réservées à l’hôte ou à l’organisateur')
    if (hasBannedWord(input.body))
      throw new BadRequestException('Ce message contient un mot interdit')
    const now = new Date()
    const recent = await this.prisma.message.count({
      where: { authorId: user.id, createdAt: { gte: new Date(now.getTime() - FLOOD.windowMs) } },
    })
    if (recent >= FLOOD.messages)
      throw new HttpException(
        'Doucement : attends quelques secondes avant d’écrire',
        HttpStatus.TOO_MANY_REQUESTS,
      )

    const conversationId = await this.conversationId(ref)
    const announcement = input.announcement
    const [previous, message, blocks] = await this.prisma.$transaction([
      this.prisma.message.findFirst({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.message.create({
        data: {
          conversationId,
          authorId: user.id,
          body: input.body,
          kind: announcement ? 'ANNOUNCEMENT' : 'MESSAGE',
        },
        include: withAuthor,
      }),
      this.prisma.block.findMany({
        where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
        select: { blockerId: true, blockedId: true },
      }),
      // L'auteur a tout lu jusqu'à son message
      this.prisma.conversationRead.upsert({
        where: { conversationId_userId: { conversationId, userId: user.id } },
        create: { conversationId, userId: user.id, lastReadAt: now },
        update: { lastReadAt: now },
      }),
    ])
    const blocked = blocks.map((b) => (b.blockerId === user.id ? b.blockedId : b.blockerId))
    const channel = chatChannel(ref)
    this.realtime.emit(
      channel,
      CHAT_EVENTS.MESSAGE,
      { message: z.encode(chatMessageSchema, message) },
      blocked,
    )

    if (announcement || startsBurst(previous?.createdAt ?? null, now)) {
      const [watching, muted] = await Promise.all([
        this.realtime.watchers(channel),
        this.prisma.conversationRead.findMany({
          where: { conversationId, muted: true },
          select: { userId: true },
        }),
      ])
      const recipients = pushRecipients({
        memberIds: access.memberIds,
        authorId: user.id,
        watching,
        blocked: new Set(blocked),
        muted: new Set(muted.map((m) => m.userId)),
        announcement,
      })
      const body = input.body.length > PREVIEW ? `${input.body.slice(0, PREVIEW)}…` : input.body
      await this.push.notify(recipients, 'MESSAGES', {
        title: announcement ? `Annonce · ${access.title}` : access.title,
        body: announcement ? body : `${user.pseudo ?? 'Un joueur'} : ${body}`,
        url: `/chat/${ref.type}/${ref.id}`,
      })
    }
    return message
  }

  /** Supprimer un message : son auteur, ou l'hôte / l'organisateur. Gardé en base pour la modération. */
  async remove(ref: ChatRef, user: User, messageId: string) {
    const access = await this.access(ref, user)
    const message = await this.findMessage(ref, messageId)
    if (message.authorId !== user.id && !access.moderator)
      throw new ForbiddenException('Seul l’auteur, l’hôte ou l’organisateur peut le supprimer')
    await this.prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } })
    this.realtime.emit(chatChannel(ref), CHAT_EVENTS.DELETED, { messageId })
  }

  /** Signaler un message : un signalement de son auteur, avec le texte cité, dans la file des admins. */
  async report(
    ref: ChatRef,
    user: User,
    messageId: string,
    { reason, details }: z.output<typeof reportSchema>,
  ) {
    await this.access(ref, user)
    const message = await this.findMessage(ref, messageId)
    if (message.authorId === user.id)
      throw new BadRequestException('Impossible de signaler son propre message')
    const quote = `Message du chat (${ref.type} ${ref.id}) : « ${message.body} »`
    await this.prisma.report.create({
      data: {
        reporterId: user.id,
        targetId: message.authorId,
        reason,
        details: details ? `${quote}\n${details}` : quote,
      },
    })
  }

  /** Le joueur a tout lu jusqu'à maintenant. */
  async markRead(ref: ChatRef, user: User) {
    await this.access(ref, user)
    const conversationId = await this.conversationId(ref)
    const now = new Date()
    await this.prisma.conversationRead.upsert({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      create: { conversationId, userId: user.id, lastReadAt: now },
      update: { lastReadAt: now },
    })
  }

  /** Sourdine : plus de push pour les messages, les annonces passent toujours. */
  async mute(ref: ChatRef, user: User, muted: boolean) {
    await this.access(ref, user)
    const conversationId = await this.conversationId(ref)
    await this.prisma.conversationRead.upsert({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      // Première visite : on ne compte pas l'historique comme lu
      create: { conversationId, userId: user.id, lastReadAt: new Date(0), muted },
      update: { muted },
    })
  }

  /**
   * Onglet Messages : chats des rooms et des événements dont le joueur est membre. Ceux d'une partie
   * à venir ou en cours y sont même sans message ; une partie passée n'y reste que si on y a écrit.
   * Le staff d'un lieu ne voit que les événements qui ont des inscrits.
   */
  // ponytail: toutes les conversations du joueur triées en mémoire, paginer s'il y en a des centaines
  async chats(user: User): Promise<z.output<typeof myChatsSchema>> {
    const visible = { deletedAt: null, ...notBlockedWith(user.id) }
    const since = new Date(Date.now() - ONGOING_MS)
    const conversation = {
      select: {
        id: true,
        messages: {
          where: visible,
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { author: { select: { id: true, pseudo: true } } },
        },
        reads: { where: { userId: user.id }, select: { muted: true } },
      },
    } satisfies Prisma.ConversationDefaultArgs
    const written = { conversation: { messages: { some: visible } } }
    const registered = { some: { status: 'REGISTERED' as const } }
    const venue = { select: { name: true } }
    const [rooms, events, unread] = await Promise.all([
      this.prisma.room.findMany({
        where: {
          OR: [
            { hostId: user.id },
            { participants: { some: { userId: user.id, status: 'ACCEPTED' } } },
          ],
          AND: { OR: [{ startsAt: { gte: since }, status: { not: 'CANCELLED' } }, written] },
        },
        select: {
          id: true,
          startsAt: true,
          mode: true,
          status: true,
          venue,
          game: { select: { name: true } },
          format: { select: { name: true } },
          conversation,
        },
      }),
      this.prisma.event.findMany({
        where: {
          OR: [
            { registrations: { some: { userId: user.id, status: 'REGISTERED' } } },
            { venue: { staff: { some: { userId: user.id } } }, registrations: registered },
          ],
          AND: { OR: [{ startsAt: { gte: since }, status: 'PUBLISHED' }, written] },
        },
        select: {
          id: true,
          title: true,
          type: true,
          startsAt: true,
          endsAt: true,
          status: true,
          venue,
          conversation,
        },
      }),
      this.unreadCounts(user.id),
    ])
    const now = new Date()
    const item = (
      chat: {
        type: ChatType
        id: string
        title: string
        kind: z.output<typeof myChatsSchema>['chats'][number]['kind']
        startsAt: Date
        venueName: string | null
        past: boolean
      },
      conversation: {
        id: string
        messages: {
          body: string
          createdAt: Date
          author: { id: string; pseudo: string | null }
        }[]
        reads: { muted: boolean }[]
      } | null,
    ) => {
      const last = conversation?.messages[0]
      return {
        ...chat,
        muted: conversation?.reads[0]?.muted ?? false,
        last: last
          ? {
              pseudo: last.author.pseudo,
              body: last.body,
              createdAt: last.createdAt,
              mine: last.author.id === user.id,
            }
          : null,
        unread: conversation ? (unread.get(conversation.id) ?? 0) : 0,
      }
    }
    const chats = sortChats([
      ...rooms.map((r) =>
        item(
          {
            type: 'room',
            id: r.id,
            title: r.format?.name ?? r.game.name,
            kind: r.mode,
            startsAt: r.startsAt,
            venueName: r.venue?.name ?? null,
            past:
              r.status === 'FINISHED' || r.status === 'CANCELLED' || isPast(r.startsAt, null, now),
          },
          r.conversation,
        ),
      ),
      ...events.map((e) =>
        item(
          {
            type: 'event',
            id: e.id,
            title: e.title,
            kind: e.type,
            startsAt: e.startsAt,
            venueName: e.venue.name,
            past: e.status !== 'PUBLISHED' || isPast(e.startsAt, e.endsAt, now),
          },
          e.conversation,
        ),
      ),
    ])
    return { unread: chats.reduce((sum, chat) => sum + chat.unread, 0), chats }
  }

  /** Non-lus par conversation : messages visibles des autres, postés après le dernier passage du joueur. */
  private async unreadCounts(userId: string) {
    const rows = await this.prisma.$queryRaw<{ id: string; unread: number }[]>`
      SELECT m."conversationId" AS id, COUNT(*)::int AS unread
      FROM "Message" m
      LEFT JOIN "ConversationRead" r ON r."conversationId" = m."conversationId" AND r."userId" = ${userId}
      WHERE m."deletedAt" IS NULL
        AND m."authorId" <> ${userId}
        AND (r."lastReadAt" IS NULL OR m."createdAt" > r."lastReadAt")
        AND NOT EXISTS (
          SELECT 1 FROM "Block" b
          WHERE (b."blockerId" = ${userId} AND b."blockedId" = m."authorId")
             OR (b."blockedId" = ${userId} AND b."blockerId" = m."authorId")
        )
      GROUP BY m."conversationId"
    `
    return new Map(rows.map((row) => [row.id, row.unread]))
  }

  private async findMessage(ref: ChatRef, id: string) {
    const message = await this.prisma.message.findFirst({
      where: { id, deletedAt: null, conversation: conversationKey(ref) },
    })
    if (!message) throw new NotFoundException('Message introuvable')
    return message
  }
}
