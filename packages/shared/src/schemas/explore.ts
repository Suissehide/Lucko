import { z } from 'zod'
import {
  ACCESSIBILITY_STATUSES,
  CLOSURE_KINDS,
  EVENT_TYPES,
  GAME_KINDS,
  REGISTRATION_MODES,
  REGISTRATION_STATUSES,
  ROOM_MODES,
  VENUE_TYPES,
} from '../constants'
import { geoQuerySchema, isoDateTime } from './common'
import { EVENT_STATUSES } from './event'

/** Lieux autour d'un point ; `at` : ouverture à cet instant plutôt que maintenant (création de room). */
export const venuesQuerySchema = geoQuerySchema.extend({ at: isoDateTime.optional() })

/** Lieu dans la carte / la liste « Où jouer ce soir » (B1, B2). */
export const venueListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  type: z.enum(VENUE_TYPES),
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  isPartner: z.boolean(),
  luckoPerk: z.string().nullable(),
  distanceMeters: z.number().int(),
  /** Ouvert maintenant, ou à `at` (heure de Paris) ; null si les horaires ne sont pas renseignés. */
  openNow: z.boolean().nullable(),
  /** Heure de fermeture de la plage en cours, en minutes depuis minuit. */
  closesAtMinute: z.number().int().nullable(),
  upcomingEventCount: z.number().int(),
})

export const eventsQuerySchema = geoQuerySchema.extend({
  /** Fenêtre de l'agenda, en jours à partir de maintenant. */
  days: z.coerce.number().int().min(1).max(31).default(7),
})

/** Événement dans l'agenda (B2, segment Événements). */
export const eventListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(EVENT_TYPES),
  startsAt: isoDateTime,
  priceCents: z.number().int().nullable(),
  capacity: z.number().int().nullable(),
  registeredCount: z.number().int(),
  registrationMode: z.enum(REGISTRATION_MODES),
  /** Âge minimum (18 = soirée 18+) ; les mineurs ne reçoivent jamais un événement au-dessus de leur âge. */
  minAge: z.number().int().nullable(),
  /** Inscription du joueur connecté ; null s'il n'est pas inscrit ou pas connecté. */
  myRegistration: z.enum(REGISTRATION_STATUSES).nullable(),
  games: z.array(z.object({ slug: z.string(), name: z.string() })),
  venue: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    isPartner: z.boolean(),
    distanceMeters: z.number().int(),
  }),
})

export const roomListItemSchema = z.object({
  id: z.string(),
  mode: z.enum(ROOM_MODES),
  startsAt: isoDateTime,
  capacity: z.number().int(),
  game: z.object({ slug: z.string(), name: z.string() }),
  format: z.string().nullable(),
  /** Bracket Commander visé (1 à 5). */
  bracket: z.number().int().nullable(),
  venue: z
    .object({
      id: z.string(),
      name: z.string(),
      isPartner: z.boolean(),
      distanceMeters: z.number().int(),
    })
    .nullable(),
  /** Room à domicile (LKO-71) : quartier et distance jusqu'à la zone floue, jamais l'adresse. */
  home: z.object({ areaLabel: z.string(), distanceMeters: z.number().int() }).nullable(),
  /** Joueurs acceptés (hôte compris) : initiales seulement, la liste est publique. */
  players: z.array(z.object({ initial: z.string() })),
  ratingRange: z.object({ min: z.number().int(), max: z.number().int() }).nullable(),
})

export type VenueListItem = z.infer<typeof venueListItemSchema>
/** Forme JSON reçue par l'app (dates en chaînes ISO). Côté API, `z.output` donne les `Date`. */
export type EventListItem = z.input<typeof eventListItemSchema>
export type VenuesQuery = z.infer<typeof venuesQuerySchema>
export type EventsQuery = z.infer<typeof eventsQuerySchema>
export type RoomListItem = z.input<typeof roomListItemSchema>

const gameRefSchema = z.object({ slug: z.string(), name: z.string() })

