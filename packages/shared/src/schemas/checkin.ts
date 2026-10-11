import { z } from 'zod'
import { isoDateTime } from './common'

/** QR Lucko (LKO-77) : jeton signé par l'API, valable QR_TOKEN_TTL_MS, que l'app renouvelle avant la fin. */
export const QR_TOKEN_TTL_MS = 60_000

export const qrTokenSchema = z.object({ token: z.string(), expiresAt: isoDateTime })

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

export type QrToken = z.input<typeof qrTokenSchema>
export type ScanResult = z.infer<typeof scanResultSchema>
