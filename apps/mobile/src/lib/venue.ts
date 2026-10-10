import type {
  AccessibilityStatus,
  CalendarDay,
  ContentKind,
  StatusTone,
} from '@lucko/design-system'
import { contentColor } from '@lucko/design-system'
import {
  EVENT_TYPE_LABELS,
  type EventType,
  formatDayMonth,
  formatHour,
  formatMinuteOfDay,
  formatPrice,
  localDateTime,
  monthGrid,
  rangesOn,
  VENUE_TIME_ZONE,
  type VenueDetail,
} from '@lucko/shared'
import { eventPlaces, gameLabel, isFull, localDay } from './explore'

type VenueEvent = VenueDetail['events'][number]
type Closure = VenueDetail['closures'][number]

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const capitalize = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`

/** Date locale « 2026-11-01 » formatée telle quelle (pas de décalage de fuseau). */
const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...options }).format(
    new Date(`${date}T00:00:00Z`),
  )

/** « Samedi 3 octobre ». */
export const longDate = (date: string) =>
  capitalize(formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' }))

/** « Octobre 2026 ». */
export const monthTitle = (month: string) =>
  capitalize(formatDate(`${month}-01`, { month: 'long', year: 'numeric' }))

// * OUVERTURE

/** Pastille d'ouverture : « Ouvert · jusqu'à 1 h », « Ferme bientôt · 1 h », « Fermé · ouvre demain à 14 h ». */
export function openingPill(
  venue: Pick<VenueDetail, 'openNow' | 'closesAtMinute' | 'nextOpening'>,
): { tone: StatusTone; label: string; short: string } | null {
  const { date: today, minute } = localDateTime(new Date())
  if (venue.openNow === null) return null
  if (venue.openNow) {
    if (venue.closesAtMinute === null) return { tone: 'ok', label: 'Ouvert', short: 'Ouvert' }
    const closes = formatMinuteOfDay(venue.closesAtMinute)
    const left = (venue.closesAtMinute - minute + 24 * 60) % (24 * 60)
    return left <= 60
      ? { tone: 'warn', label: `Ferme bientôt · ${closes}`, short: `Ferme à ${closes}` }
      : { tone: 'ok', label: `Ouvert · jusqu'à ${closes}`, short: 'Ouvert' }
  }
  const next = venue.nextOpening
  if (!next) return { tone: 'err', label: 'Fermé', short: 'Fermé' }
  const at = formatMinuteOfDay(next.minute)
  const days = Math.round((Date.parse(next.date) - Date.parse(today)) / (24 * 60 * 60 * 1000))
  const when =
    days === 0
      ? `ouvre à ${at}`
      : days === 1
        ? `ouvre demain à ${at}`
        : days < 7
          ? `ouvre ${formatDate(next.date, { weekday: 'long' })} à ${at}`
          : `ouvre le ${formatDate(next.date, { day: 'numeric', month: 'short' })} à ${at}`
  return { tone: 'err', label: `Fermé · ${when}`, short: 'Fermé' }
}

// * INFOS PRATIQUES

export function venueFacts(venue: VenueDetail) {
  return [
    {
      label: 'Droit de jeu',
      value: venue.playFeeCents ? (formatPrice(venue.playFeeCents) ?? '') : 'Gratuit',
      note: venue.playFeeCents ? 'par personne, toute la soirée' : 'Pas de droit de jeu',
    },
    {
      label: 'Conso minimum',
      short: 'Conso min.',
      value: venue.minSpendCents ? (formatPrice(venue.minSpendCents) ?? '') : 'Aucune',
      note: venue.minSpendCents ? 'par personne' : 'Rien à consommer',
    },
    venue.acceptsUnaccompaniedMinors
      ? { label: 'Âge', value: 'Tous âges', note: 'Mineurs acceptés seuls' }
      : { label: 'Âge', value: '16 ans +', note: "Moins de 16 ans accompagnés d'un adulte" },
  ]
}

