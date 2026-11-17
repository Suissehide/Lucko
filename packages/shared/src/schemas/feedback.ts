import { z } from 'zod'
import { FEEDBACK_CATEGORIES, FEEDBACK_PLATFORMS, FEEDBACK_STATUSES } from '../constants'
import { adminSearchSchema } from './admin'
import { isoDateTime } from './common'

// Retours utilisateurs (LKO-166) : envoyés depuis l'app, lus et suivis dans le back-office.

export const FEEDBACK_MESSAGE_MAX = 2000

/** POST /feedback : catégorie, message, et le contexte que l'app ajoute seule (écran, version, plateforme). */
export const sendFeedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z
    .string()
    .trim()
    .min(5, { message: 'Dis-nous en un peu plus' })
    .max(FEEDBACK_MESSAGE_MAX, { message: `${FEEDBACK_MESSAGE_MAX} caractères maximum` }),
  screen: z.string().trim().max(200).default(''),
  appVersion: z.string().trim().max(40).default(''),
  platform: z.enum(FEEDBACK_PLATFORMS),
})
export type SendFeedbackInput = z.input<typeof sendFeedbackSchema>

/** GET /admin/feedback : recherche dans le message ou l'auteur, filtres par statut et catégorie. */
export const adminFeedbackQuerySchema = adminSearchSchema.extend({
  status: z.enum(FEEDBACK_STATUSES).optional(),
  category: z.enum(FEEDBACK_CATEGORIES).optional(),
})
export type AdminFeedbackQuery = z.input<typeof adminFeedbackQuerySchema>

export const adminFeedbackSchema = z.object({
  id: z.string(),
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string(),
  screen: z.string(),
  appVersion: z.string(),
  platform: z.enum(FEEDBACK_PLATFORMS),
  status: z.enum(FEEDBACK_STATUSES),
  adminNote: z.string(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  /** Auteur ; `pseudo` et `email` vides si le compte a été supprimé depuis. */
  author: z.object({
    id: z.string(),
    pseudo: z.string().nullable(),
    email: z.string().nullable(),
    deleted: z.boolean(),
  }),
})
export type AdminFeedback = z.input<typeof adminFeedbackSchema>

/**
 * GET /admin/feedback : retours du filtre (les plus récents d'abord), leur nombre, et le nombre de
 * retours par statut pour la même recherche et la même catégorie.
 */
export const adminFeedbackListSchema = z.object({
  items: z.array(adminFeedbackSchema),
  matching: z.number().int(),
  counts: z.record(z.enum(FEEDBACK_STATUSES), z.number().int()),
})
export type AdminFeedbackList = z.input<typeof adminFeedbackListSchema>

/** PATCH /admin/feedback/:id : statut et note interne de l'équipe. */
export const updateFeedbackSchema = z
  .object({
    status: z.enum(FEEDBACK_STATUSES),
    adminNote: z.string().trim().max(2000, { message: '2000 caractères maximum' }),
  })
  .partial()
export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>
