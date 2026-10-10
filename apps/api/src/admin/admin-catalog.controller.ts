import {
  addDays,
  adminEventInputSchema,
  adminEventSchema,
  adminEventUpdateSchema,
  adminGameSchema,
  adminVenueQuerySchema,
  adminVenueSchema,
  cancelEventSchema,
  mergeGamesSchema,
  updateVenueSchema,
} from '@lucko/shared'
import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common'
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { CurrentUser } from '../auth/auth.decorators'
import { ZodBody, ZodQuery, ZodResponse } from '../common/zod'
import { VenueEventsService } from '../events/venue-events.service'
import type { Prisma, User } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { Admin } from './admin.decorators'
import { AdminService } from './admin.service'

const DAY_MS = 24 * 60 * 60 * 1000
/** Agenda d'un lieu dans le back-office : les 30 derniers jours et tout ce qui vient. */
const EVENTS_PAST_DAYS = 30

const venueInclude = {
  openingHours: {
    orderBy: [{ weekday: 'asc' }, { opensAtMinute: 'asc' }],
    select: { weekday: true, opensAtMinute: true, closesAtMinute: true },
  },
  _count: { select: { photos: true } },
} satisfies Prisma.VenueInclude

const toAdminVenue = ({
  _count,
  ...venue
}: Prisma.VenueGetPayload<{ include: typeof venueInclude }>) => ({
  ...venue,
  photoCount: _count.photos,
})

const eventInclude = {
  games: { select: { id: true } },
  _count: { select: { registrations: { where: { status: 'REGISTERED' } } } },
} satisfies Prisma.EventInclude

const toAdminEvent = ({
  games,
  _count,
  ...event
}: Prisma.EventGetPayload<{ include: typeof eventInclude }>) => ({
  ...event,
  gameIds: games.map((g) => g.id),
  registered: _count.registrations,
})

