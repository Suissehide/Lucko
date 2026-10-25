import { z } from 'zod'
import { PARTICIPANT_STATUSES, REPORT_REASONS } from '../constants'
import { isoDateTime } from './common'
import { emailSchema } from './user'

/** Date de la politique de confidentialité en vigueur (apps/web/src/app/privacy) : la changer avec elle. */
export const PRIVACY_POLICY_VERSION = '2026-10-15'

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
export type MyParentalConsent = z.input<typeof myParentalConsentSchema>

/** Demande d'accord vue par le parent qui ouvre le lien de l'e-mail. */
export const parentalConsentRequestSchema = z.object({
  childEmail: z.string(),
  /** Adresse qui a reçu le lien : le parent donne son accord avec ce compte-là (LKO-154). */
  parentEmail: z.string(),
  childAge: z.number().int(),
  status: z.enum(['PENDING', 'GRANTED', 'WITHDRAWN']),
  deadline: isoDateTime,
})
export type ParentalConsentRequest = z.input<typeof parentalConsentRequestSchema>

/** Enfant lié, vu par son parent : son activité, jamais ses messages (LKO-49). */
export const childActivitySchema = z.object({
  id: z.string(),
  pseudo: z.string().nullable(),
  email: z.string(),
  age: z.number().int(),
  consentAt: isoDateTime,
  /** 15 ans ou plus : compte autonome, son activité n'est plus montrée au parent. */
  autonomous: z.boolean(),
  rooms: z.array(
    z.object({
      id: z.string(),
      game: z.string(),
      /** Nom du lieu, ou « À domicile ». */
      place: z.string(),
      startsAt: isoDateTime,
      status: z.enum(PARTICIPANT_STATUSES),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      venue: z.string(),
      startsAt: isoDateTime,
    }),
  ),
  /** Signalements faits par l'enfant ou le visant, sans leur détail. */
  reports: z.array(
    z.object({
      id: z.string(),
      direction: z.enum(['MADE', 'RECEIVED']),
      reason: z.enum(REPORT_REASONS),
      createdAt: isoDateTime,
      /** Encore à l'étude tant que false. */
      handled: z.boolean(),
    }),
  ),
})
export type ChildActivity = z.input<typeof childActivitySchema>
