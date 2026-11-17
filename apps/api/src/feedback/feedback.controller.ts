import { sendFeedbackSchema } from '@lucko/shared'
import { Controller, HttpCode, HttpException, HttpStatus, Post } from '@nestjs/common'
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger'
import type { z } from 'zod'
import { CurrentUser } from '../auth/auth.decorators'
import { ZodBody } from '../common/zod'
import type { User } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { feedbackRateLimited, rateWindowStart } from './feedback.rules'

/**
 * Retours utilisateurs (LKO-166) : un joueur ou un gérant connecté envoie un bug ou une idée depuis
 * l'app ; l'équipe les lit dans le back-office (admin/admin-feedback.controller.ts).
 */
@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(204)
  @ApiNoContentResponse()
  async send(
    @CurrentUser() user: User,
    @ZodBody(sendFeedbackSchema) body: z.output<typeof sendFeedbackSchema>,
  ) {
    const now = new Date()
    const recent = await this.prisma.feedback.count({
      where: { userId: user.id, createdAt: { gte: rateWindowStart(now) } },
    })
    if (feedbackRateLimited(recent))
      throw new HttpException(
        'Merci pour tous ces retours ! Réessaie dans quelques minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    await this.prisma.feedback.create({ data: { ...body, userId: user.id } })
  }
}