/** Horaires de la semaine, plages jointes par « · » ; aujourd'hui marqué. */
export function hoursRows(hours: VenueDetail['openingHours']) {
  const today = localDateTime(new Date()).weekday
  return WEEKDAYS.map((day, i) => {
    const ranges = hours
      .filter((h) => h.weekday === i + 1)
      .map((h) => `${formatMinuteOfDay(h.opensAtMinute)} – ${formatMinuteOfDay(h.closesAtMinute)}`)
    return {
      day,
      value: ranges.length ? ranges.join(' · ') : 'Fermé',
      closed: !ranges.length,
      today: i + 1 === today,
    }
  })
}

/** « 1er nov. », « 23 – 27 déc. », « 30 déc. – 2 janv. ». */
export function closureDate({ startsOn, endsOn }: Pick<Closure, 'startsOn' | 'endsOn'>) {
  const day = (date: string) => {
    const n = Number(date.slice(8, 10))
    return n === 1 ? '1er' : String(n)
  }
  const month = (date: string) => formatDate(date, { month: 'short' })
  if (startsOn === endsOn) return `${day(startsOn)} ${month(startsOn)}`
  if (startsOn.slice(0, 7) === endsOn.slice(0, 7)) {
    return `${day(startsOn)} – ${day(endsOn)} ${month(endsOn)}`
  }
  return `${day(startsOn)} ${month(startsOn)} – ${day(endsOn)} ${month(endsOn)}`
}

/** Fermetures à venir (celles déjà passées restent dans le calendrier). */
export function upcomingClosures(closures: Closure[]) {
  const today = localDateTime(new Date()).date
  return closures
    .filter((c) => c.endsOn >= today)
    .map((c) => ({
      id: `${c.startsOn}-${c.label}`,
      date: closureDate(c),
      label: c.label,
      note: c.note,
      special: c.kind === 'SPECIAL_HOURS',
    }))
}

export const accessibilityItems = (items: VenueDetail['accessibility']) =>
  items.map((item) => ({
    label: item.label,
    note: item.note,
    status: item.status.toLowerCase() as AccessibilityStatus,
  }))

// * JEUX SUR PLACE

export function gameTabs(venue: VenueDetail) {
  const tcg = venue.games.filter((g) => g.kind === 'TCG').map(gameLabel)
  const board = venue.boardGames
  const boardCount = Math.max(venue.boardGameCount ?? 0, board.length)
  const others = boardCount - board.length
  return [
    { key: 'tcg', title: 'TCG', count: tcg.length, note: venue.tcgNote, games: tcg, more: null },
    {
      key: 'board',
      title: 'Jeux de société',
      count: boardCount,
      note: venue.boardGameNote,
      games: board,
      more: others > 0 ? `+ ${others} autres` : null,
    },
  ].filter((tab) => tab.count > 0)
}

// * AGENDA

export const EVENT_FILTERS: { label: string; types: EventType[] | null }[] = [
  { label: 'Tout', types: null },
  { label: 'Soirées', types: ['GAME_NIGHT', 'THEMED'] },
  { label: 'Tournois', types: ['TOURNAMENT', 'PRERELEASE'] },
  { label: 'Initiations', types: ['INITIATION'] },
]

export const AGENDA_LEGEND = [
  { label: 'Soirée · initiation', color: contentColor.event },
  { label: 'Tournoi', color: contentColor.room },
]

/** Tournois et avant-premières en rouge, soirées et initiations en bleu. */
export const eventKind = (type: EventType): ContentKind =>
  type === 'TOURNAMENT' || type === 'PRERELEASE' ? 'room' : 'event'

const SERVICES: Record<string, string> = { eventlink: 'EventLink', helloasso: 'HelloAsso' }

/** Nom du service d'inscription déduit de l'URL : « EventLink », sinon le domaine. */
export function externalService(url: string | null) {
  if (!url) return 'le site'
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const known = Object.keys(SERVICES).find((key) => host.includes(key))
    return known ? SERVICES[known] : host
  } catch {
    return 'le site'
  }
}

