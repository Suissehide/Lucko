import { DEFAULT_CITY } from '@lucko/shared'

// Recherche de lieux OpenStreetMap par Photon (Komoot) : sans clé, CORS ouvert, attribution ODbL
const PHOTON = 'https://photon.komoot.io/api/'
const OSM_TYPES = { N: 'node', W: 'way', R: 'relation' } as const
/** Rues, communes et limites : la BAN couvre déjà les adresses. */
const NOT_PLACES = new Set(['highway', 'place', 'boundary', 'building', 'landuse'])

export type PlaceSuggestion = {
  /** « node/123 » */
  osmId: string
  name: string
  /** « 45 Rue Commandant Hautreux, Bordeaux » */
  detail: string
  /** Commune : OSM ne la porte souvent pas sur le lieu lui-même */
  city: string
}

type PhotonFeature = {
  properties: {
    osm_type: keyof typeof OSM_TYPES
    osm_id: number
    osm_key: string
    name?: string
    housenumber?: string
    street?: string
    city?: string
  }
}

/** Lieux nommés proches de Bordeaux pendant la saisie (back-office, LKO-115). */
export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    lat: String(DEFAULT_CITY.lat),
    lon: String(DEFAULT_CITY.lng),
    limit: '8',
    lang: 'fr',
  })
  const response = await fetch(`${PHOTON}?${params}`)
  if (!response.ok) throw new Error(`Recherche de lieux : ${response.status}`)
  const { features } = (await response.json()) as { features: PhotonFeature[] }
  return features.flatMap(({ properties: p }) =>
    p.name && !NOT_PLACES.has(p.osm_key)
      ? [
          {
            osmId: `${OSM_TYPES[p.osm_type]}/${p.osm_id}`,
            name: p.name,
            detail: [[p.housenumber, p.street].filter(Boolean).join(' '), p.city]
              .filter(Boolean)
              .join(', '),
            city: p.city ?? '',
          },
        ]
      : [],
  )
}
