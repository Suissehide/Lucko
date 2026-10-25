import { colors } from '@lucko/design-system'
import {
  AGENDA_RANGES,
  type AgendaRange,
  EVENT_TYPE_LABELS,
  EVENT_TYPES,
  type EventListItem,
  type EventType,
  formatDistance,
  formatPrice,
  formatTime,
  type RoomListItem,
  VENUE_TIME_ZONE,
} from '@lucko/shared'
import {
  eventPlaces,
  GAMES,
  gameLabel,
  localDay,
  matchesGame,
  ROOM_STATUS_LABELS,
  shortDay,
} from './explore'
import { type AgendaAction, agendaAction } from './venue'

/** Rendez-vous des lieux partenaires mis en avant en tête de l'agenda. */
const PARTNER_HIGHLIGHTS = 3

export const RANGE_LABELS: Record<AgendaRange, string> = {
  tonight: 'Ce soir',
  tomorrow: 'Demain',
  weekend: 'Ce week-end',
  week: '7 jours',
}

type Kind = 'ROOM' | EventType

export const KINDS: Kind[] = ['ROOM', ...EVENT_TYPES]
const KIND_LABELS: Record<Kind, string> = { ROOM: 'Room', ...EVENT_TYPE_LABELS }

/** Liseré et fond de l'étiquette de chaque type. */
export const KIND_COLORS: Record<Kind, { color: string; tint: string }> = {
  ROOM: { color: colors.rating, tint: colors.ratingPale },
  GAME_NIGHT: { color: colors.event, tint: colors.eventSoft },
  THEMED: { color: colors.event, tint: colors.eventSoft },
  INITIATION: { color: colors.venue, tint: colors.venueSoft },
  TOURNAMENT: { color: colors.room, tint: colors.roomSoft },
  PRERELEASE: { color: colors.prerelease, tint: colors.ratingSoft },
}

export const AGENDA_LEGEND = [
  { label: 'Room entre joueurs', color: colors.rating },
  { label: 'Soirée jeux', color: colors.event },
  { label: 'Initiation', color: colors.venue },
  { label: 'Tournoi', color: colors.room },
  { label: 'Avant-première', color: colors.prerelease },
]

const DISTANCES = [1, 3, 10]
const GAME_KEYS = GAMES.flatMap((g) => (g.key ? [g.key] : []))

// * RENDEZ-VOUS

/** Room ou événement d'un lieu, à plat pour filtrer et afficher. */
export type AgendaEntry = {
  id: string
  kind: Kind
  startsAt: string
  title: string
  venue: { name: string; isPartner: boolean; distanceMeters: number }
  /** Vide : soirée tous jeux. */
  games: { slug: string; name: string }[]
  places: { text: string; short: string; tone?: 'alert' | 'off' } | null
  price: string
  free: boolean
  full: boolean
  adult: boolean
  /** null : room où le joueur n'est pas (« Rejoindre »). */
  action: AgendaAction | null
}

const ADULT_AGE = 18

function seats(taken: number, max: number): AgendaEntry['places'] {
  const left = max - taken
  if (left <= 0) return { text: 'Complet', short: 'Complet', tone: 'off' }
  if (left === 1) return { text: '1 place', short: '1 pl.', tone: 'alert' }
  return { text: `${taken} / ${max} places`, short: `${taken} / ${max}` }
}

function eventEntry(e: EventListItem): AgendaEntry {
  const full = e.capacity !== null && e.registeredCount >= e.capacity
  const other = eventPlaces(e)
  const places =
    e.registrationMode === 'IN_APP' && e.capacity !== null
      ? seats(e.registeredCount, e.capacity)
      : other
        ? { text: other, short: other }
        : null
  return {
    id: e.id,
    kind: e.type,
    startsAt: e.startsAt,
    title: e.title,
    venue: e.venue,
    games: e.games,
    places,
    price: formatPrice(e.priceCents) ?? 'Gratuit',
    free: !e.priceCents,
    full,
    adult: (e.minAge ?? 0) >= ADULT_AGE,
    action: agendaAction(e),
  }
}

function roomEntry(r: RoomListItem): AgendaEntry {
  return {
    id: r.id,
    kind: 'ROOM',
    startsAt: r.startsAt,
    title: [`Room ${gameLabel(r.game)}`, r.format, r.bracket ? `Bracket ${r.bracket}` : null]
      .filter(Boolean)
      .join(' · '),
    // À domicile : le quartier et la distance jusqu'à la zone floue
    venue: r.venue ?? {
      name: r.home?.areaLabel ?? 'À domicile',
      isPartner: false,
      distanceMeters: r.home?.distanceMeters ?? 0,
    },
    games: [r.game],
    places: seats(r.players.length, r.capacity),
    price: 'Gratuit',
    free: true,
    full: r.players.length >= r.capacity,
    adult: false,
    action: r.myStatus ? { kind: 'ghost', label: ROOM_STATUS_LABELS[r.myStatus] } : null,
  }
}

