import {
  accessibilityItemSchema,
  addDays,
  BOARD_GAME_CATEGORY_LABELS,
  type BoardGameCategory,
  type EventsQuery,
  type eventListItemSchema,
  type GeoQuery,
  localDateTime,
  openingStatus,
  type roomListItemSchema,
  VENUE_AGENDA_MONTHS,
  type VenueListItem,
  type VenuesQuery,
  type venueDetailSchema,
} from '@lucko/shared'
import { Injectable, NotFoundException } from '@nestjs/common'
import type { z } from 'zod'
import { eventVisibleTo, roomVisibleTo, type Viewer } from '../common/minors.rules'
import { seriesView, withUtm } from '../events/events.rules'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { distanceMeters } from '../rooms/home.rules'
import { compareByDistance } from './explore.rules'

const DAY_MS = 24 * 60 * 60 * 1000

/** Colonne `@db.Date` (minuit UTC) ↔ date locale « 2026-11-01 ». */
const toLocalDate = (date: Date) => date.toISOString().slice(0, 10)
const fromLocalDate = (date: string) => new Date(`${date}T00:00:00Z`)

/** Fermeture en dates locales, forme attendue par `openingStatus`. */
export const closureRange = <T extends { startsOn: Date; endsOn: Date }>(closure: T) => ({
  ...closure,
  startsOn: toLocalDate(closure.startsOn),
  endsOn: toLocalDate(closure.endsOn),
})

const roomInclude = {
  game: { select: { slug: true, name: true } },
  format: { select: { name: true } },
  participants: {
    where: { status: 'ACCEPTED' },
    orderBy: { createdAt: 'asc' },
    select: { user: { select: { pseudo: true, gameProfiles: true } } },
  },
} satisfies Prisma.RoomInclude

/** Rooms d'un hôte qui n'a pas bloqué le joueur connecté et que celui-ci n'a pas bloqué (LKO-19). */
export const notBlockedWith = (viewerId?: string): Prisma.RoomWhereInput =>
  viewerId
    ? {
        host: {
          blocksGiven: { none: { blockedId: viewerId } },
          blocksReceived: { none: { blockerId: viewerId } },
        },
      }
    : {}

/** Inscription du joueur connecté à un événement (annulée = pas inscrit) ; sans joueur, aucune. */
const myRegistration = (viewer: Viewer) => ({
  registrations: {
    where: {
      userId: viewer?.id ?? '',
      status: { in: ['REGISTERED' as const, 'WAITLISTED' as const] },
    },
    select: { status: true },
  },
})

/** Statut lu par `myRegistration` : les inscriptions annulées sont déjà filtrées. */
const myStatus = (registrations: { status: string }[]) =>
  (registrations[0]?.status as 'REGISTERED' | 'WAITLISTED' | undefined) ?? null

/** Format TCG, ou catégorie d'une room jeux de société. */
export const formatLabel = (room: {
  format: { name: string } | null
  boardGameCategory: BoardGameCategory | null
}) =>
  room.format?.name ??
  (room.boardGameCategory ? BOARD_GAME_CATEGORY_LABELS[room.boardGameCategory].label : null)

/** Room publique : initiales des joueurs et fourchette de LK des parties classées. */
function roomItem({
  format,
  participants,
  ...room
}: Prisma.RoomGetPayload<{ include: typeof roomInclude }>) {
  const ratings = participants.flatMap(({ user }) =>
    user.gameProfiles.filter((p) => p.formatId === room.formatId).map((p) => p.rating),
  )
  return {
    ...room,
    format: formatLabel({ format, ...room }),
    players: participants.map(({ user }) => ({ initial: user.pseudo?.slice(0, 1) ?? '?' })),
    ratingRange:
      room.mode === 'RANKED' && ratings.length
        ? { min: Math.min(...ratings), max: Math.max(...ratings) }
        : null,
  }
}

