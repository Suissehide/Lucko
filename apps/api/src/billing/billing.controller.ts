import {
  adminDisputedVisitSchema,
  adminVisitDecisionSchema,
  disputeVisitSchema,
  venueVisitsQuerySchema,
  venueVisitsSchema,
} from '@lucko/shared'
import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Admin } from '../admin/admin.decorators'
import { VenueRoles } from '../auth/auth.decorators'
import { ZodBody, ZodQuery, ZodResponse } from '../common/zod'
import { BillingService } from './billing.service'

/** Venues facturables (LKO-79) : back-office du lieu (gérant) et arbitrage des contestations (admin). */
@ApiTags('billing')
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** Venues facturables du mois et total prévisionnel. */
  @Get('venues/:venueId/visits')
  @VenueRoles('MANAGER')
  @ZodResponse(venueVisitsSchema)
  visits(
    @Param('venueId') venueId: string,
    @ZodQuery(venueVisitsQuerySchema) { month }: z.output<typeof venueVisitsQuerySchema>,
  ) {
    return this.billing.venueVisits(venueId, month)
  }

  /** Contester une venue (14 jours après la soirée au plus). 409 avec le motif sinon. */
  @Post('venues/:venueId/visits/:id/dispute')
  @HttpCode(204)
  @VenueRoles('MANAGER')
  async dispute(
    @Param('venueId') venueId: string,
    @Param('id') id: string,
    @ZodBody(disputeVisitSchema) { reason }: z.output<typeof disputeVisitSchema>,
  ) {
    await this.billing.dispute(venueId, id, reason)
  }

  /** Admin : file des venues contestées par les lieux, à trancher (LKO-146). */
  @Get('admin/visits/disputes')
  @Admin()
  @ZodResponse(z.array(adminDisputedVisitSchema))
  disputes() {
    return this.billing.disputes()
  }

  /** Admin : garder ou annuler une venue (contestée ou non), tracé dans le journal d'audit. */
  @Post('admin/visits/:id/decision')
  @HttpCode(204)
  @Admin('VISIT_DECIDE')
  async decide(
    @Param('id') id: string,
    @ZodBody(adminVisitDecisionSchema) { status }: z.output<typeof adminVisitDecisionSchema>,
  ) {
    await this.billing.decide(id, status)
  }
}
