import {
  addDays,
  adminEventInputSchema,
  adminEventSchema,
  adminEventUpdateSchema,
  adminGameSchema,
  adminVenueQuerySchema,
  adminVenueSchema,
  cancelEventSchema,
  createVenueSchema,
  gameInputSchema,
  mergeGamesSchema,
  osmVenuePreviewSchema,
  updateVenueSchema,
} from '@lucko/shared'
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
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
import { Prisma, type User } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { isSamePlace, osmElementQuery, slugify, toVenue } from '../venues/osm.rules'
import { fetchOverpass } from '../venues/osm-import'
import { Admin } from './admin.decorators'
import { gameUsage } from './admin.rules'
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

const gameInclude = {
  formats: {
    select: {
      id: true,
      slug: true,
      name: true,
      minPlayers: true,
      maxPlayers: true,
      durationMinutes: true,
    },
    orderBy: { name: 'asc' },
  },
  _count: { select: { rooms: true, events: true, players: true } },
} satisfies Prisma.GameInclude

const toAdminGame = ({
  _count,
  ...game
}: Prisma.GameGetPayload<{ include: typeof gameInclude }>) => ({
  ...game,
  ..._count,
})

/** Deux formats d'un même jeu ne peuvent pas avoir le même nom (ni le même slug). */
function checkFormatSlugs(rows: { slug: string }[]) {
  if (rows.some((f) => !f.slug) || new Set(rows.map((f) => f.slug)).size < rows.length)
    throw new BadRequestException('Chaque format doit avoir un nom distinct')
}

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

  /** Fiche pré-remplie depuis un élément OSM trouvé par la recherche (LKO-115), à relire avant création. */
  @Get('venues/osm/:type/:ref')
  @Admin()
  @ZodResponse(osmVenuePreviewSchema)
  async osmVenue(@Param('type') type: string, @Param('ref') ref: string) {
    const osmId = `${type}/${ref}`
    if (!/^(node|way|relation)\/\d+$/.test(osmId))
      throw new NotFoundException('Élément OSM inconnu')
    const elements = await fetchOverpass(osmElementQuery(osmId)).catch(() => {
      throw new BadGatewayException('OpenStreetMap ne répond pas, réessaie dans un instant.')
    })
    const found = elements[0] ? toVenue(elements[0]) : null
    if (!found) throw new NotFoundException('Élément OSM sans nom ni position')
    const venue = { ...found.venue, osmId, openingHours: found.openingHours }
    return { ...venue, duplicate: await this.lookalike(venue) }
  }

  /** Lieu relu et validé par un admin (LKO-115), publié aussitôt. */
  @Post('venues')
  @Admin('VENUE_CREATE')
  @ZodResponse(adminVenueSchema)
  async createVenue(
    @ZodBody(createVenueSchema) { openingHours, ...body }: z.output<typeof createVenueSchema>,
  ) {
    let slug = slugify(body.name) || 'lieu'
    if (await this.prisma.venue.findUnique({ where: { slug }, select: { id: true } }))
      slug = `${slug}-${Date.now().toString(36)}`
    try {
      return toAdminVenue(
        await this.prisma.venue.create({
          data: { ...body, slug, status: 'PUBLISHED', openingHours: { create: openingHours } },
          include: venueInclude,
        }),
      )
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Ce lieu OpenStreetMap a déjà sa fiche')
      throw error
    }
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
      include: gameInclude,
    })
    return games.map(toAdminGame)
  }

  /** Ajoute un jeu au catalogue, avec ses formats. */
  @Post('games')
  @Admin('GAME_CREATE')
  @ZodResponse(adminGameSchema)
  async createGame(
    @ZodBody(gameInputSchema) { formats, ...game }: z.output<typeof gameInputSchema>,
  ) {
    const slug = slugify(game.name)
    if (!slug) throw new BadRequestException('Le nom doit contenir des lettres ou des chiffres')
    await this.checkGameName(game.name)
    const rows = formats.map(({ id: _, ...f }) => ({ ...f, slug: slugify(f.name) }))
    checkFormatSlugs(rows)
    const created = await this.prisma.game.create({
      data: { ...game, slug, formats: { create: rows } },
      include: gameInclude,
    })
    return toAdminGame(created)
  }

  /**
   * Modifie un jeu et ses formats : les formats absents sont retirés, sauf s'ils ont déjà des rooms
   * ou des LK. Les slugs ne bougent pas (couleurs, filtres d'Explorer, fusion) ; le type non plus.
   */
  @Put('games/:id')
  @Admin('GAME_UPDATE')
  @ZodResponse(adminGameSchema)
  async updateGame(
    @Param('id') id: string,
    @ZodBody(gameInputSchema) { formats, ...game }: z.output<typeof gameInputSchema>,
  ) {
    const current = await this.prisma.game.findUnique({
      where: { id },
      include: {
        formats: {
          select: { id: true, slug: true, _count: { select: { rooms: true, profiles: true } } },
        },
      },
    })
    if (!current) throw new NotFoundException('Jeu introuvable')
    if (game.kind !== current.kind)
      throw new BadRequestException('Le type d’un jeu ne se change pas')
    await this.checkGameName(game.name, id)
    const byId = new Map(current.formats.map((f) => [f.id, f]))
    if (formats.some((f) => f.id && !byId.has(f.id)))
      throw new BadRequestException('Format introuvable')
    const rows = formats.map((f) => ({
      ...f,
      slug: (f.id && byId.get(f.id)?.slug) || slugify(f.name),
    }))
    checkFormatSlugs(rows)
    const kept = new Set(formats.map((f) => f.id))
    const removed = current.formats.filter((f) => !kept.has(f.id))
    if (removed.some((f) => f._count.rooms || f._count.profiles))
      throw new ConflictException(
        'Un format qui a déjà des rooms ou des joueurs classés ne peut pas être retiré',
      )
    const updated = await this.prisma.game.update({
      where: { id },
      data: {
        ...game,
        formats: {
          deleteMany: { id: { in: removed.map((f) => f.id) } },
          update: rows.flatMap(({ id: formatId, ...data }) =>
            formatId ? [{ where: { id: formatId }, data }] : [],
          ),
          create: rows.flatMap(({ id: formatId, ...data }) => (formatId ? [] : [data])),
        },
      },
      include: gameInclude,
    })
    return toAdminGame(updated)
  }

  /** Supprime un jeu que rien n'utilise (ajouté par erreur) ; sinon, le fusionner dans un autre. */
  @Delete('games/:id')
  @Admin('GAME_DELETE')
  @ZodResponse(z.object({ name: z.string() }))
  async deleteGame(@Param('id') id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      select: {
        name: true,
        _count: {
          select: { rooms: true, events: true, eventSeries: true, venues: true, players: true },
        },
        formats: { select: { _count: { select: { profiles: true } } } },
      },
    })
    if (!game) throw new NotFoundException('Jeu introuvable')
    const usage = gameUsage({
      ...game._count,
      profiles: game.formats.reduce((n, f) => n + f._count.profiles, 0),
    })
    if (usage)
      throw new ConflictException(`Ce jeu est encore utilisé (${usage}) : fusionne-le plutôt`)
    await this.prisma.game.delete({ where: { id } })
    return { name: game.name }
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

  /** Lieu déjà en base : même élément OSM, ou même nom à moins de 100 m. */
  private async lookalike(venue: {
    name: string
    latitude: number
    longitude: number
    osmId: string
  }) {
    const d = 0.002
    const near = await this.prisma.venue.findMany({
      where: {
        OR: [
          { osmId: venue.osmId },
          {
            latitude: { gte: venue.latitude - d, lte: venue.latitude + d },
            longitude: { gte: venue.longitude - d, lte: venue.longitude + d },
          },
        ],
      },
      select: { id: true, name: true, latitude: true, longitude: true, osmId: true },
    })
    const match =
      near.find((v) => v.osmId === venue.osmId) ?? near.find((v) => isSamePlace(v, venue))
    return match ? { id: match.id, name: match.name } : null
  }

  /** Un autre jeu porte déjà ce nom (ou le slug qu'il donnerait) : doublon. */
  private async checkGameName(name: string, id?: string) {
    const homonym = await this.prisma.game.findFirst({
      where: {
        id: id ? { not: id } : undefined,
        OR: [{ slug: slugify(name) }, { name: { equals: name, mode: 'insensitive' } }],
      },
      select: { name: true },
    })
    if (homonym) throw new ConflictException(`« ${homonym.name} » existe déjà dans le catalogue`)
  }

  private async venueOr404(id: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id }, select: { id: true } })
    if (!venue) throw new NotFoundException('Lieu introuvable')
  }
}
