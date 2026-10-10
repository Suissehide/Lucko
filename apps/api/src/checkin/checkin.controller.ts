import { qrTokenSchema, scanBodySchema, scanResultSchema } from '@lucko/shared'
import { Controller, HttpCode, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { z } from 'zod'
import { CurrentUser, VenueRoles } from '../auth/auth.decorators'
import { ZodBody, ZodResponse } from '../common/zod'
import type { User } from '../generated/prisma/client'
import { CheckinService } from './checkin.service'

/** QR Lucko (LKO-77) : jeton du joueur et scan au comptoir. */
@ApiTags('checkin')
@Controller()
export class CheckinController {
  constructor(private readonly checkin: CheckinService) {}

  /** Nouveau jeton pour l'écran « Mon QR Lucko », valable une minute. */
  @Post('me/qr-token')
  @HttpCode(200)
  @ZodResponse(qrTokenSchema)
  token(@CurrentUser() user: User) {
    return this.checkin.token(user.id)
  }

  /** Scan au comptoir par le staff d'un lieu partenaire : venue du soir et avantage à accorder. */
  @Post('venues/:venueId/scan')
  @HttpCode(200)
  @VenueRoles('MANAGER', 'STAFF')
  @ZodResponse(scanResultSchema)
  scan(
    @Param('venueId') venueId: string,
    @ZodBody(scanBodySchema) body: z.output<typeof scanBodySchema>,
  ) {
    return this.checkin.scan(venueId, body.token)
  }
}
