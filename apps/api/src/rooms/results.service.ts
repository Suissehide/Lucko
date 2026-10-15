import {
  type DisputeResultInput,
  type Placements,
  RESULT_REMINDER_HOURS,
  type ResultDecisionInput,
  resultMajority,
  type roomResultSchema,
  type SubmitResultInput,
} from '@lucko/shared'
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
import { applyRatingResult, revertRatingResult } from '../common/rating'
import { formatLabel } from '../explore/explore.service'
import { Prisma, type ResultStatus, type User } from '../generated/prisma/client'
import { JobsService } from '../jobs/jobs.service'
import { PrismaService } from '../prisma/prisma.service'
import { PushService } from '../push/push.service'
import {
  majorityReached,
  placementsRefusal,
  resultDeadline,
  submitRefusal,
  voteRefusal,
} from './results.rules'
import { ROOM_PLAY_MS } from './rooms.rules'

type Db = Prisma.TransactionClient | PrismaService

/** Relances à H+2 et H+24 après la fin de la room, puis validation automatique à 48 h. */
export const RESULT_REMINDER_JOB = 'results.reminder'
export const RESULT_DEADLINE_JOB = 'results.deadline'

const dbDate = (date: string) => new Date(`${date}T00:00:00Z`)

const roomInclude = {
  game: { select: { name: true, kind: true } },
  format: { select: { name: true } },
  venue: { select: { name: true, isPartner: true } },
  participants: {
    where: { status: 'ACCEPTED' },
    orderBy: { createdAt: 'asc' },
    select: {
      userId: true,
      present: true,
      user: { select: { pseudo: true, avatarUrl: true, avatarStatus: true, gameProfiles: true } },
    },
  },
  result: {
    include: {
      submittedBy: { select: { pseudo: true } },
      votes: { include: { user: { select: { pseudo: true } } }, orderBy: { createdAt: 'asc' } },
    },
  },
} satisfies Prisma.RoomInclude

type ResultRoom = Prisma.RoomGetPayload<{ include: typeof roomInclude }>
type RoomResult = z.output<typeof roomResultSchema>

/**
 * Résultats des rooms classées (LKO-83, archi §12). Un joueur pointé présent saisit le classement ; il est
 * validé quand plus de la moitié des présents l'ont confirmé, ou d'office 48 h après la fin sans
 * contestation. Une contestation (ou une 2e saisie) part chez le lieu partenaire, sinon chez un admin.
 * À la validation, les LK sont mis à jour dans la même transaction (moteur LK, LKO-86).
 */
