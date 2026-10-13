import {
  disputeResultSchema,
  resultDecisionSchema,
  roomResultSchema,
  submitResultSchema,
  voidResultSchema,
} from '@lucko/shared'
import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Admin } from '../admin/admin.decorators'
import { CurrentUser, VenueRoles } from '../auth/auth.decorators'
import { ZodBody, ZodResponse } from '../common/zod'
import type { User } from '../generated/prisma/client'
import { ResultsService } from './results.service'

/** Résultats des rooms classées (LKO-83) : saisie et vote des présents, arbitrage du lieu ou d'un admin. */
@ApiTags('rooms')
@Controller()
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  /** Résultat d'une room, avec les présents et ce que je peux faire. 403 hors des joueurs de la room. */
  @Get('rooms/:id/result')
  @ZodResponse(roomResultSchema)
  view(@Param('id') id: string, @CurrentUser() user: User) {
    return this.results.view(id, user)
  }

  /**
   * Saisir le classement des présents. 409 avec le motif (room normale, pas finie, délai, absent) ;
   * s'il y a déjà un résultat, la saisie devient une contre-proposition qui le conteste.
   */
  @Post('rooms/:id/result')
  @ZodResponse(roomResultSchema)
  submit(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @ZodBody(submitResultSchema) input: z.output<typeof submitResultSchema>,
  ) {
    return this.results.submit(id, user, input)
  }

  /** Confirmer le résultat saisi : validé (et LK mis à jour) dès que la majorité des présents confirme. */
  @Post('rooms/:id/result/confirm')
  @ZodResponse(roomResultSchema)
  confirm(@Param('id') id: string, @CurrentUser() user: User) {
    return this.results.confirm(id, user)
  }

  /** Contester, avec un motif et éventuellement son propre classement. */
  @Post('rooms/:id/result/dispute')
  @ZodResponse(roomResultSchema)
  dispute(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @ZodBody(disputeResultSchema) input: z.output<typeof disputeResultSchema>,
  ) {
    return this.results.dispute(id, user, input)
  }

  /** Back-office lieu partenaire : contestations de ses rooms. */
  @Get('venues/:venueId/results/disputes')
  @VenueRoles('MANAGER', 'STAFF')
  @ZodResponse(z.array(roomResultSchema))
  venueDisputes(@Param('venueId') venueId: string) {
    return this.results.disputes(venueId)
  }

  /** Le lieu tranche : un classement, ou sans résultat. */
  @Post('venues/:venueId/results/:roomId/decision')
  @HttpCode(204)
  @VenueRoles('MANAGER', 'STAFF')
  async venueDecide(
    @Param('venueId') venueId: string,
    @Param('roomId') roomId: string,
    @CurrentUser() user: User,
    @ZodBody(resultDecisionSchema) input: z.output<typeof resultDecisionSchema>,
  ) {
    await this.results.decide(roomId, user, input, venueId)
  }

  /** Admin : toutes les contestations en cours (le lieu partenaire tranche d'abord les siennes). */
  @Get('admin/results/disputes')
  @Admin()
  @ZodResponse(z.array(roomResultSchema))
  adminDisputes() {
    return this.results.disputes()
  }

  /** Admin : trancher une contestation (`:id` = room), tracé dans le journal d'audit. */
  @Post('admin/results/:id/decision')
  @HttpCode(204)
  @Admin('RESULT_DECIDE')
  async adminDecide(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @ZodBody(resultDecisionSchema) input: z.output<typeof resultDecisionSchema>,
  ) {
    await this.results.decide(id, user, input)
  }

  /** Admin : annuler un résultat ; s'il était validé, les LK de la room sont retirés. */
  @Post('admin/results/:id/void')
  @HttpCode(204)
  @Admin('RESULT_VOID')
  async adminVoid(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @ZodBody(voidResultSchema) { reason }: z.output<typeof voidResultSchema>,
  ) {
    await this.results.void(id, user, reason)
  }
}