/** Back-office (LKO-20) : validation des lieux, événements (démarrage à froid), fusion des jeux. */
@ApiTags('admin')
@Controller('admin')
export class AdminCatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: AdminService,
    private readonly venueEvents: VenueEventsService,
  ) {}

  /** Lieux, ceux en attente de validation d'abord. */
  @Get('venues')
  @Admin()
  @ZodResponse(z.array(adminVenueSchema))
  async venues(
    @ZodQuery(adminVenueQuerySchema) { q, status }: z.output<typeof adminVenueQuerySchema>,
  ) {
    const contains = { contains: q, mode: 'insensitive' } as const
    const venues = await this.prisma.venue.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q ? { OR: [{ name: contains }, { city: contains }, { address: contains }] } : {}),
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: venueInclude,
    })
    return venues.map(toAdminVenue)
  }

  /** Publication, passage en partenaire (badge, avantage Lucko), accès des mineurs. */
  @Patch('venues/:id')
  @Admin('VENUE_UPDATE')
  @ZodResponse(adminVenueSchema)
  async updateVenue(
    @Param('id') id: string,
    @ZodBody(updateVenueSchema) body: z.output<typeof updateVenueSchema>,
  ) {
    await this.venueOr404(id)
    return toAdminVenue(
      await this.prisma.venue.update({ where: { id }, data: body, include: venueInclude }),
    )
  }

  @Get('venues/:id/events')
  @Admin()
  @ZodResponse(z.array(adminEventSchema))
  async events(@Param('id') id: string) {
    const events = await this.prisma.event.findMany({
      where: { venueId: id, startsAt: { gte: new Date(Date.now() - EVENTS_PAST_DAYS * DAY_MS) } },
      orderBy: { startsAt: 'asc' },
      include: eventInclude,
    })
    return events.map(toAdminEvent)
  }

  /**
   * Crée un événement, ou une série chaque semaine pendant `repeatWeeks` semaines de plus
   * (dates des 3 prochains mois tout de suite, les suivantes par le job de nuit).
   */
  @Post('venues/:id/events')
  @Admin('EVENT_CREATE')
  @ZodResponse(z.array(adminEventSchema), 201)
  async createEvent(
    @Param('id') venueId: string,
    @ZodBody(adminEventInputSchema) {
      repeatWeeks,
      ...input
    }: z.output<typeof adminEventInputSchema>,
    @CurrentUser() admin: User,
  ) {
    const ids = await this.venueEvents.create(
      venueId,
      {
        ...input,
        status: 'PUBLISHED',
        recurrence: repeatWeeks > 0 ? { freq: 'WEEKLY', interval: 1 } : null,
        untilDate: repeatWeeks > 0 ? addDays(input.date, repeatWeeks * 7) : null,
      },
      admin,
      { limit: false },
    )
    return this.adminEvents(ids)
  }

  /** Modifie une occurrence (les autres dates d'une série ne bougent pas) ; les inscrits sont prévenus d'un nouvel horaire. */
  @Put('events/:id')
  @Admin('EVENT_UPDATE')
  @ZodResponse(adminEventSchema)
  async updateEvent(
    @Param('id') id: string,
    @ZodBody(adminEventUpdateSchema) input: z.output<typeof adminEventUpdateSchema>,
    @CurrentUser() admin: User,
  ) {
    const event = await this.prisma.event.findUnique({ where: { id }, select: { status: true } })
    const status = event?.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED'
    await this.venueEvents.update(id, { ...input, scope: 'occurrence', status }, admin)
    const [updated] = await this.adminEvents([id])
    return updated
  }

  /** Annule l'occurrence, ou avec `series` toute la série à partir de celle-ci ; les inscrits sont prévenus. */
  @Post('events/:id/cancel')
  @Admin('EVENT_CANCEL')
  @HttpCode(204)
  @ApiNoContentResponse()
  async cancelEvent(
    @Param('id') id: string,
    @ZodBody(cancelEventSchema) { series }: z.output<typeof cancelEventSchema>,
    @CurrentUser() admin: User,
  ) {
    await this.venueEvents.stop(id, admin, series, 'CANCELLED')
  }

  /**
   * Masque un événement signalé (LKO-61), ou avec `series` toute la suite de sa série : il disparaît
   * de l'app, les inscrits sont prévenus comme d'une annulation.
   */
  @Post('events/:id/hide')
  @Admin('EVENT_HIDE')
  @HttpCode(204)
  @ApiNoContentResponse()
  async hideEvent(
    @Param('id') id: string,
    @ZodBody(cancelEventSchema) { series }: z.output<typeof cancelEventSchema>,
    @CurrentUser() admin: User,
  ) {
    await this.venueEvents.stop(id, admin, series, 'HIDDEN')
  }

  /** Catalogue avec de quoi repérer les doublons : formats, rooms, événements et joueurs liés. */
  @Get('games')
  @Admin()
  @ZodResponse(z.array(adminGameSchema))
  async games() {
    const games = await this.prisma.game.findMany({
      orderBy: { name: 'asc' },
      include: {
        formats: { select: { id: true, slug: true, name: true }, orderBy: { name: 'asc' } },
        _count: { select: { rooms: true, events: true, players: true } },
      },
    })
    return games.map(({ _count, ...game }) => ({ ...game, ..._count }))
  }

  /** Fond le jeu `:id` (doublon) dans `intoId`, sans perte de données, puis le supprime. */
  @Post('games/:id/merge')
  @Admin('GAME_MERGE')
  @HttpCode(204)
  @ApiNoContentResponse()
  async merge(
    @Param('id') id: string,
    @ZodBody(mergeGamesSchema) { intoId }: z.output<typeof mergeGamesSchema>,
  ) {
    await this.admin.mergeGames(id, intoId)
  }

  private async adminEvents(ids: string[]) {
    const events = await this.prisma.event.findMany({
      where: { id: { in: ids } },
      orderBy: { startsAt: 'asc' },
      include: eventInclude,
    })
    return events.map(toAdminEvent)
  }

  private async venueOr404(id: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id }, select: { id: true } })
    if (!venue) throw new NotFoundException('Lieu introuvable')
  }
}
