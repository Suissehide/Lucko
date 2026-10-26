import {
  ageOn,
  DIGITAL_MAJORITY_AGE,
  PARENTAL_CONSENT_DAYS,
  PRIVACY_POLICY_VERSION,
} from '@lucko/shared'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common'
import { needsParentalConsent } from '../common/minors.rules'
import { loadEnv } from '../config/env'
import type { User } from '../generated/prisma/client'
import { JobsService } from '../jobs/jobs.service'
import { MailService } from '../mail/mail.service'
import { PrismaService } from '../prisma/prisma.service'
import { UsersService } from '../users/users.service'
import {
  consentDeadline,
  consentKey,
  consentMail,
  fifteenthBirthdays,
  parentEmailRefusal,
  reminderTimes,
  resendRefusal,
  signConsentToken,
  turnedFifteenMail,
  verifyConsentToken,
  withdrawnChildMail,
  withdrawnParentMail,
} from './consent.rules'

const REMINDER_JOB = 'consent.reminder'
const EXPIRE_JOB = 'consent.expire-accounts'
const TURNED_15_JOB = 'consent.turned-15'
/** Dernières rooms, soirées et signalements montrés au parent, par type. */
const ACTIVITY_LIMIT = 30
const ADULT_AGE = 18
const DAY_MS = 24 * 60 * 60 * 1000
const INVALID_LINK =
  'Ce lien n’est plus valable : demandez à votre enfant de renvoyer l’e-mail depuis l’app'