/** Fiche événement (B4) : détail, places, et l'inscription du joueur connecté. */
export const eventDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(EVENT_TYPES),
  description: z.string().nullable(),
  startsAt: isoDateTime,
  endsAt: isoDateTime.nullable(),
  /** PUBLISHED, ou CANCELLED (fiche gardée pour les inscrits) ; brouillon et masqué : 404. */
  status: z.enum(EVENT_STATUSES),
  /** « Chaque vendredi » pour une date d'une série. */
  recurrenceLabel: z.string().nullable(),
  priceCents: z.number().int().nullable(),
  capacity: z.number().int().nullable(),
  minAge: z.number().int().nullable(),
  registrationMode: z.enum(REGISTRATION_MODES),
  externalUrl: z.string().nullable(),
  registeredCount: z.number().int(),
  games: z.array(gameRefSchema),
  venue: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    address: z.string(),
    isPartner: z.boolean(),
  }),
  /** Inscription du joueur connecté ; null s'il n'est pas inscrit ou pas connecté. */
  myRegistration: z.enum(REGISTRATION_STATUSES).nullable(),
})

/** Date locale « 2026-11-01 » (fermetures). */
const localDate = z.iso.date()

export const accessibilityItemSchema = z.object({
  label: z.string(),
  status: z.enum(ACCESSIBILITY_STATUSES),
  note: z.string().nullish(),
})

/** Fiche lieu (B3, LKO-73) : photos, infos pratiques, horaires et fermetures, agenda, rooms, jeux, accès. */
export const venueDetailSchema = venueListItemSchema
  .omit({ distanceMeters: true, upcomingEventCount: true })
  .extend({
    city: z.string(),
    quarter: z.string().nullable(),
    description: z.string().nullable(),
    playFeeCents: z.number().int().nullable(),
    minSpendCents: z.number().int().nullable(),
    acceptsUnaccompaniedMinors: z.boolean(),
    phone: z.string().nullable(),
    website: z.string().nullable(),
    transitInfo: z.string().nullable(),
    /** Fermé : prochaine ouverture (date locale, minutes depuis minuit). */
    nextOpening: z.object({ date: localDate, minute: z.number().int() }).nullable(),
    photos: z.array(z.object({ url: z.string(), caption: z.string().nullable() })),
    /** 1 = lundi … 7 = dimanche ; fermeture < ouverture = après minuit. */
    openingHours: z.array(
      z.object({
        weekday: z.number().int(),
        opensAtMinute: z.number().int(),
        closesAtMinute: z.number().int(),
      }),
    ),
    /** Fermetures et horaires modifiés depuis le début du mois en cours. */
    closures: z.array(
      z.object({
        startsOn: localDate,
        endsOn: localDate,
        kind: z.enum(CLOSURE_KINDS),
        label: z.string(),
        note: z.string().nullable(),
        opensAtMinute: z.number().int().nullable(),
        closesAtMinute: z.number().int().nullable(),
      }),
    ),
    accessibility: z.array(accessibilityItemSchema),
    games: z.array(gameRefSchema.extend({ kind: z.enum(GAME_KINDS) })),
    tcgNote: z.string().nullable(),
    /** Ludothèque : titres mis en avant et total (300+). */
    boardGames: z.array(z.string()),
    boardGameCount: z.number().int().nullable(),
    boardGameNote: z.string().nullable(),
    /** Du début du mois en cours à la fin de l'horizon de l'agenda (VENUE_AGENDA_MONTHS). */
    events: z.array(
      eventListItemSchema.omit({ venue: true }).extend({
        seriesId: z.string().nullable(),
        recurrenceLabel: z.string().nullable(),
        externalUrl: z.string().nullable(),
      }),
    ),
    rooms: z.array(roomListItemSchema.omit({ venue: true, home: true })),
  })

export type EventDetail = z.input<typeof eventDetailSchema>
export type VenueDetail = z.input<typeof venueDetailSchema>