@Injectable()
export class ExploreService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lieux publiés à moins de `radiusKm` du point, avec leur distance en mètres (PostGIS, index GiST). */
  private async distances({ lat, lng, radiusKm }: GeoQuery) {
    const rows = await this.prisma.$queryRaw<{ id: string; distance: number }[]>`
      SELECT "id", ST_Distance("location", ST_MakePoint(${lng}::float8, ${lat}::float8)::geography) AS distance
      FROM "Venue"
      WHERE "status" = 'PUBLISHED' AND ST_DWithin("location", ST_MakePoint(${lng}::float8, ${lat}::float8)::geography, ${radiusKm * 1000}::float8)`
    return new Map(rows.map((row) => [row.id, Math.round(Number(row.distance))]))
  }

  /** Carte et liste des lieux : tri honnête (distance, partenaires en premier à distance égale). */
  async venues(query: VenuesQuery, viewer: Viewer): Promise<VenueListItem[]> {
    const distances = await this.distances(query)
    const now = new Date()
    const at = query.at ?? now
    const yesterday = fromLocalDate(addDays(localDateTime(now).date, -1))
    const venues = await this.prisma.venue.findMany({
      where: { id: { in: [...distances.keys()] } },
      include: {
        openingHours: true,
        closures: { where: { endsOn: { gte: yesterday } } },
        events: {
          where: { startsAt: { gte: now }, status: 'PUBLISHED' },
          select: { minAge: true },
        },
      },
    })
    return venues
      .map(({ openingHours, closures, events, ...venue }) => {
        const { openNow, closesAtMinute } = openingStatus(
          openingHours,
          closures.map(closureRange),
          at,
        )
        return {
          ...venue,
          distanceMeters: distances.get(venue.id) ?? 0,
          openNow,
          closesAtMinute,
          upcomingEventCount: events.filter((event) => eventVisibleTo(event, viewer, now)).length,
        }
      })
      .sort(compareByDistance)
  }

  /**
   * Fiche lieu : infos pratiques, photos, horaires et fermetures, jeux sur place, rooms ouvertes
   * et agenda du mois en cours aux VENUE_AGENDA_MONTHS suivants (vue liste et calendrier).
   */
  async venue(slug: string, viewer: Viewer): Promise<z.output<typeof venueDetailSchema>> {
    const now = new Date()
    const [year = 0, month = 1] = localDateTime(now).date.split('-').map(Number)
    const monthStart = new Date(Date.UTC(year, month - 1, 1))
    // Un jour de marge de chaque côté : l'app regroupe les événements par jour à l'heure de Paris
    const agendaFrom = new Date(monthStart.getTime() - DAY_MS)
    const agendaTo = new Date(Date.UTC(year, month - 1 + VENUE_AGENDA_MONTHS, 1) + DAY_MS)
    const venue = await this.prisma.venue.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: {
        openingHours: { orderBy: [{ weekday: 'asc' }, { opensAtMinute: 'asc' }] },
        closures: { where: { endsOn: { gte: monthStart } }, orderBy: { startsOn: 'asc' } },
        photos: { orderBy: { order: 'asc' }, select: { url: true, caption: true } },
        games: { select: { slug: true, name: true, kind: true }, orderBy: { name: 'asc' } },
        events: {
          where: { startsAt: { gte: agendaFrom, lt: agendaTo }, status: 'PUBLISHED' },
          orderBy: { startsAt: 'asc' },
          include: {
            games: { select: { slug: true, name: true }, orderBy: { name: 'asc' } },
            series: { select: { rrule: true, startDate: true } },
            _count: { select: { registrations: { where: { status: 'REGISTERED' } } } },
            ...myRegistration(viewer),
          },
        },
        rooms: {
          where: { status: 'OPEN', startsAt: { gte: now }, ...notBlockedWith(viewer?.id) },
          orderBy: { startsAt: 'asc' },
          include: roomInclude,
        },
      },
    })
    if (!venue) throw new NotFoundException('Lieu introuvable')
    const closures = venue.closures.map(closureRange)
    return {
      ...venue,
      ...openingStatus(venue.openingHours, closures, now),
      closures,
      accessibility: accessibilityItemSchema.array().parse(venue.accessibility),
      events: venue.events
        .filter((event) => eventVisibleTo(event, viewer, now))
        .map(({ _count, registrations, series, ...event }) => ({
          ...event,
          externalUrl: withUtm(event.externalUrl),
          recurrenceLabel: series ? (seriesView(series)?.label ?? null) : null,
          registeredCount: _count.registrations,
          myRegistration: myStatus(registrations),
        })),
      rooms: venue.rooms
        .filter((room) => roomVisibleTo({ ...room, venue }, viewer, now))
        .map(roomItem),
    }
  }

  /** Agenda des prochains jours autour du point : trié par date, puis distance (même règle que les lieux). */
  async events(
    query: EventsQuery,
    viewer: Viewer,
  ): Promise<z.output<typeof eventListItemSchema>[]> {
    const distances = await this.distances(query)
    const now = new Date()
    const events = await this.prisma.event.findMany({
      where: {
        venueId: { in: [...distances.keys()] },
        startsAt: { gte: now, lt: new Date(now.getTime() + query.days * DAY_MS) },
        status: 'PUBLISHED',
      },
      include: {
        games: { select: { slug: true, name: true }, orderBy: { name: 'asc' } },
        venue: { select: { id: true, slug: true, name: true, isPartner: true } },
        _count: { select: { registrations: { where: { status: 'REGISTERED' } } } },
        ...myRegistration(viewer),
      },
    })
    return events
      .filter((event) => eventVisibleTo(event, viewer, now))
      .map(({ _count, venue, registrations, ...event }) => ({
        ...event,
        registeredCount: _count.registrations,
        myRegistration: myStatus(registrations),
        venue: { ...venue, distanceMeters: distances.get(venue.id) ?? 0 },
      }))
      .sort(
        (a, b) =>
          a.startsAt.getTime() - b.startsAt.getTime() || compareByDistance(a.venue, b.venue),
      )
  }

  /**
   * Rooms ouvertes autour du point : dans un lieu du rayon, ou à domicile avec la zone floue dans le rayon
   * (quartier et distance jusqu'au centre de la zone, jamais l'adresse).
   */
  async rooms(query: EventsQuery, viewer: Viewer): Promise<z.output<typeof roomListItemSchema>[]> {
    const distances = await this.distances(query)
    const now = new Date()
    const rooms = await this.prisma.room.findMany({
      where: {
        status: 'OPEN',
        OR: [{ venueId: { in: [...distances.keys()] } }, { atHome: true, fuzzyLat: { not: null } }],
        startsAt: { gte: now, lt: new Date(now.getTime() + query.days * DAY_MS) },
        ...notBlockedWith(viewer?.id),
      },
      include: {
        ...roomInclude,
        venue: {
          select: { id: true, name: true, isPartner: true, acceptsUnaccompaniedMinors: true },
        },
      },
    })
    // ponytail: distance des rooms à domicile calculée ici, une requête PostGIS si elles deviennent nombreuses
    const homeDistance = (room: { fuzzyLat: number | null; fuzzyLng: number | null }) =>
      Math.round(
        distanceMeters(query, { lat: room.fuzzyLat ?? query.lat, lng: room.fuzzyLng ?? query.lng }),
      )
    return rooms
      .filter((room) => roomVisibleTo(room, viewer, now))
      .flatMap(({ venue, ...room }): z.output<typeof roomListItemSchema>[] => {
        if (venue)
          return [
            {
              ...roomItem(room),
              venue: { ...venue, distanceMeters: distances.get(venue.id) ?? 0 },
              home: null,
            },
          ]
        const distance = homeDistance(room)
        return room.atHome && distance <= query.radiusKm * 1000
          ? [
              {
                ...roomItem(room),
                venue: null,
                home: { areaLabel: room.homeAreaLabel ?? 'À domicile', distanceMeters: distance },
              },
            ]
          : []
      })
      .sort(
        (a, b) =>
          a.startsAt.getTime() - b.startsAt.getTime() || compareByDistance(placeOf(a), placeOf(b)),
      )
  }
}

/** Lieu ou zone d'une room, pour le tri par distance (une room à domicile n'est jamais partenaire). */
const placeOf = (room: {
  venue: { isPartner: boolean; distanceMeters: number } | null
  home: { distanceMeters: number } | null
}) => room.venue ?? { isPartner: false, distanceMeters: room.home?.distanceMeters ?? 0 }