// ponytail: les présents sont figés à la saisie ; un pointage corrigé après coup ne change pas le classement
@Injectable()
export class ResultsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly push: PushService,
  ) {}

  async onModuleInit() {
    await this.jobs.handle<{ roomId: string }>(RESULT_REMINDER_JOB, ({ roomId }) =>
      this.remind(roomId),
    )
    await this.jobs.handle<{ roomId: string }>(RESULT_DEADLINE_JOB, ({ roomId }) =>
      this.expire(roomId),
    )
  }

  /** Programmé à la création d'une room classée (l'heure d'une room ne change pas). */
  async schedule(roomId: string, startsAt: Date, tx?: Prisma.TransactionClient) {
    const end = startsAt.getTime() + ROOM_PLAY_MS
    for (const hours of RESULT_REMINDER_HOURS)
      await this.jobs.send(
        RESULT_REMINDER_JOB,
        { roomId },
        { startAfter: new Date(end + hours * 3_600_000), singletonKey: `${roomId}:${hours}` },
        tx,
      )
    await this.jobs.send(
      RESULT_DEADLINE_JOB,
      { roomId },
      { startAfter: resultDeadline(startsAt), singletonKey: roomId },
      tx,
    )
  }

  /** Résultat d'une room, pour un joueur accepté (ou un admin). */
  async view(roomId: string, user: User): Promise<RoomResult> {
    const room = await this.room(this.prisma, roomId)
    if (user.role !== 'ADMIN' && !room.participants.some((p) => p.userId === user.id))
      throw new ForbiddenException('Réservé aux joueurs de la room')
    return this.toView(room, await this.presentIds(this.prisma, room), user.id)
  }

  async submit(roomId: string, user: User, input: SubmitResultInput) {
    const placements = input.placements as Placements
    await this.prisma.$transaction(async (tx) => {
      const room = await this.room(tx, roomId)
      const present = await this.presentIds(tx, room)
      const refused =
        submitRefusal({ ...room, kind: room.game.kind }, present, user.id) ??
        placementsRefusal(placements, present, input.score)
      if (refused) throw new ConflictException(refused)
      // 2e saisie : une contre-proposition, donc une contestation
      if (room.result) {
        if (room.result.status !== 'PENDING' && room.result.status !== 'DISPUTED')
          throw new ConflictException('Le résultat de cette room est déjà validé')
        return this.disputeIn(tx, room, present, user, {
          reason: 'Contre-proposition : autre classement saisi',
          placements,
        })
      }
      try {
        await tx.matchResult.create({
          data: {
            roomId,
            submittedById: user.id,
            placements,
            score: input.score ?? null,
            votes: { create: { userId: user.id, accepted: true } },
          },
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          throw new ConflictException('Un résultat vient d’être saisi : confirme-le ou conteste-le')
        throw error
      }
      await this.push.notify(
        present.filter((id) => id !== user.id),
        'ROOMS',
        {
          title: 'Résultat à confirmer',
          body: `${user.pseudo ?? 'Un joueur'} a saisi le classement de ${this.title(room)}.`,
          url: `/results/${roomId}`,
        },
        tx,
      )
    })
    return this.view(roomId, user)
  }

  async confirm(roomId: string, user: User) {
    await this.prisma.$transaction(async (tx) => {
      const room = await this.room(tx, roomId)
      const result = this.pending(room)
      const present = await this.presentIds(tx, room)
      const refused = voteRefusal(
        result.status,
        present.includes(user.id),
        result.votes.some((v) => v.userId === user.id),
        false,
      )
      if (refused) throw new ConflictException(refused)
      await tx.resultConfirmation.create({
        data: { resultId: result.id, userId: user.id, accepted: true },
      })
      const accepted = result.votes.filter((v) => v.accepted).length + 1
      if (majorityReached(accepted, present.length)) await this.validate(tx, room, 'CONFIRMED')
    })
    return this.view(roomId, user)
  }

  async dispute(roomId: string, user: User, input: DisputeResultInput) {
    await this.prisma.$transaction(async (tx) => {
      const room = await this.room(tx, roomId)
      await this.disputeIn(tx, room, await this.presentIds(tx, room), user, input)
    })
    return this.view(roomId, user)
  }

  /** Contestations à trancher : celles d'un lieu partenaire, ou toutes pour un admin. */
  async disputes(venueId?: string): Promise<RoomResult[]> {
    const rooms = await this.prisma.room.findMany({
      where: {
        result: { status: 'DISPUTED' },
        ...(venueId ? { venueId, venue: { isPartner: true } } : {}),
      },
      include: roomInclude,
      orderBy: { startsAt: 'asc' },
    })
    return Promise.all(
      rooms.map(async (room) => ({
        ...this.toView(room, await this.presentIds(this.prisma, room), null),
        submitRefused: null,
      })),
    )
  }

  /**
   * Le lieu partenaire (`venueId`) ou un admin tranche une contestation : un classement des joueurs du
   * résultat, ou null = sans résultat. Décision tracée sur le résultat (qui, quand, motif).
   */
  async decide(roomId: string, user: User, input: ResultDecisionInput, venueId?: string) {
    await this.prisma.$transaction(async (tx) => {
      const room = await this.room(tx, roomId)
      if (venueId && (room.venueId !== venueId || !room.venue?.isPartner))
        throw new NotFoundException('Contestation introuvable dans ce lieu')
      if (room.result?.status !== 'DISPUTED')
        throw new ConflictException('Pas de contestation à trancher sur cette room')
      const placements = input.placements as Placements | null
      if (placements) {
        const players = (room.result.placements as Placements).map((p) => p.userId)
        const refused = placementsRefusal(placements, players)
        if (refused) throw new BadRequestException(refused)
      }
      await this.validate(tx, room, placements ? 'RESOLVED' : 'VOID', {
        placements,
        decidedById: user.id,
        decisionReason: input.reason,
      })
    })
  }

  /** Admin : annule un résultat ; s'il était validé, les LK de la room sont retirés. */
  async void(roomId: string, user: User, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const room = await this.room(tx, roomId)
      if (!room.result || room.result.status === 'VOID')
        throw new ConflictException('Pas de résultat à annuler')
      await revertRatingResult(tx, roomId)
      await tx.matchResult.update({
        where: { id: room.result.id },
        data: {
          status: 'VOID',
          decidedById: user.id,
          decidedAt: new Date(),
          decisionReason: reason,
        },
      })
    })
  }

  private async disputeIn(
    tx: Prisma.TransactionClient,
    room: ResultRoom,
    present: string[],
    user: User,
    { reason, placements }: DisputeResultInput,
  ) {
    const result = this.pending(room)
    const refused =
      voteRefusal(
        result.status,
        present.includes(user.id),
        result.votes.some((v) => v.userId === user.id),
        true,
      ) ?? (placements ? placementsRefusal(placements as Placements, present) : null)
    if (refused) throw new ConflictException(refused)
    await tx.resultConfirmation.create({
      data: {
        resultId: result.id,
        userId: user.id,
        accepted: false,
        reason,
        placements: placements ?? Prisma.DbNull,
      },
    })
    if (result.status === 'DISPUTED') return
    await tx.matchResult.update({ where: { id: result.id }, data: { status: 'DISPUTED' } })
    // Lieu partenaire : son staff tranche depuis le back-office ; sinon la file des admins
    if (room.venueId && room.venue?.isPartner) {
      const staff = await tx.venueStaff.findMany({
        where: { venueId: room.venueId },
        select: { userId: true },
      })
      await this.push.notify(
        staff.map((s) => s.userId),
        'VENUES',
        {
          title: 'Résultat contesté',
          body: `${this.title(room)} : un joueur conteste le classement, à toi de trancher.`,
          url: `/disputes/${room.venueId}`,
        },
        tx,
      )
    }
  }

  /** Valide (majorité, 48 h, décision) ou classe sans résultat ; une seule fois par résultat. */
  private async validate(
    tx: Prisma.TransactionClient,
    room: ResultRoom,
    status: Extract<ResultStatus, 'CONFIRMED' | 'RESOLVED' | 'VOID'>,
    decision?: { placements: Placements | null; decidedById: string; decisionReason: string },
  ) {
    const result = this.pending(room)
    const placements = decision ? decision.placements : (result.placements as Placements)
    const { count } = await tx.matchResult.updateMany({
      where: { id: result.id, status: result.status },
      data: {
        status,
        ...(placements ? { placements, confirmedAt: new Date() } : {}),
        ...(decision
          ? {
              decidedById: decision.decidedById,
              decidedAt: new Date(),
              decisionReason: decision.decisionReason,
            }
          : {}),
      },
    })
    if (!count || !placements || !room.formatId) return
    // Événement result.confirmed : moteur LK (LKO-86), dans la même transaction
    await applyRatingResult(tx, { formatId: room.formatId, roomId: room.id, placements })
    await this.push.notify(
      placements.map((p) => p.userId),
      'ROOMS',
      {
        title: 'Résultat validé',
        body: `${this.title(room)} : tes LK sont à jour.`,
        url: `/results/${room.id}`,
      },
      tx,
    )
  }

  /** Relance : saisir le résultat, ou le confirmer pour ceux qui n'ont pas encore répondu. */
  private async remind(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: roomInclude })
    if (!room || room.status === 'CANCELLED' || room.mode !== 'RANKED') return
    if (room.result && room.result.status !== 'PENDING') return
    const present = await this.presentIds(this.prisma, room)
    if (present.length < 2) return
    const voted = new Set(room.result?.votes.map((v) => v.userId))
    await this.push.notify(
      present.filter((id) => !voted.has(id)),
      'ROOMS',
      room.result
        ? {
            title: 'Résultat à confirmer',
            body: `${this.title(room)} : confirme ou conteste le classement.`,
            url: `/results/${roomId}`,
          }
        : {
            title: 'Qui a gagné ?',
            body: `Saisis le résultat de ${this.title(room)} pour mettre à jour les LK.`,
            url: `/results/${roomId}`,
          },
    )
  }

  /** 48 h après la fin : un résultat non contesté est validé ; sans saisie, la room reste sans résultat. */
  private async expire(roomId: string) {
    await this.prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: roomId }, include: roomInclude })
      if (room?.result?.status === 'PENDING') await this.validate(tx, room, 'CONFIRMED')
    })
  }

  private async room(db: Db, roomId: string) {
    const room = await db.room.findUnique({ where: { id: roomId }, include: roomInclude })
    if (!room) throw new NotFoundException('Room introuvable')
    return room
  }

  private pending(room: ResultRoom) {
    if (!room.result) throw new NotFoundException('Aucun résultat saisi pour cette room')
    return room.result
  }

  /** Joueurs acceptés pointés présents, ou scannés au comptoir du lieu ce soir-là (LKO-77/78). */
  private async presentIds(db: Db, room: ResultRoom) {
    const scanned = room.venueId
      ? await db.visit.findMany({
          where: {
            venueId: room.venueId,
            businessDate: dbDate(businessDate(room.startsAt)),
            source: 'QR_SCAN',
            userId: { in: room.participants.map((p) => p.userId) },
          },
          select: { userId: true },
        })
      : []
    const scannedIds = new Set(scanned.map((v) => v.userId))
    return room.participants
      .filter((p) => p.present === true || scannedIds.has(p.userId))
      .map((p) => p.userId)
  }

  private title(room: ResultRoom) {
    return [room.game.name, formatLabel(room)].filter(Boolean).join(' · ')
  }

  private toView(room: ResultRoom, present: string[], userId: string | null): RoomResult {
    const { result } = room
    const myVote = result?.votes.find((v) => v.userId === userId)
    return {
      roomId: room.id,
      title: this.title(room),
      startsAt: room.startsAt,
      venueName: room.venue?.name ?? null,
      deadline: resultDeadline(room.startsAt),
      players: room.participants
        .filter((p) => present.includes(p.userId))
        .map((p) => ({
          userId: p.userId,
          pseudo: p.user.pseudo,
          avatarUrl: p.user.avatarStatus === 'APPROVED' ? p.user.avatarUrl : null,
          rating: p.user.gameProfiles.find((g) => g.formatId === room.formatId)?.rating ?? 1000,
        })),
      submitRefused:
        result || !userId
          ? null
          : submitRefusal({ ...room, kind: room.game.kind }, present, userId),
      result: result && {
        id: result.id,
        status: result.status,
        placements: result.placements as Placements,
        score: result.score,
        submittedBy: result.submittedBy.pseudo,
        createdAt: result.createdAt,
        accepted: result.votes.filter((v) => v.accepted).length,
        needed: resultMajority(present.length),
        myVote: myVote ? (myVote.accepted ? 'ACCEPTED' : 'DISPUTED') : null,
        disputes: result.votes
          .filter((v) => !v.accepted)
          .map((v) => ({
            pseudo: v.user.pseudo,
            reason: v.reason,
            placements: v.placements as Placements | null,
          })),
        decisionReason: result.decisionReason,
        decidedAt: result.decidedAt,
      },
    }
  }
}
