import { metersBetween, type VenueType } from '@lucko/shared'

/**
 * Métropoles importées, par le SIREN que porte leur limite administrative dans OSM. On en ajoute une
 * quand Lucko s'y lance ; la ville sert quand un lieu n'a pas `addr:city`.
 */
export const OSM_ZONES = [
  { siren: '243300316', city: 'Bordeaux Métropole' }, // ≈ 580 lieux
  { siren: '200054781', city: 'Grand Paris' }, // ≈ 6 400 lieux
] as const
export type OsmZone = (typeof OSM_ZONES)[number]

/** Cafés, bars, pubs et boutiques de jeux nommés d'une zone. */
export const osmZoneQuery = ({ siren }: OsmZone) => `[out:json][timeout:180];
area["ref:FR:SIREN"="${siren}"]->.m;
(
  nwr["amenity"~"^(cafe|bar|pub)$"]["name"](area.m);
  nwr["shop"~"^(games|collector)$"]["name"](area.m);
);
out center tags;`

/** Un seul élément (« node/123 »), pour pré-remplir une fiche. */
export const osmElementQuery = (osmId: string) => {
  const [type, id] = osmId.split('/')
  return `[out:json][timeout:25];${type}(${id});out center tags;`
}

export type OsmElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags: Record<string, string>
}

export type OpeningRange = { weekday: number; opensAtMinute: number; closesAtMinute: number }

const DRINK_PLACES = new Set(['bar', 'cafe', 'pub'])
const GAME_WORDS = /\bjeux?\b|game|ludi|board/i
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/** « 24:00 » et les heures étendues d'OSM (« 26:00 ») reviennent dans la journée : plage sur le lendemain. */
const minuteOf = (time: string) => {
  const [h = 0, m = 0] = time.split(':').map(Number)
  return (h * 60 + m) % 1440
}

/**
 * Horaires OSM (`Mo-Fr 08:00-19:00; Sa 10:00-02:00`) en plages hebdomadaires. Seule la forme courante
 * (jours, plages, `off`, `24/7`) est lue : le reste (mois, jours fériés, semaines) donne [].
 */
export function parseOpeningHours(value: string | undefined): OpeningRange[] {
  if (!value) return []
  if (value.trim() === '24/7')
    return DAYS.map((_, i) => ({ weekday: i + 1, opensAtMinute: 0, closesAtMinute: 0 }))
  const week = new Map<number, OpeningRange[]>()
  for (const rule of value
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean)) {
    const match = rule.match(/^([A-Za-z,-]+)\s+(off|closed|[\d:,-]+)$/)
    if (!match) return []
    const [, daysPart = '', timesPart = ''] = match
    const days: number[] = []
    for (const part of daysPart.split(',')) {
      const [from = '', to = from] = part.split('-')
      const start = DAYS.indexOf(from)
      const end = DAYS.indexOf(to)
      if (start < 0 || end < 0) return []
      // Su-Tu passe par la fin de semaine
      for (let i = 0; i <= (end - start + 7) % 7; i++) days.push(((start + i) % 7) + 1)
    }
    const ranges = /^(off|closed)$/.test(timesPart)
      ? []
      : timesPart.split(',').map((span) => {
          const [opens = '', closes = ''] = span.split('-')
          return { opensAtMinute: minuteOf(opens), closesAtMinute: minuteOf(closes) }
        })
    if (ranges.some((r) => Number.isNaN(r.opensAtMinute + r.closesAtMinute))) return []
    // Comme dans OSM, une règle plus loin remplace les horaires des jours qu'elle cite
    for (const weekday of days)
      week.set(
        weekday,
        ranges.map((r) => ({ weekday, ...r })),
      )
  }
  return [...week.values()].flat()
}

/** Minuscules, sans accents ni ponctuation : « Le Café d'Été » → « le-cafe-d-ete ». */
export const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const osmIdOf = (element: Pick<OsmElement, 'type' | 'id'>) => `${element.type}/${element.id}`

/** Champs de la fiche lieu tirés d'OSM (import LKO-74, pré-remplissage LKO-115) ; null sans position ni nom. */
export function toVenue(element: OsmElement, fallbackCity = '') {
  const { tags } = element
  const latitude = element.lat ?? element.center?.lat
  const longitude = element.lon ?? element.center?.lon
  const name = tags.name?.trim()
  if (latitude === undefined || longitude === undefined || !name) return null
  const drinks = DRINK_PLACES.has(tags.amenity ?? '')
  const type: VenueType =
    tags.amenity === 'toy_library'
      ? 'LUDOTHEQUE'
      : tags.shop && !tags.amenity
        ? 'TCG_SHOP'
        : GAME_WORDS.test(name)
          ? 'GAME_BAR'
          : tags.amenity === 'cafe'
            ? 'CAFE'
            : drinks
              ? 'BAR'
              : 'OTHER'
  const website = tags.website ?? tags['contact:website']
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
  return {
    venue: {
      name,
      type,
      address: street,
      city: tags['addr:city'] ?? fallbackCity,
      latitude,
      longitude,
      phone: tags.phone ?? tags['contact:phone'] ?? null,
      website: website ? (/^https?:\/\//.test(website) ? website : `https://${website}`) : null,
      // Bars et cafés servent de l'alcool : pas de moins de 16 ans seuls tant qu'un admin n'a pas vérifié
      acceptsUnaccompaniedMinors: !drinks,
    },
    openingHours: parseOpeningHours(tags.opening_hours),
  }
}

/** Même lieu saisi à la main : même nom (sans accents ni casse) à moins de 100 m. */
export const isSamePlace = (
  a: { name: string; latitude: number; longitude: number },
  b: typeof a,
) => slugify(a.name) === slugify(b.name) && metersBetween(a, b) < 100
