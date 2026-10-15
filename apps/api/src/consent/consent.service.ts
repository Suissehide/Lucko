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
import {
  consentDeadline,
  consentKey,
  consentMail,
  reminderTimes,
  signConsentToken,
  verifyConsentToken,
} from './consent.rules'

const REMINDER_JOB = 'consent.reminder'
const EXPIRE_JOB = 'consent.expire-accounts'
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
  ) {}

  async onModuleInit() {
    await this.jobs.handle<{ consentId: string }>(REMINDER_JOB, ({ consentId }) =>
      this.remind(consentId),
    )
    await this.jobs.handle(EXPIRE_JOB, () => this.expireAccounts(), { cron: '0 5 * * *' })
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