/** Accord parental des 13-14 ans (LKO-49) : demande, e-mail au parent, accord, comptes expirés. */
@Injectable()
export class ConsentService implements OnModuleInit {
  private readonly logger = new Logger(ConsentService.name)
  private readonly env = loadEnv()
  private readonly key = consentKey(this.env.BETTER_AUTH_SECRET)

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly jobs: JobsService,
    private readonly users: UsersService,
  ) {}

  async onModuleInit() {
    await this.jobs.handle<{ consentId: string }>(REMINDER_JOB, ({ consentId }) =>
      this.remind(consentId),
    )
    await this.jobs.handle(EXPIRE_JOB, () => this.expireAccounts(), { cron: '0 5 * * *' })
    await this.jobs.handle(TURNED_15_JOB, () => this.notifyTurnedFifteen(), { cron: '0 9 * * *' })
  }

  /** Enfants liés au parent et leur activité (rooms, soirées, signalements), jamais leurs messages. */
  async children(parent: User) {
    const now = new Date()
    const kids = await this.prisma.user.findMany({
      where: { parentId: parent.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })
    return Promise.all(kids.map((kid) => this.activity(kid, now)))
  }

  private async activity(kid: User, now: Date) {
    const age = kid.birthDate ? ageOn(kid.birthDate, now) : 0
    const autonomous = age >= DIGITAL_MAJORITY_AGE
    const base = {
      id: kid.id,
      pseudo: kid.pseudo,
      email: kid.email,
      age,
      consentAt: kid.parentalConsentAt ?? kid.createdAt,
      autonomous,
    }
    if (autonomous) return { ...base, rooms: [], events: [], reports: [] }
    const [rooms, events, reports] = await Promise.all([
      this.prisma.roomParticipant.findMany({
        where: { userId: kid.id },
        orderBy: { room: { startsAt: 'desc' } },
        take: ACTIVITY_LIMIT,
        select: {
          status: true,
          room: {
            select: {
              id: true,
              startsAt: true,
              game: { select: { name: true } },
              venue: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.eventRegistration.findMany({
        where: { userId: kid.id },
        orderBy: { event: { startsAt: 'desc' } },
        take: ACTIVITY_LIMIT,
        select: {
          event: {
            select: { id: true, title: true, startsAt: true, venue: { select: { name: true } } },
          },
        },
      }),
      this.prisma.report.findMany({
        where: { OR: [{ reporterId: kid.id }, { targetId: kid.id }] },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_LIMIT,
        select: { id: true, reporterId: true, reason: true, createdAt: true, resolvedAt: true },
      }),
    ])
    return {
      ...base,
      rooms: rooms.map(({ status, room }) => ({
        id: room.id,
        game: room.game.name,
        place: room.venue?.name ?? 'À domicile',
        startsAt: room.startsAt,
        status,
      })),
      events: events.map(({ event }) => ({
        id: event.id,
        title: event.title,
        venue: event.venue.name,
        startsAt: event.startsAt,
      })),
      reports: reports.map((report) => ({
        id: report.id,
        direction: report.reporterId === kid.id ? ('MADE' as const) : ('RECEIVED' as const),
        reason: report.reason,
        createdAt: report.createdAt,
        handled: report.resolvedAt !== null,
      })),
    }
  }

  /**
   * Retrait de l'accord par le parent : le compte de l'enfant est supprimé (anonymisé) tout de suite,
   * la demande garde la trace du retrait. Plus possible à 15 ans : le compte ne dépend plus du parent.
   */
  async withdraw(parent: User, childId: string) {
    const child = await this.prisma.user.findFirst({
      where: { id: childId, parentId: parent.id, deletedAt: null },
    })
    if (!child) throw new NotFoundException('Enfant introuvable')
    const name = child.pseudo ?? child.email
    if (!child.birthDate || ageOn(child.birthDate) >= DIGITAL_MAJORITY_AGE)
      throw new ConflictException(`${name} a 15 ans : son compte ne dépend plus de votre accord`)
    await this.users.deleteAccount(child)
    await this.prisma.parentalConsent.updateMany({
      where: { childId, status: 'GRANTED' },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
    })
    await this.mail.send({ to: child.email, ...withdrawnChildMail() })
    await this.mail.send({ to: parent.email, ...withdrawnParentMail(name) })
  }

  async mine(child: User) {
    const last = await this.prisma.parentalConsent.findFirst({
      where: { childId: child.id },
      orderBy: { createdAt: 'desc' },
    })
    return {
      parentEmail: last?.parentEmail ?? null,
      granted: child.parentalConsentAt !== null,
      deadline: consentDeadline(child.createdAt),
    }
  }

  /** Nouvelle demande : elle remplace la précédente (autre e-mail, ou e-mail renvoyé). */
  async request(child: User, parentEmail: string) {
    if (!needsParentalConsent(child))
      throw new ConflictException('Ton compte n’a pas besoin de l’accord d’un parent')
    if (parentEmail === child.email)
      throw new BadRequestException('Indique l’e-mail d’un parent, pas le tien')
    const now = new Date()
    const last = await this.prisma.parentalConsent.findFirst({
      where: { childId: child.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: { parentEmail: true, createdAt: true },
    })
    const tooSoon = resendRefusal(last, parentEmail, now)
    if (tooSoon) throw new HttpException(tooSoon, HttpStatus.TOO_MANY_REQUESTS)
    const deadline = consentDeadline(child.createdAt)
    await this.prisma.$transaction(async (tx) => {
      await tx.parentalConsent.deleteMany({ where: { childId: child.id, status: 'PENDING' } })
      const consent = await tx.parentalConsent.create({
        data: { childId: child.id, parentEmail },
      })
      await this.mail.send(
        { to: parentEmail, ...consentMail(child.email, this.link(consent.id, deadline), deadline) },
        tx,
      )
      for (const at of reminderTimes(now, deadline))
        await this.jobs.send(REMINDER_JOB, { consentId: consent.id }, { startAfter: at }, tx)
    })
    return this.mine(child)
  }

  /** Ce que voit le parent en ouvrant le lien. */
  async show(token: string) {
    const consent = await this.find(token)
    return {
      childEmail: consent.child.email,
      parentEmail: consent.parentEmail,
      childAge: consent.child.birthDate ? ageOn(consent.child.birthDate) : 0,
      status: consent.status,
      deadline: consentDeadline(consent.child.createdAt),
    }
  }

  /**
   * Accord du parent connecté : majeur, autre compte que l'enfant. Garde la preuve (version de la
   * politique, IP, navigateur) et signale une IP déjà vue sur une session de l'enfant.
   */
  async grant(token: string, parent: User, proof: { ip: string | null; userAgent: string | null }) {
    const consent = await this.find(token)
    if (consent.status === 'GRANTED') {
      if (consent.parentId === parent.id) return
      throw new ConflictException('Un parent a déjà donné son accord pour ce compte')
    }
    if (parent.id === consent.childId)
      throw new ForbiddenException('Ce lien est réservé à ton parent')
    if (!parent.birthDate || ageOn(parent.birthDate) < ADULT_AGE)
      throw new ForbiddenException('Seul un adulte peut donner son accord')
    const wrongAccount = parentEmailRefusal(parent.email, consent.parentEmail)
    if (wrongAccount) throw new ForbiddenException(wrongAccount)
    const now = new Date()
    const sameDeviceSuspected =
      proof.ip !== null &&
      (await this.prisma.session.count({
        where: { userId: consent.childId, ipAddress: proof.ip },
      })) > 0
    if (sameDeviceSuspected)
      this.logger.warn(`Accord parental ${consent.id} donné depuis une IP de l’enfant`)
    await this.prisma.$transaction([
      this.prisma.parentalConsent.update({
        where: { id: consent.id },
        data: {
          status: 'GRANTED',
          parentId: parent.id,
          grantedAt: now,
          policyVersion: PRIVACY_POLICY_VERSION,
          ip: proof.ip,
          userAgent: proof.userAgent,
          sameDeviceSuspected,
        },
      }),
      this.prisma.user.update({
        where: { id: consent.childId },
        data: { parentId: parent.id, parentalConsentAt: now },
      }),
    ])
  }

  private link(consentId: string, deadline: Date) {
    return `${this.env.APP_URL}/consent/${signConsentToken(this.key, consentId, deadline)}`
  }

  private async find(token: string) {
    const id = verifyConsentToken(this.key, token)
    // Demande remplacée par une plus récente, ou compte supprimé : le lien ne vaut plus
    const consent = id
      ? await this.prisma.parentalConsent.findUnique({
          where: { id },
          include: { child: true },
        })
      : null
    if (!consent || consent.child.deletedAt) throw new NotFoundException(INVALID_LINK)
    return consent
  }

  private async remind(consentId: string) {
    const consent = await this.prisma.parentalConsent.findUnique({
      where: { id: consentId },
      include: { child: true },
    })
    if (consent?.status !== 'PENDING' || !needsParentalConsent(consent.child)) return
    const deadline = consentDeadline(consent.child.createdAt)
    await this.mail.send({
      to: consent.parentEmail,
      ...consentMail(consent.child.email, this.link(consent.id, deadline), deadline, true),
    })
  }

  /** Enfants liés qui ont 15 ans aujourd'hui : leur parent est prévenu que le compte devient autonome. */
  private async notifyTurnedFifteen() {
    const kids = await this.prisma.user.findMany({
      where: {
        parentId: { not: null },
        deletedAt: null,
        birthDate: { in: fifteenthBirthdays() },
      },
      select: { pseudo: true, email: true, parent: { select: { email: true, deletedAt: true } } },
    })
    for (const kid of kids)
      if (kid.parent && !kid.parent.deletedAt)
        await this.mail.send({
          to: kid.parent.email,
          ...turnedFifteenMail(kid.pseudo ?? kid.email),
        })
  }

  /** Comptes 13-14 ans sans accord après le délai : supprimés (ils n'ont rien pu faire entre-temps). */
  private async expireAccounts() {
    const now = new Date()
    const bornAfter = new Date(
      Date.UTC(now.getUTCFullYear() - DIGITAL_MAJORITY_AGE, now.getUTCMonth(), now.getUTCDate()),
    )
    const candidates = await this.prisma.user.findMany({
      where: {
        parentalConsentAt: null,
        deletedAt: null,
        birthDate: { gte: bornAfter },
        createdAt: { lt: new Date(now.getTime() - PARENTAL_CONSENT_DAYS * DAY_MS) },
      },
      select: { id: true, birthDate: true, parentalConsentAt: true },
    })
    for (const user of candidates.filter((u) => needsParentalConsent(u, now))) {
      try {
        await this.prisma.user.delete({ where: { id: user.id } })
        this.logger.log(`Compte ${user.id} sans accord parental supprimé`)
      } catch (error) {
        this.logger.error(`Compte ${user.id} sans accord parental : suppression impossible`, error)
      }
    }
  }
}
