import { z } from 'zod'
import { isoDateTime } from './common'

/**
 * Résultats des rooms classées (LKO-83, archi §12). Saisis par un joueur présent, validés quand plus de
 * la moitié des présents confirment (le saisisseur compte), ou d'office 48 h après la fin de la room s'il
 * n'y a pas de contestation. Mode normal et jeux de société : pas de résultat, seule la présence compte.
 */
export const RESULT_DEADLINE_MS = 48 * 60 * 60 * 1000

/** Relances après la fin de la room : saisir, ou confirmer le résultat saisi. */
export const RESULT_REMINDER_HOURS = [2, 24] as const

export const RESULT_STATUSES = ['PENDING', 'CONFIRMED', 'DISPUTED', 'RESOLVED', 'VOID'] as const
export type ResultStatus = (typeof RESULT_STATUSES)[number]

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  PENDING: 'À confirmer',
  CONFIRMED: 'Validé',
  DISPUTED: 'Contesté',
  RESOLVED: 'Tranché',
  VOID: 'Sans résultat',
}

/** Plus de la moitié des présents. */
export const resultMajority = (present: number) => Math.floor(present / 2) + 1

const reasonSchema = z
  .string()
  .trim()
  .min(3, { message: 'Indique un motif' })
  .max(500, { message: '500 caractères maximum' })

/** Place de chaque présent : 1 = vainqueur, places égales = nul. */
export const placementsSchema = z
  .array(z.object({ userId: z.string().min(1), place: z.number().int().min(1).max(20) }))
  .min(2)
  .max(20)
  .refine((list) => new Set(list.map((p) => p.userId)).size === list.length, {
    message: 'Chaque joueur n’a qu’une place',
  })
  .refine((list) => list.some((p) => p.place === 1), { message: 'Il faut un premier' })

export type Placements = z.output<typeof placementsSchema>

/** Duel : « 2-1 », « 1-0 », « 1-1 » ou « Nul », du point de vue du premier joueur listé. */
export const DUEL_SCORE = /^(\d-\d|Nul)$/

/** Classement d'un duel d'après son score, `ids` dans l'ordre du score. */
export function duelPlacements(ids: [string, string], score: string): Placements {
  const [a = 0, b = 0] = score === 'Nul' ? [0, 0] : score.split('-').map(Number)
  return [
    { userId: ids[0], place: a < b ? 2 : 1 },
    { userId: ids[1], place: b < a ? 2 : 1 },
  ]
}

export const submitResultSchema = z.object({
  placements: placementsSchema,
  score: z.string().regex(DUEL_SCORE, { message: 'Score invalide' }).nullish(),
})

/** Contester : motif, et son propre classement si on en propose un (contre-proposition). */
export const disputeResultSchema = z.object({
  reason: reasonSchema,
  placements: placementsSchema.optional(),
})

/** Décision du lieu ou d'un admin : un classement (celui saisi ou un autre), ou null = sans résultat. */
export const resultDecisionSchema = z.object({
  placements: placementsSchema.nullable(),
  reason: reasonSchema,
})

export const voidResultSchema = z.object({ reason: reasonSchema })

export const matchResultSchema = z.object({
  id: z.string(),
  status: z.enum(RESULT_STATUSES),
  placements: placementsSchema,
  score: z.string().nullable(),
  submittedBy: z.string().nullable(),
  createdAt: isoDateTime,
  /** Présents qui ont confirmé (saisisseur compris) et nombre requis. */
  accepted: z.number().int(),
  needed: z.number().int(),
  myVote: z.enum(['ACCEPTED', 'DISPUTED']).nullable(),
  disputes: z.array(
    z.object({
      pseudo: z.string().nullable(),
      reason: z.string().nullable(),
      placements: placementsSchema.nullable(),
    }),
  ),
  decisionReason: z.string().nullable(),
  decidedAt: isoDateTime.nullable(),
})

/** Résultat d'une room classée vu par un présent, ou par le lieu / un admin qui tranche. */
export const roomResultSchema = z.object({
  roomId: z.string(),
  title: z.string(),
  startsAt: isoDateTime,
  venueName: z.string().nullable(),
  /** Fin du délai : validation automatique sans contestation. */
  deadline: isoDateTime,
  /** Joueurs pointés présents, avec leurs LK sur le format. */
  players: z.array(
    z.object({
      userId: z.string(),
      pseudo: z.string().nullable(),
      avatarUrl: z.string().nullable(),
      rating: z.number().int(),
    }),
  ),
  /** Motif si l'on ne peut pas saisir de résultat, sinon null. */
  submitRefused: z.string().nullable(),
  result: matchResultSchema.nullable(),
})

export type SubmitResultInput = z.input<typeof submitResultSchema>
export type DisputeResultInput = z.input<typeof disputeResultSchema>
export type ResultDecisionInput = z.input<typeof resultDecisionSchema>
export type RoomResult = z.input<typeof roomResultSchema>
