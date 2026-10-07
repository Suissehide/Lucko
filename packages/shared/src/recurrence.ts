import { addDays, isoWeekday } from './opening'

/**
 * Récurrence d'un événement (LKO-61), stockée en RRULE (RFC 5545) sur la série. Seul ce sous-ensemble
 * est accepté : chaque semaine, une semaine sur deux, ou le n-ième / dernier jour du mois. Le jour de
 * la semaine est toujours celui de la première date de la série.
 */
export type Recurrence = { freq: 'WEEKLY'; interval: 1 | 2 } | { freq: 'MONTHLY'; nth: MonthlyNth }
export type MonthlyNth = 1 | 2 | 3 | 4 | -1

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const WEEKDAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const DAY_MS = 24 * 60 * 60 * 1000

/** « FREQ=WEEKLY;INTERVAL=2;BYDAY=FR », « FREQ=MONTHLY;BYDAY=-1FR » ; `startDate` donne le jour. */
export function toRrule(recurrence: Recurrence, startDate: string) {
  const day = BYDAY[isoWeekday(startDate) - 1]
  return recurrence.freq === 'WEEKLY'
    ? `FREQ=WEEKLY;INTERVAL=${recurrence.interval};BYDAY=${day}`
    : `FREQ=MONTHLY;BYDAY=${recurrence.nth}${day}`
}

/** Inverse de `toRrule` ; null pour une règle hors du sous-ensemble accepté. */
export function parseRrule(rrule: string): { recurrence: Recurrence; weekday: number } | null {
  const weekly = /^FREQ=WEEKLY;INTERVAL=([12]);BYDAY=(MO|TU|WE|TH|FR|SA|SU)$/.exec(rrule)
  if (weekly) {
    const interval = Number(weekly[1]) as 1 | 2
    return { recurrence: { freq: 'WEEKLY', interval }, weekday: BYDAY.indexOf(weekly[2] ?? '') + 1 }
  }
  const monthly = /^FREQ=MONTHLY;BYDAY=(-1|[1-4])(MO|TU|WE|TH|FR|SA|SU)$/.exec(rrule)
  if (monthly) {
    const nth = Number(monthly[1]) as MonthlyNth
    return { recurrence: { freq: 'MONTHLY', nth }, weekday: BYDAY.indexOf(monthly[2] ?? '') + 1 }
  }
  return null
}

/** n-ième (ou dernier avec -1) jour `weekday` (1 = lundi) du mois « 2026-10 ». */
function nthWeekdayOf(month: string, weekday: number, nth: MonthlyNth) {
  if (nth === -1) {
    const [year = 0, m = 1] = month.split('-').map(Number)
    const last = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10)
    return addDays(last, -((isoWeekday(last) - weekday + 7) % 7))
  }
  const first = `${month}-01`
  return addDays(first, ((weekday - isoWeekday(first) + 7) % 7) + (nth - 1) * 7)
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)

/**
 * Dates locales (« 2026-10-23 ») des occurrences de la série dans [`from`, `to`[, jamais avant
 * `startDate` (première date) ni après `until` (inclus). L'heure est ajoutée par l'appelant, à l'heure
 * de Paris : une soirée à 20 h reste à 20 h après le changement d'heure.
 */
export function occurrenceDates(
  rrule: string,
  startDate: string,
  { from, to, until = null }: { from: string; to: string; until?: string | null },
): string[] {
  const parsed = parseRrule(rrule)
  if (!parsed) throw new Error(`Règle de récurrence non prise en charge : ${rrule}`)
  const first = from > startDate ? from : startDate
  const end = until !== null && until < to ? addDays(until, 1) : to
  const dates: string[] = []
  const { recurrence, weekday } = parsed
  if (recurrence.freq === 'WEEKLY') {
    const step = 7 * recurrence.interval
    let date = addDays(startDate, Math.ceil(daysBetween(startDate, first) / step) * step)
    for (; date < end; date = addDays(date, step)) dates.push(date)
  } else {
    for (let month = first.slice(0, 7); month <= end.slice(0, 7); ) {
      const date = nthWeekdayOf(month, weekday, recurrence.nth)
      if (date >= first && date < end) dates.push(date)
      const [year = 0, m = 1] = month.split('-').map(Number)
      month = new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 7)
    }
  }
  return dates
}

/** « Chaque vendredi », « Un vendredi sur deux », « Le 1er vendredi du mois ». */
export function describeRecurrence(recurrence: Recurrence, startDate: string) {
  const day = WEEKDAY_NAMES[isoWeekday(startDate) - 1]
  if (recurrence.freq === 'WEEKLY')
    return recurrence.interval === 1 ? `Chaque ${day}` : `Un ${day} sur deux`
  if (recurrence.nth === -1) return `Le dernier ${day} du mois`
  return `Le ${recurrence.nth === 1 ? '1er' : `${recurrence.nth}e`} ${day} du mois`
}
