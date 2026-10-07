import {
  eventCancelSchema,
  eventDetailSchema,
  eventUpdateSchema,
  reportSchema,
  venueEventSchema,
} from '@lucko/shared'
import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { CurrentUser, Public } from '../auth/auth.decorators'
import { ZodBody, ZodResponse } from '../common/zod'
import type { User } from '../generated/prisma/client'
import { EventsService } from './events.service'
import { VenueEventsService } from './venue-events.service'

/** Fiche événement (B4), inscription dans l'app, et gestion d'une date par le gérant du lieu (LKO-61). */
@ApiTags('events')
@Controller('events/:id')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly venueEvents: VenueEventsService,
  ) {}

  /** Public ; si le joueur est connecté, la réponse dit s'il est inscrit. */
  @Public()
  @Get()
  @ZodResponse(eventDetailSchema)
  detail(@Param('id') id: string, @CurrentUser() user?: User) {
    return this.events.detail(id, user)
  }

  /** S'inscrire : inscrit, ou en liste d'attente si c'est complet. 409 si l'inscription est impossible. */
  @Post('registration')
  @ZodResponse(eventDetailSchema)
  register(@Param('id') id: string, @CurrentUser() user: User) {
    return this.events.register(id, user)
  }

  @Delete('registration')
  @ZodResponse(eventDetailSchema)
  cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.events.cancel(id, user)
  }

  /**
   * Gérant du lieu : modifie cette date (`scope: occurrence`) ou la série et ses dates à venir
   * (`scope: series`). Un changement d'horaire prévient les inscrits (push + e-mail).
   */
  @Patch()
  @ZodResponse(z.array(venueEventSchema))
  async update(
    @Param('id') id: string,
    @ZodBody(eventUpdateSchema) body: z.output<typeof eventUpdateSchema>,
    @CurrentUser() user: User,
  ) {
    return this.venueEvents.view(await this.venueEvents.update(id, body, user))
  }

  /** Gérant du lieu : annule cette date, ou avec `series` toute la suite de la série. */
  @Post('cancel')
  @HttpCode(204)
  @ApiNoContentResponse()
  async cancelEvent(
    @Param('id') id: string,
    @ZodBody(eventCancelSchema) { series }: z.output<typeof eventCancelSchema>,
    @CurrentUser() user: User,
  ) {
    await this.venueEvents.stop(id, user, series, 'CANCELLED')
  }

  /** Signaler un événement (contenu trompeur, inapproprié…) : rejoint la file des admins. */
  @Post('report')
  @HttpCode(204)
  @ApiNoContentResponse()
  async report(
    @Param('id') id: string,
    @ZodBody(reportSchema) body: z.output<typeof reportSchema>,
    @CurrentUser() user: User,
  ) {
    await this.venueEvents.report(id, user, body)
  }
}
