import { VENUE_TIME_ZONE } from './constants'

export type OpeningRange = { weekday: number; opensAtMinute: number; closesAtMinute: number }

/** Fermeture exceptionnelle du `startsOn` au `endsOn` inclus, en dates locales « 2026-11-01 ». */
export type ClosureRange = {
  startsOn: string
  endsOn: string
  kind: 'CLOSED' | 'SPECIAL_HOURS'
  opensAtMinute: number | null
  closesAtMinute: number | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Durée supposée d'une soirée publiée sans heure de fin (LKO-136). */
export const EVENT_DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000

/**
 * Ouvert à `at` : une soirée publiée par le lieu l'ouvre pendant sa durée, même hors de ses horaires
 * (LKO-136) ; sinon, l'ouverture d'après les horaires (`openNow`, null si horaires inconnus).
 */
export const openWithEvents = (
  openNow: boolean | null,
  events: { startsAt: Date; endsAt: Date | null }[],
  at: Date,
) =>
  events.some(
    (e) =>
      e.startsAt <= at &&
      at < (e.endsAt ?? new Date(e.startsAt.getTime() + EVENT_DEFAULT_DURATION_MS)),
  ) || openNow

/** Date locale (« 2026-10-06 »), jour ISO (1 = lundi) et minute depuis minuit à l'heure du lieu. */
export function localDateTime(now: Date, timeZone = VENUE_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WEEKDAYS.indexOf(get('weekday')) + 1,
    minute: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

/** « 2026-10 » + n mois. */
export function addMonths(month: string, months: number) {
  const [year = 0, m = 1] = month.split('-').map(Number)
  return new Date(Date.UTC(year, m - 1 + months, 1)).toISOString().slice(0, 7)
}

/** Cases d'un mois « 2026-10 » par semaines, lundi en premier ; null hors du mois. */
export function monthGrid(month: string): (string | null)[] {
  const [year = 0, m = 1] = month.split('-').map(Number)
  const first = `${month}-01`
  const lead = isoWeekday(first) - 1
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return Array.from({ length: Math.ceil((lead + count) / 7) * 7 }, (_, i) =>
    i < lead || i >= lead + count ? null : addDays(first, i - lead),
  )
}

/** 1 = lundi … 7 = dimanche. */
export const isoWeekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7

/** Plages d'une date locale : une fermeture exceptionnelle remplace les horaires de la semaine. */
export function rangesOn(date: string, hours: OpeningRange[], closures: ClosureRange[] = []) {
  const closure = closures.find((c) => c.startsOn <= date && date <= c.endsOn)
  if (closure) {
    const { opensAtMinute, closesAtMinute } = closure
    return closure.kind === 'SPECIAL_HOURS' && opensAtMinute !== null && closesAtMinute !== null
      ? [{ opensAtMinute, closesAtMinute }]
      : []
  }
  const weekday = isoWeekday(date)
  return hours
    .filter((h) => h.weekday === weekday)
    .map(({ opensAtMinute, closesAtMinute }) => ({ opensAtMinute, closesAtMinute }))
}

/**
 * Ouvert maintenant ? Une plage dont la fermeture précède l'ouverture déborde sur le lendemain
 * (17 h → 1 h). Fermé : prochaine ouverture dans le mois. null si aucun horaire n'est renseigné.
 */
export function openingStatus(
  hours: OpeningRange[],
  closures: ClosureRange[],
  now: Date,
  timeZone = VENUE_TIME_ZONE,
) {
  if (hours.length === 0) return { openNow: null, closesAtMinute: null, nextOpening: null }
  const { date, minute } = localDateTime(now, timeZone)
  const overnight = (r: { opensAtMinute: number; closesAtMinute: number }) =>
    r.closesAtMinute <= r.opensAtMinute
  const current =
    rangesOn(date, hours, closures).find(
      (r) => minute >= r.opensAtMinute && (overnight(r) || minute < r.closesAtMinute),
    ) ??
    rangesOn(addDays(date, -1), hours, closures).find(
      (r) => overnight(r) && minute < r.closesAtMinute,
    )
  if (current) return { openNow: true, closesAtMinute: current.closesAtMinute, nextOpening: null }
  for (let i = 0; i <= 31; i++) {
    const day = addDays(date, i)
    const opens = rangesOn(day, hours, closures)
      .map((r) => r.opensAtMinute)
      .filter((m) => i > 0 || m > minute)
    if (opens.length) {
      return {
        openNow: false,
        closesAtMinute: null,
        nextOpening: { date: day, minute: Math.min(...opens) },
      }
    }
  }
  return { openNow: false, closesAtMinute: null, nextOpening: null }
}

/** Instant d'une date locale (« 2026-10-24 ») à `minute` depuis minuit, heure du lieu (changements d'heure compris). */
export function fromLocalDateTime(date: string, minute: number, timeZone = VENUE_TIME_ZONE) {
  const wanted = Date.parse(`${date}T00:00:00Z`) + minute * 60_000
  let instant = wanted
  // Deux passes : l'écart avec UTC peut changer entre la première estimation et l'heure visée
  for (let i = 0; i < 2; i++) {
    const local = localDateTime(new Date(instant), timeZone)
    instant += wanted - (Date.parse(`${local.date}T00:00:00Z`) + local.minute * 60_000)
  }
  return new Date(instant)
}

export const AGENDA_RANGES = ['tonight', 'tomorrow', 'weekend', 'week'] as const
export type AgendaRange = (typeof AGENDA_RANGES)[number]

/**
 * Jours locaux d'une période de l'agenda de la ville : ce soir, demain, ce week-end (le samedi
 * et le dimanche à venir, ou ce qu'il en reste), les 7 prochains jours.
 */
export function agendaRangeDays(range: AgendaRange, now = new Date()): string[] {
  const { date, weekday } = localDateTime(now)
  if (range === 'tonight') return [date]
  if (range === 'tomorrow') return [addDays(date, 1)]
  if (range === 'week') return Array.from({ length: 7 }, (_, i) => addDays(date, i))
  if (weekday === 7) return [date]
  const saturday = addDays(date, 6 - weekday)
  return [saturday, addDays(saturday, 1)]
}
