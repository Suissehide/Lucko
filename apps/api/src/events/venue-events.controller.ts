import { eventCreateSchema, venueEventSchema, venueEventsQuerySchema } from '@lucko/shared'
import { Controller, Get, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { CurrentUser, VenueRoles } from '../auth/auth.decorators'
import { ZodBody, ZodQuery, ZodResponse } from '../common/zod'
import type { User } from '../generated/prisma/client'
import { VenueEventsService } from './venue-events.service'

/**
 * Espace gérant (LKO-61) : tout lieu revendiqué publie ses événements gratuitement, partenaire ou non.
 * Réservé aux gérants du lieu (VenueStaff MANAGER) et aux admins.
 */
@ApiTags('events')
@Controller('venues/:venueId/events')
@VenueRoles('MANAGER')
export class VenueEventsController {
  constructor(private readonly venueEvents: VenueEventsService) {}

  /** À venir ou passés, brouillons et annulés compris. */
  @Get()
  @ZodResponse(z.array(venueEventSchema))
  list(
    @Param('venueId') venueId: string,
    @ZodQuery(venueEventsQuerySchema) { when }: z.output<typeof venueEventsQuerySchema>,
  ) {
    return this.venueEvents.list(venueId, when)
  }

  /** Événement ponctuel, ou série (`recurrence`) : renvoie les dates créées (3 mois au plus). */
  @Post()
  @ZodResponse(z.array(venueEventSchema), 201)
  async create(
    @Param('venueId') venueId: string,
    @ZodBody(eventCreateSchema) body: z.output<typeof eventCreateSchema>,
    @CurrentUser() user: User,
  ) {
    return this.venueEvents.view(await this.venueEvents.create(venueId, body, user))
  }
}
