import {
  type EventsQuery,
  eventListItemSchema,
  eventsQuerySchema,
  type MapVenuesQuery,
  mapVenueSchema,
  mapVenuesQuerySchema,
  roomListItemSchema,
  type VenuesQuery,
  venueDetailSchema,
  venueListItemSchema,
  venuesQuerySchema,
} from '@lucko/shared'
import { Controller, Get, Param } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { CurrentUser, Public } from '../auth/auth.decorators'
import { ZodQuery, ZodResponse } from '../common/zod'
import type { User } from '../generated/prisma/client'
import { ExploreService } from './explore.service'

/**
 * « Où jouer ce soir » (B1 carte, B2 liste). Public : aussi utilisé par le site web.
 * Joueur connecté : règles mineurs appliquées (rooms 18+ ou à domicile, événements avec âge minimum).
 */
@ApiTags('explore')
@Public()
@Controller()
export class ExploreController {
  constructor(private readonly explore: ExploreService) {}

  /** Lieux autour d'un point, du plus proche au plus loin (partenaires en premier à distance égale). */
  @Get('venues')
  @ZodResponse(z.array(venueListItemSchema))
  venues(@ZodQuery(venuesQuerySchema) query: VenuesQuery, @CurrentUser() user?: User) {
    return this.explore.venues(query, user ?? null)
  }

  /** Épingles de la zone affichée par la carte (LKO-122), regroupées côté client. */
  @Get('map/venues')
  @ZodResponse(z.array(mapVenueSchema))
  mapVenues(@ZodQuery(mapVenuesQuerySchema) query: MapVenuesQuery) {
    return this.explore.mapVenues(query)
  }

  /** Fiche lieu (B3). */
  @Get('venues/:slug')
  @ZodResponse(venueDetailSchema)
  venue(@Param('slug') slug: string, @CurrentUser() user?: User) {
    return this.explore.venue(slug, user ?? null)
  }

  /** Événements des prochains jours autour d'un point, par date puis distance. */
  @Get('events')
  @ZodResponse(z.array(eventListItemSchema))
  events(@ZodQuery(eventsQuerySchema) query: EventsQuery, @CurrentUser() user?: User) {
    return this.explore.events(query, user ?? null)
  }

  /** Rooms ouvertes ; celles des joueurs bloqués (dans un sens ou l'autre) sont masquées. */
  @Get('rooms')
  @ZodResponse(z.array(roomListItemSchema))
  rooms(@ZodQuery(eventsQuerySchema) query: EventsQuery, @CurrentUser() user?: User) {
    return this.explore.rooms(query, user ?? null)
  }
}
