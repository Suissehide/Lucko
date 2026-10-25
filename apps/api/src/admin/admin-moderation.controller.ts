import {
  ADMIN_USER_FILTERS,
  type AdminActionKind,
  type AdminUserFilter,
  adminActionSchema,
  adminDashboardSchema,
  adminReasonSchema,
  adminReportSchema,
  adminUserDetailSchema,
  adminUserListSchema,
  adminUserQuerySchema,
  ageOn,
  pendingAvatarSchema,
  type ReportResolution,
  resolveReportSchema,
  suspendSchema,
} from '@lucko/shared'
import { Controller, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common'
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodBody, ZodQuery, ZodResponse } from '../common/zod'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { StorageService } from '../storage/storage.service'
import { Admin } from './admin.decorators'
import { isSuspended } from './admin.rules'
import { AdminService } from './admin.service'

// ponytail: listes limitées (200 signalements, 50 joueurs, 100 actions), paginer si elles grossissent
const QUEUE_LIMIT = 200
const SEARCH_LIMIT = 50
const ACTIONS_LIMIT = 100

const RESOLUTION_ACTION: Record<ReportResolution, AdminActionKind> = {
  DISMISSED: 'REPORT_DISMISS',
  WARNED: 'REPORT_WARN',
  SUSPENDED: 'REPORT_SUSPEND',
}

const isMinor = (birthDate: Date | null) => birthDate !== null && ageOn(birthDate) < 18

const openReports = { _count: { select: { reportsReceived: { where: { resolvedAt: null } } } } }
const userSelect = {
  id: true,
  pseudo: true,
  email: true,
  role: true,
  birthDate: true,
  createdAt: true,
  suspendedAt: true,
  suspendedUntil: true,
  suspendedReason: true,
  ...openReports,
} satisfies Prisma.UserSelect

function toAdminUser({
  birthDate,
  suspendedAt,
  suspendedUntil,
  suspendedReason,
  _count,
  ...user
}: Prisma.UserGetPayload<{ select: typeof userSelect }>) {
  return {
    ...user,
    minor: isMinor(birthDate),
    suspension:
      suspendedAt && isSuspended({ suspendedAt, suspendedUntil })
        ? { at: suspendedAt, until: suspendedUntil, reason: suspendedReason ?? '' }
        : null,
    openReports: _count.reportsReceived,
  }
}

const actionInclude = { admin: { select: { id: true, pseudo: true } } }

const suspendedNow = (now: Date) =>
  ({
    suspendedAt: { not: null },
    OR: [{ suspendedUntil: null }, { suspendedUntil: { gt: now } }],
  }) satisfies Prisma.UserWhereInput

// Même règle que ageOn : date de naissance (en UTC) après la date du jour d'il y a 18 ans
const urgent = (report: { reason: string; target: { minor: boolean } }) =>
  report.target.minor || report.reason === 'SAFETY' || report.reason === 'MINOR_SAFETY'

const minorSince = (now: Date) =>
  new Date(Date.UTC(now.getFullYear() - 18, now.getMonth(), now.getDate()))

function userFilter(filter: AdminUserFilter, now: Date): Prisma.UserWhereInput {
  switch (filter) {
    case 'all':
      return {}
    case 'reported':
      return { reportsReceived: { some: { resolvedAt: null } } }
    case 'minor':
      return { birthDate: { gt: minorSince(now) } }
    case 'suspended':
      return suspendedNow(now)
    case 'staff':
      return { role: { not: 'PLAYER' } }
  }
}

