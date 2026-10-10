import {
  ageOn,
  describeRecurrence,
  type EventStatus,
  formatDayMonth,
  formatTime,
  fromLocalDateTime,
  parseRrule,
  type RegistrationMode,
  type RegistrationStatus,
} from '@lucko/shared'
import { mailHtml } from '../mail/mail.layout'

export type RegistrableEvent = {
  registrationMode: RegistrationMode
  startsAt: Date
  status: EventStatus
  minAge: number | null
  capacity: number | null
}

/**
 * Inscription d'un joueur : refus (message affiché tel quel dans l'app), sinon inscrit
 * tant qu'il reste des places, puis liste d'attente. `registeredCount` exclut le joueur lui-même.
 */
export function registrationOutcome(
  event: RegistrableEvent,
  registeredCount: number,
  /** null : compte Apple / Google sans date de naissance, l'âge minimum ne peut pas être vérifié. */
  birthDate: Date | null,
  now = new Date(),
): { status: RegistrationStatus } | { refused: string } {
  if (event.registrationMode === 'NONE')
    return { refused: 'Entrée libre, pas besoin de s’inscrire' }
  if (event.registrationMode === 'EXTERNAL')
    return { refused: 'L’inscription se fait sur le site de l’organisateur' }
  if (event.status !== 'PUBLISHED') return { refused: 'Cet événement est annulé' }
  if (event.startsAt <= now) return { refused: 'Cet événement a déjà commencé' }
  if (!birthDate) return { refused: 'Renseigne ta date de naissance pour t’inscrire' }
  if (event.minAge !== null && ageOn(birthDate, now) < event.minAge)
    return { refused: `Réservé aux ${event.minAge} ans et plus` }
  const full = event.capacity !== null && registeredCount >= event.capacity
  return { status: full ? 'WAITLISTED' : 'REGISTERED' }
}

/** « 20:30 » → 1230. */
export const minuteOf = (time: string) => {
  const [h = 0, m = 0] = time.split(':').map(Number)
  return h * 60 + m
}

/** Durée d'une soirée de `startTime` à `endTime` ; une fin avant le début tombe le lendemain. */
export function durationOf(startTime: string, endTime: string | null) {
  if (endTime === null) return null
  const length = minuteOf(endTime) - minuteOf(startTime)
  return length > 0 ? length : length + 24 * 60
}

/** Début et fin d'une occurrence le `date` local, à l'heure de Paris (changements d'heure compris). */
export function occurrenceTimes(date: string, startMinute: number, durationMinutes: number | null) {
  return {
    startsAt: fromLocalDateTime(date, startMinute),
    endsAt:
      durationMinutes === null ? null : fromLocalDateTime(date, startMinute + durationMinutes),
  }
}

/** Colonne `@db.Date` (minuit UTC) ↔ date locale « 2026-10-23 ». */
export const toLocalDate = (date: Date) => date.toISOString().slice(0, 10)
export const fromLocalDate = (date: string) => new Date(`${date}T00:00:00Z`)

/** Série vue par le gérant et le joueur : la règle décodée et son libellé (« Chaque vendredi »). */
export function seriesView(series: { rrule: string; startDate: Date }) {
  const parsed = parseRrule(series.rrule)
  if (!parsed) return null
  const startDate = toLocalDate(series.startDate)
  return {
    recurrence: parsed.recurrence,
    label: describeRecurrence(parsed.recurrence, startDate),
    startDate,
  }
}

/** Un changement d'horaire d'une date à venir prévient ses inscrits. */
export const timesChanged = (
  before: { startsAt: Date; endsAt: Date | null },
  after: { startsAt: Date; endsAt: Date | null },
) =>
  before.startsAt.getTime() !== after.startsAt.getTime() ||
  (before.endsAt?.getTime() ?? null) !== (after.endsAt?.getTime() ?? null)

/** Une date encore modifiable ou annulable : ni passée, ni déjà annulée ou masquée. */
export const isEditable = (event: { status: EventStatus; startsAt: Date }, now = new Date()) =>
  (event.status === 'DRAFT' || event.status === 'PUBLISHED') && event.startsAt > now

export type EventChange = 'cancelled' | 'moved'

/** Push et e-mail aux inscrits (et à la liste d'attente) d'une date annulée ou déplacée. */
export function eventChangeMessages(
  change: EventChange,
  event: { id: string; title: string; startsAt: Date; venueName: string },
) {
  const when = `${formatDayMonth(event.startsAt)} à ${formatTime(event.startsAt)}`
  const cancelled = change === 'cancelled'
  return {
    push: {
      title: cancelled ? 'Événement annulé' : 'Horaire modifié',
      body: cancelled
        ? `« ${event.title} » chez ${event.venueName} est annulé.`
        : `« ${event.title} » chez ${event.venueName} : maintenant le ${when}.`,
      url: `/events/${event.id}`,
    },
    mail: (pseudo: string | null) => ({
      subject: cancelled ? `Annulé : ${event.title}` : `Nouvel horaire : ${event.title}`,
      html: mailHtml({
        preheader: cancelled ? `${event.venueName} a annulé cette date.` : `Maintenant le ${when}.`,
        tone: cancelled ? 'danger' : 'warning',
        verdict: cancelled ? 'Événement annulé' : 'Horaire modifié',
        headline: cancelled ? event.title : `Le ${when}`,
        greeting: pseudo ? `Bonjour ${pseudo},` : 'Bonjour,',
        paragraphs: cancelled
          ? [
              `${event.venueName} a annulé « ${event.title} », prévu le ${when}. Ton inscription est annulée, tu n’as rien à faire.`,
            ]
          : [
              `${event.venueName} a changé l’horaire de « ${event.title} », où tu es inscrit·e. Ton inscription est gardée.`,
              'Si le nouvel horaire ne te convient pas, désinscris-toi dans l’app pour libérer ta place.',
            ],
      }),
    }),
  }
}

/** Lien de la billetterie avec `utm_source=lucko`, pour les statistiques de l'organisateur. */
export function withUtm(url: string | null) {
  if (!url) return url
  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has('utm_source')) parsed.searchParams.set('utm_source', 'lucko')
    return parsed.toString()
  } catch {
    return url
  }
}