/** Rooms et événements mêlés, par heure puis dans l'ordre de l'API (distance, tri honnête). */
export const agendaEntries = (events: EventListItem[], rooms: RoomListItem[]) =>
  [...events.map(eventEntry), ...rooms.map(roomEntry)].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  )

// * FILTRES

export type AgendaFilters = {
  range: AgendaRange
  kinds: Kind[]
  games: string[]
  km: number | null
  free: boolean
  available: boolean
  noAdult: boolean
}

type Params = Partial<Record<string, string | string[]>>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const list = <T extends string>(v: string | string[] | undefined, allowed: readonly T[]) =>
  (one(v) ?? '').split(',').filter((x): x is T => allowed.includes(x as T))

/** Filtres lus dans l'URL (`?range=weekend&type=TOURNAMENT,ROOM&game=magic&km=3&free=1`). */
export function parseFilters(params: Params): AgendaFilters {
  const range = one(params.range)
  const km = Number(one(params.km))
  return {
    range: AGENDA_RANGES.includes(range as AgendaRange) ? (range as AgendaRange) : 'tonight',
    kinds: list(params.type, KINDS),
    games: list(params.game, GAME_KEYS),
    km: DISTANCES.includes(km) ? km : null,
    free: one(params.free) === '1',
    available: one(params.available) === '1',
    noAdult: one(params.noAdult) === '1',
  }
}

/** Paramètres d'URL des filtres ; une valeur vide est retirée de l'URL. */
export const filterParams = (f: AgendaFilters) => ({
  range: f.range === 'tonight' ? undefined : f.range,
  type: f.kinds.join(',') || undefined,
  game: f.games.join(',') || undefined,
  km: f.km ? String(f.km) : undefined,
  free: f.free ? '1' : undefined,
  available: f.available ? '1' : undefined,
  noAdult: f.noAdult ? '1' : undefined,
})

type Facet = 'kinds' | 'games' | 'km'

/** Le rendez-vous passe les filtres, sauf `skip` (compteur d'un menu : ses autres options restent visibles). */
function passes(e: AgendaEntry, f: AgendaFilters, skip?: Facet) {
  return (
    (skip === 'kinds' || !f.kinds.length || f.kinds.includes(e.kind)) &&
    (skip === 'games' || !f.games.length || f.games.some((g) => matchesGame(g, e.games))) &&
    (skip === 'km' || !f.km || e.venue.distanceMeters <= f.km * 1000) &&
    (!f.free || e.free) &&
    (!f.available || !e.full) &&
    (!f.noAdult || !e.adult)
  )
}

const toggle = <T>(values: T[], value: T) =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value]

/**
 * Résultats, menus (options et compteurs), bascules et puces des filtres actifs, pour les jours de la
 * période. `set` reçoit les nouveaux filtres.
 */
