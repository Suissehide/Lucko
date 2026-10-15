import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  DIGITAL_MAJORITY_AGE,
  formatLongDay,
  localDateTime,
  PARENTAL_CONSENT_DAYS,
} from '@lucko/shared'
import { mailHtml } from '../mail/mail.layout'

const DAY_MS = 24 * 60 * 60 * 1000
const VERSION = 'pc1'

/** Relances de l'e-mail au parent, en jours après la demande (ticket : J+2 et J+5). */
export const REMINDER_DAYS = [2, 5]

/** Clé HMAC des liens d'accord parental, dérivée du secret de session comme celle des QR. */
export const consentKey = (secret = 'lucko-dev-auth-secret') =>
  createHmac('sha256', secret).update('lucko-parental-consent').digest()

/** Date de suppression d'un compte 13-14 ans resté sans accord. */
export const consentDeadline = (accountCreatedAt: Date) =>
  new Date(accountCreatedAt.getTime() + PARENTAL_CONSENT_DAYS * DAY_MS)

/** Relances encore utiles : avant l'échéance. */
export const reminderTimes = (requestedAt: Date, deadline: Date) =>
  REMINDER_DAYS.map((days) => new Date(requestedAt.getTime() + days * DAY_MS)).filter(
    (at) => at < deadline,
  )

const sign = (key: Buffer, payload: string) => createHmac('sha256', key).update(payload).digest()

/** Lien de l'e-mail : la demande et l'échéance, signées. Pas stocké : chaque relance en refait un. */
export function signConsentToken(key: Buffer, consentId: string, expiresAt: Date) {
  const payload = Buffer.from(JSON.stringify({ c: consentId, e: expiresAt.getTime() })).toString(
    'base64url',
  )
  return `${VERSION}.${payload}.${sign(key, payload).toString('base64url')}`
}

/** Demande d'un lien authentique et pas expiré, sinon null. */
export function verifyConsentToken(key: Buffer, token: string, now = new Date()): string | null {
  const [version, payload, signature] = token.split('.')
  if (version !== VERSION || !payload || !signature) return null
  const given = Buffer.from(signature, 'base64url')
  const expected = sign(key, payload)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  const data: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString())
  if (
    typeof data !== 'object' ||
    data === null ||
    !('c' in data && typeof data.c === 'string') ||
    !('e' in data && typeof data.e === 'number') ||
    data.e <= now.getTime()
  )
    return null
  return data.c
}

/** E-mail au parent : ce qu'est Lucko, pourquoi son accord, le lien, la date de suppression. */
export function consentMail(childEmail: string, link: string, deadline: Date, reminder = false) {
  const day = formatLongDay(deadline)
  return {
    subject: `${reminder ? 'Rappel : v' : 'V'}otre enfant a besoin de votre accord pour jouer sur Lucko`,
    html: mailHtml({
      preheader: `Sans accord avant le ${day}, son compte sera supprimé.`,
      tone: 'warning',
      verdict: 'Accord parental',
      headline: 'Votre enfant veut rejoindre Lucko',
      greeting: 'Bonjour,',
      paragraphs: [
        `Un compte Lucko vient d’être créé avec l’adresse ${childEmail}, et votre e-mail a été indiqué comme celui d’un parent. Lucko aide à trouver où jouer à des jeux de société et de cartes près de chez soi.`,
        'Votre enfant a moins de 15 ans : la loi demande l’accord d’un parent avant qu’il utilise son compte. D’ici là, il ne peut rien faire sur Lucko.',
        `Sans réponse avant le ${day}, le compte et ses données seront supprimés.`,
      ],
      action: { label: 'Lire et donner mon accord', href: link },
      closing: 'Vous ne connaissez pas ce compte ? Ignorez cet e-mail : il sera supprimé.',
      footer:
        'Vous recevez cet e-mail car votre adresse a été indiquée comme celle d’un parent à la création d’un compte Lucko.',
    }),
  }
}

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/**
 * Dates de naissance (UTC, comme en base) des enfants qui ont 15 ans aujourd'hui à Paris. Né un
 * 29 février : son anniversaire tombe le 1er mars les années non bissextiles.
 */
export function fifteenthBirthdays(now = new Date()) {
  const [year, month, day] = localDateTime(now).date.split('-').map(Number) as [
    number,
    number,
    number,
  ]
  const born = year - DIGITAL_MAJORITY_AGE
  const dates = [new Date(Date.UTC(born, month - 1, day))]
  if (month === 3 && day === 1 && !isLeap(year) && isLeap(born))
    dates.push(new Date(Date.UTC(born, 1, 29)))
  return dates
}

const PARENT_FOOTER =
  'Vous recevez cet e-mail car votre compte Lucko est lié à celui de votre enfant.'

/** Au parent : l'enfant a 15 ans, son compte devient autonome. */
export function turnedFifteenMail(child: string) {
  return {
    subject: `${child} a 15 ans : son compte Lucko devient autonome`,
    html: mailHtml({
      preheader: 'Les protections des mineurs restent actives jusqu’à ses 18 ans.',
      tone: 'warning',
      verdict: 'Compte autonome',
      headline: `${child} a 15 ans`,
      greeting: 'Bonjour,',
      paragraphs: [
        'À 15 ans, la loi ne demande plus l’accord d’un parent : son compte Lucko devient autonome et vous ne voyez plus son activité.',
        'Les protections des mineurs restent actives jusqu’à ses 18 ans : pas de messages privés avec des adultes inconnus, pas de parties à domicile sans vous, pas de notifications la nuit.',
      ],
      footer: PARENT_FOOTER,
    }),
  }
}

/** Au parent : accord retiré, le compte de l'enfant est supprimé. */
export function withdrawnParentMail(child: string) {
  return {
    subject: `Accord retiré : le compte de ${child} est supprimé`,
    html: mailHtml({
      preheader: 'Plus rien ne permet de l’identifier sur Lucko.',
      tone: 'danger',
      verdict: 'Accord retiré',
      headline: 'Son compte est supprimé',
      greeting: 'Bonjour,',
      paragraphs: [
        `Vous avez retiré votre accord pour le compte de ${child}. Il a été supprimé : plus rien ne permet de l’identifier sur Lucko.`,
      ],
      footer: PARENT_FOOTER,
    }),
  }
}

/** À l'enfant : son parent a retiré son accord, son compte est supprimé. */
export function withdrawnChildMail() {
  return {
    subject: 'Ton compte Lucko est supprimé',
    html: mailHtml({
      preheader: 'Ton parent a retiré son accord.',
      tone: 'danger',
      verdict: 'Compte supprimé',
      headline: 'Ton parent a retiré son accord',
      greeting: 'Bonjour,',
      paragraphs: [
        'Avant 15 ans, ton compte Lucko a besoin de l’accord d’un parent. Il l’a retiré : ton compte et tes données ont été supprimés.',
        'Parles-en avec lui ou elle : tu pourras recréer un compte avec son accord.',
      ],
    }),
  }
}