/** Back-office (LKO-20) : tableau de bord, signalements, joueurs, suspensions, photos de profil, journal. */
@ApiTags('admin')
@Controller('admin')
export class AdminModerationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: AdminService,
    private readonly storage: StorageService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get('dashboard')
  @Admin()
  @ZodResponse(adminDashboardSchema)
  async dashboard() {
    const now = new Date()
    const pendingAvatar = {
      avatarStatus: 'PENDING',
      avatarUrl: { not: null },
      deletedAt: null,
    } as const
    const [
      open,
      pendingAvatars,
      oldestAvatar,
      pendingVenues,
      suspendedPlayers,
      disputedResults,
      disputedVisits,
    ] = await Promise.all([
      this.prisma.report.findMany({
        where: { resolvedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, target: { select: { birthDate: true } } },
      }),
      this.prisma.user.count({ where: pendingAvatar }),
      this.prisma.user.findFirst({
        where: pendingAvatar,
        orderBy: { updatedAt: 'asc' },
        select: { updatedAt: true },
      }),
      this.prisma.venue.findMany({
        where: { status: 'PENDING' },
        orderBy: { name: 'asc' },
        select: { name: true },
      }),
      this.prisma.user.count({ where: suspendedNow(now) }),
      this.prisma.matchResult.count({ where: { status: 'DISPUTED' } }),
      this.prisma.visit.count({ where: { status: 'DISPUTED' } }),
    ])
    return {
      openReports: open.length,
      minorReports: open.filter((r) => isMinor(r.target.birthDate)).length,
      pendingAvatars,
      pendingVenues: pendingVenues.length,
      suspendedPlayers,
      disputedResults,
      disputedVisits,
      oldestReportAt: open[0]?.createdAt ?? null,
      oldestAvatarAt: oldestAvatar?.updatedAt ?? null,
      pendingVenueNames: pendingVenues.slice(0, 3).map((v) => v.name),
    }
  }

  /**
   * File des signalements ouverts : ceux qui visent un mineur ou touchent à la sécurité (LKO-72) d'abord,
   * puis du plus ancien.
   */
  @Get('reports')
  @Admin()
  @ZodResponse(z.array(adminReportSchema))
  async reports() {
    const reports = await this.prisma.report.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: 'asc' },
      take: QUEUE_LIMIT,
      include: {
        reporter: { select: { id: true, pseudo: true } },
        target: { select: { id: true, pseudo: true, birthDate: true, ...openReports } },
      },
    })
    return reports
      .map(({ target: { birthDate, _count, ...target }, ...report }) => ({
        ...report,
        target: { ...target, minor: isMinor(birthDate), openReports: _count.reportsReceived },
      }))
      .sort((a, b) => Number(urgent(b)) - Number(urgent(a)))
  }

  /**
   * Traite un signalement : classé, averti (notification au joueur) ou suspendu. Une suspension
   * clôt aussi les autres signalements ouverts sur ce joueur.
   */
  @Post('reports/:id/resolve')
  @Admin((body) => RESOLUTION_ACTION[body.resolution as ReportResolution])
  @HttpCode(204)
  @ApiNoContentResponse()
  async resolve(
    @Param('id') id: string,
    @ZodBody(resolveReportSchema) body: z.output<typeof resolveReportSchema>,
  ) {
    const targetId = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.findFirst({ where: { id, resolvedAt: null } })
      if (!report) throw new NotFoundException('Signalement introuvable ou déjà traité')
      const resolved = { resolvedAt: new Date(), resolution: body.resolution }
      await tx.report.update({ where: { id }, data: resolved })
      if (body.resolution === 'WARNED') await this.admin.warn(report.targetId, body.reason, tx)
      if (body.resolution === 'SUSPENDED') {
        await this.admin.suspend(report.targetId, body, tx)
        await tx.report.updateMany({
          where: { targetId: report.targetId, resolvedAt: null },
          data: resolved,
        })
      }
      return report.targetId
    })
    if (body.resolution === 'SUSPENDED') this.realtime.disconnectUser(targetId)
  }

  @Get('users')
  @Admin()
  @ZodResponse(adminUserListSchema)
  async users(
    @ZodQuery(adminUserQuerySchema) { q, filter }: z.output<typeof adminUserQuerySchema>,
  ) {
    const now = new Date()
    const contains = { contains: q, mode: 'insensitive' } as const
    const search: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(q ? { OR: [{ id: q }, { pseudo: contains }, { email: contains }] } : {}),
    }
    const [users, ...counts] = await Promise.all([
      this.prisma.user.findMany({
        where: { AND: [search, userFilter(filter, now)] },
        orderBy: { createdAt: 'desc' },
        take: SEARCH_LIMIT,
        select: userSelect,
      }),
      ...ADMIN_USER_FILTERS.map((f) =>
        this.prisma.user.count({ where: { AND: [search, userFilter(f, now)] } }),
      ),
    ])
    return {
      users: users.map(toAdminUser),
      counts: Object.fromEntries(ADMIN_USER_FILTERS.map((f, i) => [f, counts[i] ?? 0])),
    }
  }

  /** Fiche joueur : signalements reçus et actions des admins sur lui ou sur ces signalements. */
  @Get('users/:id')
  @Admin()
  @ZodResponse(adminUserDetailSchema)
  async user(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...userSelect,
        avatarUrl: true,
        avatarStatus: true,
        deletedAt: true,
        reportsReceived: {
          orderBy: { createdAt: 'desc' },
          include: { reporter: { select: { id: true, pseudo: true } } },
        },
      },
    })
    if (!user) throw new NotFoundException('Joueur introuvable')
    const { reportsReceived, deletedAt, ...rest } = user
    const actions = await this.admin.withTargets(
      await this.prisma.adminAction.findMany({
        where: { targetId: { in: [id, ...reportsReceived.map((r) => r.id)] } },
        orderBy: { createdAt: 'desc' },
        include: actionInclude,
      }),
    )
    return {
      ...toAdminUser(rest),
      avatarUrl: rest.avatarUrl,
      avatarStatus: rest.avatarStatus,
      deleted: deletedAt !== null,
      reports: reportsReceived,
      actions,
    }
  }

  @Post('users/:id/suspend')
  @Admin('USER_SUSPEND')
  @HttpCode(204)
  @ApiNoContentResponse()
  async suspend(
    @Param('id') id: string,
    @ZodBody(suspendSchema) body: z.output<typeof suspendSchema>,
  ) {
    await this.prisma.$transaction((tx) => this.admin.suspend(id, body, tx))
    this.realtime.disconnectUser(id)
  }

  @Post('users/:id/unsuspend')
  @Admin('USER_UNSUSPEND')
  @HttpCode(204)
  @ApiNoContentResponse()
  async unsuspend(
    @Param('id') id: string,
    @ZodBody(adminReasonSchema) _body: z.output<typeof adminReasonSchema>,
  ) {
    await this.admin.unsuspend(id)
  }

  /** Photos de profil à valider, des plus anciennes demandes aux plus récentes. */
  @Get('avatars')
  @Admin()
  @ZodResponse(z.array(pendingAvatarSchema))
  async avatars() {
    const users = await this.prisma.user.findMany({
      where: { avatarStatus: 'PENDING', avatarUrl: { not: null }, deletedAt: null },
      orderBy: { updatedAt: 'asc' },
      take: QUEUE_LIMIT,
      select: { id: true, pseudo: true, avatarUrl: true, updatedAt: true },
    })
    return users.map(({ updatedAt, ...user }) => ({ ...user, submittedAt: updatedAt }))
  }

  /** `:id` = le joueur. Approuvée, la photo devient visible des autres joueurs. */
  @Post('avatars/:id/approve')
  @Admin('AVATAR_APPROVE')
  @HttpCode(204)
  @ApiNoContentResponse()
  async approveAvatar(@Param('id') id: string) {
    await this.reviewAvatar(id, 'APPROVED')
  }

  /** Refusée, la photo est retirée : le joueur garde son initiale. */
  @Post('avatars/:id/reject')
  @Admin('AVATAR_REJECT')
  @HttpCode(204)
  @ApiNoContentResponse()
  async rejectAvatar(
    @Param('id') id: string,
    @ZodBody(adminReasonSchema) _body: z.output<typeof adminReasonSchema>,
  ) {
    await this.reviewAvatar(id, 'REJECTED')
  }

  private async reviewAvatar(id: string, status: 'APPROVED' | 'REJECTED') {
    const pending = await this.prisma.user.findFirst({
      where: { id, avatarStatus: 'PENDING' },
      select: { avatarUrl: true },
    })
    const { count } = await this.prisma.user.updateMany({
      // Même photo qu'à la lecture : le joueur a pu en envoyer une autre entre-temps
      where: { id, avatarStatus: 'PENDING', avatarUrl: pending?.avatarUrl },
      data: { avatarStatus: status, ...(status === 'REJECTED' ? { avatarUrl: null } : {}) },
    })
    if (!count) throw new NotFoundException('Aucune photo en attente pour ce joueur')
    if (status === 'REJECTED') await this.storage.remove(pending?.avatarUrl ?? null)
  }

  /** Journal d'audit : dernières actions des admins. */
  @Get('actions')
  @Admin()
  @ZodResponse(z.array(adminActionSchema))
  async actions() {
    return this.admin.withTargets(
      await this.prisma.adminAction.findMany({
        orderBy: { createdAt: 'desc' },
        take: ACTIONS_LIMIT,
        include: actionInclude,
      }),
    )
  }
}