export function agendaView(
  entries: AgendaEntry[],
  days: string[],
  f: AgendaFilters,
  radiusKm: number,
  set: (f: AgendaFilters) => void,
) {
  const inRange = entries.filter((e) => days.includes(localDay(e.startsAt)))
  const results = inRange.filter((e) => passes(e, f))
  const count = (facet: Facet, match: (e: AgendaEntry) => boolean) =>
    inRange.filter((e) => passes(e, f, facet) && match(e)).length

  const menus = [
    {
      id: 'kinds',
      label: 'Type',
      title: 'Type',
      single: false,
      options: KINDS.map((k) => ({
        value: k,
        label: KIND_LABELS[k],
        swatch: KIND_COLORS[k].color,
        count: count('kinds', (e) => e.kind === k),
        selected: f.kinds.includes(k),
      })),
      onToggle: (k: string) => set({ ...f, kinds: toggle(f.kinds, k as Kind) }),
      onClear: () => set({ ...f, kinds: [] }),
    },
    {
      id: 'games',
      label: 'Jeu',
      title: 'Jeu',
      single: false,
      options: GAME_KEYS.map((g) => ({
        value: g,
        label: GAMES.find((x) => x.key === g)?.label ?? g,
        count: count('games', (e) => matchesGame(g, e.games)),
        selected: f.games.includes(g),
      })),
      onToggle: (g: string) => set({ ...f, games: toggle(f.games, g) }),
      onClear: () => set({ ...f, games: [] }),
    },
    {
      id: 'km',
      label: f.km ? `< ${f.km} km` : 'Distance',
      title: 'Distance',
      single: true,
      options: DISTANCES.filter((k) => k <= radiusKm).map((k) => ({
        value: String(k),
        label: `Moins de ${k} km`,
        count: count('km', (e) => e.venue.distanceMeters <= k * 1000),
        selected: f.km === k,
      })),
      onToggle: (k: string) => set({ ...f, km: f.km === Number(k) ? null : Number(k) }),
      onClear: () => set({ ...f, km: null }),
    },
  ]

  // Aucune soirée 18+ dans la période (toujours le cas pour un mineur, l'API les retire) : bascule inutile
  const hasAdult = inRange.some((e) => e.adult)
  const toggles = [
    { key: 'free' as const, label: 'Gratuit' },
    { key: 'available' as const, label: 'Places dispo' },
    ...(hasAdult || f.noAdult ? [{ key: 'noAdult' as const, label: 'Sans 18+' }] : []),
  ].map((t) => ({ ...t, value: f[t.key], onChange: (v: boolean) => set({ ...f, [t.key]: v }) }))

  const chips = [
    ...f.kinds.map((k) => ({
      label: KIND_LABELS[k],
      onRemove: () => set({ ...f, kinds: toggle(f.kinds, k) }),
    })),
    ...f.games.map((g) => ({
      label: GAMES.find((x) => x.key === g)?.label ?? g,
      onRemove: () => set({ ...f, games: toggle(f.games, g) }),
    })),
    ...(f.km ? [{ label: `< ${f.km} km`, onRemove: () => set({ ...f, km: null }) }] : []),
    ...toggles
      .filter((t) => t.value)
      .map((t) => ({ label: t.label, onRemove: () => t.onChange(false) })),
  ]
  const clearAll = () =>
    set({
      range: f.range,
      kinds: [],
      games: [],
      km: null,
      free: false,
      available: false,
      noAdult: false,
    })

  // Mise en avant des lieux partenaires (LKO-92) : leurs prochains rendez-vous, en plus de la liste par jour
  const partners = results.filter((e) => e.venue.isPartner).slice(0, PARTNER_HIGHLIGHTS)
  // Mis en avant en tête, ils ne sont pas répétés dans les jours (LKO-137)
  const highlighted = new Set(partners)
  const groups = dayGroups(
    results.filter((e) => !highlighted.has(e)),
    days,
  )
  return { results, partners, groups, menus, toggles, chips, clearAll }
}

// * AFFICHAGE

const lower = (text: string) => `${text.charAt(0).toLowerCase()}${text.slice(1)}`

/** « Ce soir · mer. 7 oct. », « Demain · jeu. 8 oct. », sinon « Samedi 10 oct. ». */
function groupLabel(day: string) {
  const date = `${day}T12:00:00Z`
  const today = localDay(new Date())
  if (day === today) return `Ce soir · ${lower(shortDay(date))}`
  if (day === localDay(new Date(Date.now() + 24 * 60 * 60 * 1000))) {
    return `Demain · ${lower(shortDay(date))}`
  }
  const weekday = new Intl.DateTimeFormat('fr-FR', {
    timeZone: VENUE_TIME_ZONE,
    weekday: 'long',
  }).format(new Date(date))
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${shortDay(date).split(' ').slice(1).join(' ')}`
}

function dayGroups(entries: AgendaEntry[], days: string[]) {
  return days
    .map((day) => {
      const items = entries.filter((e) => localDay(e.startsAt) === day)
      return { day, label: groupLabel(day), count: `${items.length} rendez-vous`, items }
    })
    .filter((g) => g.items.length)
}

/**
 * Props d'`AgendaRow` (sans l'action) ; sur téléphone, prix dans la ligne et places abrégées.
 * `withDay` : hors des groupes par jour (mise en avant des partenaires), le jour en tête de ligne.
 */
export function agendaRowProps(e: AgendaEntry, wide: boolean, withDay = false) {
  const games = e.games.length ? e.games.map(gameLabel).join(', ') : 'Tous jeux'
  const distance = formatDistance(e.venue.distanceMeters)
  const day = withDay && localDay(e.startsAt) !== localDay(new Date()) ? shortDay(e.startsAt) : null
  return {
    ...KIND_COLORS[e.kind],
    time: formatTime(e.startsAt),
    type: KIND_LABELS[e.kind],
    title: e.title,
    meta: [day, e.venue.name, distance, wide ? games : e.price].filter(Boolean).join(' · '),
    adult: e.adult,
    partner: e.venue.isPartner,
    places: e.places ? (wide ? e.places.text : e.places.short) : null,
    placesTone: e.places?.tone,
    price: e.price,
  }
}
