import {
  adminFeedbackListSchema,
  adminFeedbackQuerySchema,
  adminFeedbackSchema,
  FEEDBACK_STATUSES,
  updateFeedbackSchema,
} from '@lucko/shared'
import { Controller, Get, NotFoundException, Param, Patch } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { z } from 'zod'
import { ZodBody, ZodQuery, ZodResponse } from '../common/zod'
import { statusCounts } from '../feedback/feedback.rules'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { Admin } from './admin.decorators'

// ponytail: 200 retours affichés au plus, paginer si la liste grossit
const LIST_LIMIT = 200

const include = {
  user: { select: { id: true, pseudo: true, email: true, deletedAt: true } },
} as const satisfies Prisma.FeedbackInclude

type FeedbackRow = Prisma.FeedbackGetPayload<{ include: typeof include }>

function toAdminFeedback({ user, userId: _, ...feedback }: FeedbackRow) {
  const deleted = user.deletedAt !== null
  return {
    ...feedback,
    author: {
      id: user.id,
      pseudo: deleted ? null : user.pseudo,
      email: deleted ? null : user.email,
      deleted,
    },
  }
}

/** Retours utilisateurs (LKO-166) : lecture, statut et note interne de l'équipe. */
@ApiTags('admin')
@Controller('admin')
export class AdminFeedbackController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('feedback')
  @Admin()
  @ZodResponse(adminFeedbackListSchema)
  async list(
    @ZodQuery(adminFeedbackQuerySchema) {
      q,
      status,
      category,
    }: z.output<typeof adminFeedbackQuerySchema>,
  ) {
    const contains = { contains: q, mode: 'insensitive' } as const
    const search: Prisma.FeedbackWhereInput = {
      ...(q
        ? {
            OR: [
              { message: contains },
              { adminNote: contains },
              { user: { pseudo: contains } },
              { user: { email: contains } },
            ],
          }
        : {}),
      ...(category ? { category } : {}),
    }
    // Sans filtre de statut : les archivés restent à part
    const where: Prisma.FeedbackWhereInput = {
      ...search,
      status: status ?? { not: 'ARCHIVED' },
    }
    const [items, matching, byStatus] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: LIST_LIMIT,
        include,
      }),
      this.prisma.feedback.count({ where }),
      this.prisma.feedback.groupBy({ by: ['status'], where: search, _count: { _all: true } }),
    ])
    return {
      items: items.map(toAdminFeedback),
      matching,
      counts: statusCounts(
        FEEDBACK_STATUSES,
        byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      ),
    }
  }

  @Patch('feedback/:id')
  @Admin('FEEDBACK_UPDATE')
  @ZodResponse(adminFeedbackSchema)
  async update(
    @Param('id') id: string,
    @ZodBody(updateFeedbackSchema) body: z.output<typeof updateFeedbackSchema>,
  ) {
    const exists = await this.prisma.feedback.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw new NotFoundException('Retour introuvable')
    return toAdminFeedback(
      await this.prisma.feedback.update({ where: { id }, data: body, include }),
    )
  }
}
