import { z } from 'zod'
import { isoDateTime } from './common'
import { emailSchema } from './user'

/** Date de la politique de confidentialité en vigueur (apps/web/src/app/privacy) : la changer avec elle. */
export const PRIVACY_POLICY_VERSION = '2026-10-09'

/** Sans accord parental dans ce délai, le compte d'un 13-14 ans est supprimé. */
export const PARENTAL_CONSENT_DAYS = 14

/** Code d'erreur (403) de toute action d'un 13-14 ans tant qu'un parent n'a pas donné son accord. */
export const PARENTAL_CONSENT_REQUIRED = 'PARENTAL_CONSENT_REQUIRED'

export const requestParentalConsentSchema = z.object({ parentEmail: emailSchema })
export type RequestParentalConsentInput = z.infer<typeof requestParentalConsentSchema>

/** Où en est l'accord parental, vu par l'enfant. */
export const myParentalConsentSchema = z.object({
  /** E-mail du parent de la dernière demande, null s'il n'a pas encore été saisi. */
  parentEmail: z.string().nullable(),
  granted: z.boolean(),
  /** Suppression du compte sans accord d'ici là. */
  deadline: isoDateTime,
})
export type MyParentalConsent = z.infer<typeof myParentalConsentSchema>

/** Demande d'accord vue par le parent qui ouvre le lien de l'e-mail. */
export const parentalConsentRequestSchema = z.object({
  childEmail: z.string(),
  childAge: z.number().int(),
  status: z.enum(['PENDING', 'GRANTED']),
  deadline: isoDateTime,
})
export type ParentalConsentRequest = z.infer<typeof parentalConsentRequestSchema>
