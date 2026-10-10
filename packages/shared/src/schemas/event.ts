import { z } from 'zod'
import { EVENT_TYPES, REGISTRATION_MODES } from '../constants'
import { addDays, fromLocalDateTime } from '../opening'
import { occurrenceDates, toRrule } from '../recurrence'
import { isoDateTime } from './common'

/** Statut d'un événement (enum Prisma EventStatus) ; seul PUBLISHED est visible des joueurs. */
export const EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'CANCELLED', 'HIDDEN'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]

/** Âge minimum d'un événement publié par un lieu : Lucko est ouvert dès 13 ans. */
export const EVENT_MIN_AGE_FLOOR = 13

/** Occurrences d'une série créées à l'avance (3 mois glissants, job quotidien). */
export const EVENT_MATERIALIZE_DAYS = 92

/** Créations d'événements (une série compte pour une) par lieu et par 24 h. */
export const EVENT_CREATIONS_PER_DAY = 20

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Heure HH:MM' })

/** Chaque semaine, une semaine sur deux, ou le n-ième / dernier jour du mois (jour de la 1re date). */
export const recurrenceSchema = z.discriminatedUnion('freq', [
  z.object({ freq: z.literal('WEEKLY'), interval: z.union([z.literal(1), z.literal(2)]) }),
  z.object({
    freq: z.literal('MONTHLY'),
    nth: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]),
  }),
])

/** Champs communs à une occurrence et à une série. */
const eventFields = {
  type: z.enum(EVENT_TYPES),
  title: z.string().trim().min(3, { message: 'Titre trop court' }).max(120),
  description: z.string().trim().max(2000).nullable().default(null),
  gameIds: z.array(z.string().min(1)).max(10).default([]),
  startTime: timeSchema,
  /** Avant `startTime` : la soirée finit le lendemain (ex. 20:00 → 01:00). */
  endTime: timeSchema.nullable().default(null),
  capacity: z.number().int().min(1).max(500).nullable().default(null),
  priceCents: z.number().int().min(0).nullable().default(null),
  minAge: z
    .number()
    .int()
    .min(EVENT_MIN_AGE_FLOOR, { message: `${EVENT_MIN_AGE_FLOOR} ans minimum` })
    .max(18)
    .nullable()
    .default(null),
  registrationMode: z.enum(REGISTRATION_MODES).default('IN_APP'),
  externalUrl: z
    .url({ protocol: /^https$/, message: 'Lien https:// attendu' })
    .nullable()
    .default(null),
  /** Brouillon : visible du lieu seulement, jusqu'à la publication. */
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
}

type Checked = {
  date?: string
  startTime: string
  registrationMode: string
  externalUrl: string | null
  untilDate?: string | null
}

/** Règles croisées : lien externe obligatoire en inscription externe, pas de date passée, fin après début. */
function checkEvent(value: Checked, ctx: z.RefinementCtx) {
  if (value.registrationMode === 'EXTERNAL' && !value.externalUrl)
    ctx.addIssue({
      code: 'custom',
      path: ['externalUrl'],
      message: 'Lien de la billetterie requis',
    })
  if (value.date) {
    const [h = 0, m = 0] = value.startTime.split(':').map(Number)
    if (fromLocalDateTime(value.date, h * 60 + m) <= new Date())
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'Date déjà passée' })
    if (value.untilDate && value.untilDate < value.date)
      ctx.addIssue({ code: 'custom', path: ['untilDate'], message: 'Avant la première date' })
  }
}

/**
 * POST /venues/:venueId/events : un événement ponctuel, ou une série avec `recurrence`
 * (première date `date`, jusqu'au `untilDate` inclus, ou sans fin).
 */
export const eventCreateSchema = z
  .object({
    ...eventFields,
    date: z.iso.date({ message: 'Date AAAA-MM-JJ' }),
    recurrence: recurrenceSchema.nullable().default(null),
    untilDate: z.iso.date({ message: 'Date AAAA-MM-JJ' }).nullable().default(null),
  })
  .superRefine(checkEvent)
  .superRefine((value, ctx) => {
    // « 1er vendredi du mois » : la première date doit en être un
    const rule = value.recurrence && toRrule(value.recurrence, value.date)
    if (
      rule &&
      !occurrenceDates(rule, value.date, { from: value.date, to: addDays(value.date, 1) }).length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['recurrence'],
        message: 'La première date ne correspond pas à cette récurrence',
      })
  })
export type EventCreateInput = z.input<typeof eventCreateSchema>

/**
 * PATCH /events/:id : `scope: 'occurrence'` modifie cette date seulement (elle sort de la série) ;
 * `scope: 'series'` modifie la série et ses dates à venir non modifiées à part. La règle de
 * récurrence ne change pas (créer une nouvelle série) ; sa date de fin si.
 */
export const eventUpdateSchema = z.discriminatedUnion('scope', [
  z
    .object({ scope: z.literal('occurrence'), ...eventFields, date: z.iso.date() })
    .superRefine(checkEvent),
  z
    .object({
      scope: z.literal('series'),
      ...eventFields,
      untilDate: z.iso.date().nullable().default(null),
    })
    .superRefine(checkEvent),
])
export type EventUpdateInput = z.input<typeof eventUpdateSchema>

/** POST /events/:id/cancel : cette date, ou avec `series` celle-ci et toutes les suivantes. */
export const eventCancelSchema = z.object({ series: z.boolean().default(false) })
export type EventCancelInput = z.input<typeof eventCancelSchema>

export const venueEventsQuerySchema = z.object({
  when: z.enum(['upcoming', 'past']).default('upcoming'),
})

/** Événement dans l'espace gérant : brouillons compris, avec sa série et ses inscrits. */
export const venueEventSchema = z.object({
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
  status: z.enum(EVENT_STATUSES),
  gameIds: z.array(z.string()),
  registered: z.number().int(),
  waitlisted: z.number().int(),
  /** Modifiée seule : une modification de la série ne la change plus. */
  overridden: z.boolean(),
  series: z
    .object({
      id: z.string(),
      recurrence: recurrenceSchema,
      /** « Chaque vendredi » */
      label: z.string(),
      startDate: z.iso.date(),
      untilDate: z.iso.date().nullable(),
    })
    .nullable(),
})
export type VenueEvent = z.input<typeof venueEventSchema>
