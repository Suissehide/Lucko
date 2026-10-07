import { z } from 'zod'
import {
  ADMIN_ACTION_KINDS,
  AVATAR_STATUSES,
  EVENT_REPEAT_MAX_WEEKS,
  EVENT_TYPES,
  REGISTRATION_MODES,
  REPORT_REASONS,
  REPORT_RESOLUTIONS,
  SUSPENSION_MAX_DAYS,
  USER_ROLES,
  VENUE_STATUSES,
  VENUE_TYPES,
} from '../constants'
import { isoDateTime } from './common'
import { EVENT_STATUSES } from './event'

// Back-office admin (LKO-20) : routes /admin/*, réservées au rôle ADMIN.

const reasonSchema = z
  .string()
  .trim()
  .min(3, { message: 'Indique un motif' })
  .max(500, { message: '500 caractères maximum' })

/** Durée d'une suspension en jours ; null = définitive. */
const suspensionDaysSchema = z
  .number()
  .int()
  .min(1, { message: 'Au moins 1 jour' })
  .max(SUSPENSION_MAX_DAYS, { message: `${SUSPENSION_MAX_DAYS} jours maximum` })
  .nullable()

/** POST /admin/users/:id/suspend */
export const suspendSchema = z.object({ reason: reasonSchema, days: suspensionDaysSchema })
export type SuspendInput = z.infer<typeof suspendSchema>

/** POST /admin/reports/:id/resolve : classer, avertir (push au joueur) ou suspendre. */
export const resolveReportSchema = z.discriminatedUnion('resolution', [
  z.object({ resolution: z.literal('DISMISSED'), reason: z.string().trim().max(500).default('') }),
  z.object({ resolution: z.literal('WARNED'), reason: reasonSchema }),
  suspendSchema.extend({ resolution: z.literal('SUSPENDED') }),
])
export type ResolveReportInput = z.input<typeof resolveReportSchema>

/** Motif seul (levée de suspension, refus de photo, annulation d'événement). */
export const adminReasonSchema = z.object({ reason: reasonSchema })
export type AdminReasonInput = z.infer<typeof adminReasonSchema>

const actorSchema = z.object({ id: z.string(), pseudo: z.string().nullable() })

export const ADMIN_TARGET_TYPES = ['user', 'venue', 'game'] as const

/** Ligne du journal d'audit. `target` : fiche à ouvrir (joueur, lieu, jeu), null si elle n'existe plus. */
export const adminActionSchema = z.object({
  id: z.string(),
  action: z.enum(ADMIN_ACTION_KINDS),
  targetId: z.string(),
  target: z
    .object({ type: z.enum(ADMIN_TARGET_TYPES), id: z.string(), label: z.string() })
    .nullable(),
  reason: z.string(),
  createdAt: isoDateTime,
  admin: actorSchema,
})
export type AdminActionItem = z.input<typeof adminActionSchema>

/** GET /admin/dashboard : ce qui attend l'équipe. */
export const adminDashboardSchema = z.object({
  openReports: z.number().int(),
  minorReports: z.number().int(),
  pendingAvatars: z.number().int(),
  pendingVenues: z.number().int(),
  suspendedPlayers: z.number().int(),
  oldestReportAt: isoDateTime.nullable(),
  oldestAvatarAt: isoDateTime.nullable(),
  /** Les 3 premiers lieux en attente. */
  pendingVenueNames: z.array(z.string()),
})
export type AdminDashboard = z.input<typeof adminDashboardSchema>

export const adminSearchSchema = z.object({ q: z.string().trim().max(100).default('') })

export const ADMIN_USER_FILTERS = ['all', 'reported', 'minor', 'suspended', 'staff'] as const
export type AdminUserFilter = (typeof ADMIN_USER_FILTERS)[number]

export const adminUserQuerySchema = adminSearchSchema.extend({
  filter: z.enum(ADMIN_USER_FILTERS).default('all'),
})

const suspensionSchema = z
  .object({ at: isoDateTime, until: isoDateTime.nullable(), reason: z.string() })
  .nullable()

/** GET /admin/users : recherche par pseudo ou e-mail. */
export const adminUserSchema = z.object({
  id: z.string(),
  pseudo: z.string().nullable(),
  email: z.string(),
  role: z.enum(USER_ROLES),
  minor: z.boolean(),
  createdAt: isoDateTime,
  /** Suspension en cours, null sinon. */
  suspension: suspensionSchema,
  openReports: z.number().int(),
})
export type AdminUser = z.input<typeof adminUserSchema>

/** GET /admin/users : joueurs du filtre, et nombre de comptes par filtre (pour la même recherche). */
export const adminUserListSchema = z.object({
  users: z.array(adminUserSchema),
  counts: z.record(z.enum(ADMIN_USER_FILTERS), z.number().int()),
})
export type AdminUserList = z.input<typeof adminUserListSchema>

