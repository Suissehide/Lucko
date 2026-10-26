import { z } from 'zod'
import { isoDateTime } from './common'

/** QR Lucko (LKO-77) : jeton signé par l'API, valable QR_TOKEN_TTL_MS, que l'app renouvelle avant la fin. */
export const QR_TOKEN_TTL_MS = 60_000

export const qrTokenSchema = z.object({
  token: z.string(),
  expiresAt: isoDateTime,
  /** Code à 6 chiffres affiché sous le QR, à saisir au comptoir sans caméra (LKO-160). */
  code: z.string(),
})

/** Code saisi à la main au comptoir (sans caméra) : 6 chiffres, espace toléré (« 482 913 »). */
export const MANUAL_CODE = /^\d{3} ?\d{3}$/

/** `token` : jeton lu dans le QR, ou code à 6 chiffres saisi à la main. */
export const scanBodySchema = z.object({ token: z.string().trim().min(1).max(500) })

/** Résultat d'un scan au comptoir, montré au staff du lieu. */
export const scanResultSchema = z.object({
  pseudo: z.string().nullable(),
  /** Mineur : pas d'avantage sur l'alcool. */
  minor: z.boolean(),
  /** Avantage Lucko du lieu, à accorder si ce n'est pas déjà fait ce soir. */
  perk: z.string().nullable(),
  /** Déjà scanné ce soir dans ce lieu : pas de deuxième avantage. */
  alreadyScanned: z.boolean(),
})

/** Avantage Lucko d'un lieu partenaire, offert au scan du QR (« -10 % sur les boosters ») ; vide = aucun. */
export const luckoPerkSchema = z
  .string()
  .trim()
  .max(120, { message: '120 caractères maximum' })
  .nullable()

/** GET et PUT /venues/:venueId/perk : saisi par le gérant d'un lieu partenaire (LKO-92). */
export const venuePerkSchema = z.object({ luckoPerk: luckoPerkSchema })
export type VenuePerk = z.input<typeof venuePerkSchema>

export type QrToken = z.input<typeof qrTokenSchema>
export type ScanResult = z.infer<typeof scanResultSchema>