export type AgendaAction =
  | { kind: 'ghost' | 'room' | 'soft'; label: string; url?: undefined }
  | { kind: 'ghost'; label: string; url: string }

/**
 * Bouton selon l'inscription du joueur et le mode d'inscription ; l'inscription elle-même se fait sur la
 * fiche événement. Sert aussi aux cartes d'Explorer (pas de lien externe direct).
 */
export function agendaAction(
  event: Pick<
    VenueEvent,
    'registrationMode' | 'myRegistration' | 'capacity' | 'registeredCount'
  > & {
    externalUrl?: string | null
  },
): AgendaAction {
  if (event.myRegistration === 'REGISTERED') return { kind: 'ghost', label: 'Inscrit ✓' }
  if (event.myRegistration === 'WAITLISTED') return { kind: 'ghost', label: "En liste d'attente" }
  if (event.registrationMode === 'NONE') return { kind: 'ghost', label: 'Voir' }
  if (event.registrationMode === 'EXTERNAL' && event.externalUrl) {
    return { kind: 'ghost', label: 'Inscription', url: event.externalUrl }
  }
  return isFull(event)
    ? { kind: 'soft', label: "Liste d'attente" }
    : { kind: 'room', label: "S'inscrire" }
}

function places(event: VenueEvent) {
  if (event.registrationMode === 'NONE') return { text: 'Entrée libre', alert: false }
  if (event.registrationMode === 'EXTERNAL') {
    return { text: `Sur ${externalService(event.externalUrl)}`, alert: false }
  }
  const left = event.capacity === null ? null : event.capacity - event.registeredCount
  return { text: eventPlaces(event), alert: left !== null && left <= 2 }
}

/** Date de l'agenda : couleur du type, bloc date, libellé, « 19 h 30 · 8 € · Chaque mardi », places. */
export function agendaItem(event: VenueEvent, playFeeCents: number | null) {
  const games = event.games.length ? event.games.map(gameLabel).join(', ') : 'Tous jeux'
  const weekday = new Intl.DateTimeFormat('fr-FR', {
    timeZone: VENUE_TIME_ZONE,
    weekday: 'long',
  }).format(new Date(event.startsAt))
  const price = formatPrice(event.priceCents) ?? (playFeeCents ? 'Droit de jeu' : 'Gratuit')
  const hour = formatHour(event.startsAt)
  const { day, month } = formatDayMonth(event.startsAt)
  const spots = places(event)
  return {
    kind: eventKind(event.type),
    weekday: weekday.slice(0, 3).toUpperCase(),
    day,
    month,
    label: `${EVENT_TYPE_LABELS[event.type]} · ${games}`,
    games,
    title: event.title,
    hour,
    price,
    meta: [hour, price, event.recurrenceLabel].filter(Boolean).join(' · '),
    places: spots.text,
    placesAlert: spots.alert,
    action: agendaAction(event),
  }
}

export const matchesFilter = (event: VenueEvent, filter: number) =>
  EVENT_FILTERS[filter]?.types?.includes(event.type) ?? true

/** Cases du calendrier d'un mois : jours fermés (horaires et fermetures), passés, événements. */
export function calendarDays(
  month: string,
  venue: VenueDetail,
  events: VenueEvent[],
): CalendarDay[] {
  const today = localDateTime(new Date()).date
  const hasHours = venue.openingHours.length > 0
  return monthGrid(month).map((date, i) => {
    if (!date) return { key: `${month}-vide-${i}`, day: null, items: [] }
    const exceptional = venue.closures.some(
      (c) => c.kind === 'CLOSED' && c.startsOn <= date && date <= c.endsOn,
    )
    return {
      key: date,
      day: Number(date.slice(8, 10)),
      today: date === today,
      past: date < today,
      closed: hasHours && rangesOn(date, venue.openingHours, venue.closures).length === 0,
      closedLabel: exceptional ? 'Fermé' : undefined,
      items: events
        .filter((e) => localDay(e.startsAt) === date)
        .map((e) => ({ label: e.title, color: contentColor[eventKind(e.type)] })),
    }
  })
}