/** GET /admin/users/:id : historique du joueur (signalements reçus, actions des admins). */
export const adminUserDetailSchema = adminUserSchema.extend({
  avatarUrl: z.string().nullable(),
  avatarStatus: z.enum(AVATAR_STATUSES).nullable(),
  deleted: z.boolean(),
  reports: z.array(
    z.object({
      id: z.string(),
      reason: z.enum(REPORT_REASONS),
      details: z.string(),
      createdAt: isoDateTime,
      resolvedAt: isoDateTime.nullable(),
      resolution: z.enum(REPORT_RESOLUTIONS).nullable(),
      reporter: actorSchema,
    }),
  ),
  actions: z.array(adminActionSchema),
})
export type AdminUserDetail = z.input<typeof adminUserDetailSchema>

/** GET /admin/avatars : photos de profil en attente de validation. */
export const pendingAvatarSchema = z.object({
  id: z.string(),
  pseudo: z.string().nullable(),
  avatarUrl: z.string(),
  submittedAt: isoDateTime,
})
export type PendingAvatar = z.input<typeof pendingAvatarSchema>

export const adminVenueQuerySchema = adminSearchSchema.extend({
  status: z.enum(VENUE_STATUSES).optional(),
})

/** Lieu dans le back-office : de quoi vérifier adresse, horaires et accès des mineurs avant publication. */
export const adminVenueSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  type: z.enum(VENUE_TYPES),
  status: z.enum(VENUE_STATUSES),
  address: z.string(),
  city: z.string(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  isPartner: z.boolean(),
  luckoPerk: z.string().nullable(),
  acceptsUnaccompaniedMinors: z.boolean(),
  openingHours: z.array(
    z.object({
      weekday: z.number().int(),
      opensAtMinute: z.number().int(),
      closesAtMinute: z.number().int(),
    }),
  ),
  photoCount: z.number().int(),
  createdAt: isoDateTime,
})
export type AdminVenue = z.input<typeof adminVenueSchema>

/** PATCH /admin/venues/:id : publication, passage en partenaire, accès des mineurs. */
export const updateVenueSchema = z
  .object({
    status: z.enum(VENUE_STATUSES),
    isPartner: z.boolean(),
    luckoPerk: z.string().trim().max(120, { message: '120 caractères maximum' }).nullable(),
    acceptsUnaccompaniedMinors: z.boolean(),
  })
  .partial()
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Heure HH:MM' })

/**
 * Événement saisi par un admin (démarrage à froid, LKO-16) : date et heures locales du lieu,
 * `repeatWeeks` occurrences de plus chaque semaine à la même heure (une série).
 */
export const adminEventInputSchema = z.object({
  type: z.enum(EVENT_TYPES),
  title: z.string().trim().min(3, { message: 'Titre trop court' }).max(120),
  description: z.string().trim().max(2000).nullable().default(null),
  date: z.iso.date({ message: 'Date AAAA-MM-JJ' }),
  startTime: timeSchema,
  endTime: timeSchema.nullable().default(null),
  capacity: z.number().int().min(1).max(500).nullable().default(null),
  priceCents: z.number().int().min(0).nullable().default(null),
  minAge: z.number().int().min(0).max(18).nullable().default(null),
  registrationMode: z.enum(REGISTRATION_MODES).default('IN_APP'),
  externalUrl: z.url({ message: 'Lien invalide' }).nullable().default(null),
  gameIds: z.array(z.string().min(1)).default([]),
  repeatWeeks: z.number().int().min(0).max(EVENT_REPEAT_MAX_WEEKS).default(0),
})
export type AdminEventInput = z.input<typeof adminEventInputSchema>

/** PUT /admin/events/:id : une seule occurrence, tous ses champs. */
export const adminEventUpdateSchema = adminEventInputSchema.omit({ repeatWeeks: true })
export type AdminEventUpdate = z.input<typeof adminEventUpdateSchema>

/** POST /admin/events/:id/cancel : l'occurrence, ou la série à partir de celle-ci. */
export const cancelEventSchema = adminReasonSchema.extend({ series: z.boolean().default(false) })
export type CancelEventInput = z.input<typeof cancelEventSchema>

/** Événement d'un lieu dans le back-office (à venir et des 30 derniers jours). */
export const adminEventSchema = z.object({
  id: z.string(),
  type: z.enum(EVENT_TYPES),
  title: z.string(),
  description: z.string().nullable(),
  startsAt: isoDateTime,
  endsAt: isoDateTime.nullable(),
  capacity: z.number().int().nullable(),
  priceCents: z.number().int().nullable(),
  minAge: z.number().int().nullable(),
  registrationMode: z.enum(REGISTRATION_MODES),
  externalUrl: z.string().nullable(),
  seriesId: z.string().nullable(),
  status: z.enum(EVENT_STATUSES),
  gameIds: z.array(z.string()),
  registered: z.number().int(),
})
export type AdminEvent = z.input<typeof adminEventSchema>

/** POST /admin/games/:id/merge : le jeu `:id` (doublon) est fondu dans `intoId` puis supprimé. */
export const mergeGamesSchema = z.object({
  intoId: z.string().min(1, { message: 'Choisis le jeu cible' }),
})
export type MergeGamesInput = z.infer<typeof mergeGamesSchema>

/** Jeu dans le back-office : de quoi repérer les doublons. */
export const adminGameSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  formats: z.array(z.object({ id: z.string(), slug: z.string(), name: z.string() })),
  rooms: z.number().int(),
  events: z.number().int(),
  players: z.number().int(),
})
export type AdminGame = z.infer<typeof adminGameSchema>
