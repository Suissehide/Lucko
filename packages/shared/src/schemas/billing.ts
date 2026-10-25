import { z } from 'zod'
import { isoDateTime } from './common'

/** Venues facturables (LKO-79) : le lieu peut contester une venue pendant 14 jours après la soirée. */
export const DISPUTE_DAYS = 14

export const VISIT_STATUSES = ['VALID', 'DISPUTED', 'CANCELLED'] as const
export const VISIT_SOURCES = ['QR_SCAN', 'CHECK_IN'] as const

const reasonSchema = z
  .string()
  .trim()
  .min(3, { message: 'Indique un motif' })
  .max(500, { message: '500 caractères maximum' })

export const venueVisitsQuerySchema = z.object({
  /** Mois « 2026-10 » ; par défaut le mois de la soirée en cours. */
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Mois AAAA-MM' })
    .optional(),
})

export const venueVisitSchema = z.object({
  id: z.string(),
  /** Soirée de rattachement (date locale). */
  businessDate: z.iso.date(),
  pseudo: z.string().nullable(),
  source: z.enum(VISIT_SOURCES),
  priceCents: z.number().int().nullable(),
  status: z.enum(VISIT_STATUSES),
  disputeReason: z.string().nullable(),
  /** Motif si le lieu ne peut plus la contester, sinon null. */
  disputeRefused: z.string().nullable(),
})

/** Venues facturables d'un lieu pour un mois, avec le total prévisionnel (venues valides). */
export const venueVisitsSchema = z.object({
  month: z.string(),
  pricePerVisitCents: z.number().int().nullable(),
  visits: z.array(venueVisitSchema),
  validCount: z.number().int(),
  disputedCount: z.number().int(),
  totalCents: z.number().int(),
})

export const disputeVisitSchema = z.object({ reason: reasonSchema })

/** Décision d'un admin sur une venue : la garder (VALID) ou l'annuler. */
export const adminVisitDecisionSchema = z.object({
  status: z.enum(['VALID', 'CANCELLED']),
  reason: reasonSchema,
})

/** GET /admin/visits/disputes : venues contestées par les lieux, à trancher (LKO-146). */
export const adminDisputedVisitSchema = z.object({
  id: z.string(),
  businessDate: z.iso.date(),
  venueName: z.string(),
  pseudo: z.string().nullable(),
  source: z.enum(VISIT_SOURCES),
  priceCents: z.number().int().nullable(),
  disputeReason: z.string().nullable(),
  disputedAt: isoDateTime.nullable(),
})

export type AdminDisputedVisit = z.input<typeof adminDisputedVisitSchema>
export type AdminVisitDecision = z.input<typeof adminVisitDecisionSchema>
export type VenueVisit = z.input<typeof venueVisitSchema>
export type VenueVisits = z.input<typeof venueVisitsSchema>
