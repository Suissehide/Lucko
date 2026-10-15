// Géocodage de la Géoplateforme de l'IGN (adresses françaises, sans clé, CORS ouvert)
const BASE = 'https://data.geopf.fr/geocodage'

export type City = { name: string; lat: number; lng: number }

type Feature = {
  geometry: { coordinates: [number, number] }
  properties: { name?: string; city?: string; context?: string }
}

async function features(url: string): Promise<Feature[]> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Géocodage : ${response.status}`)
  return ((await response.json()) as { features: Feature[] }).features
}

const toCity = (feature: Feature, fallback = ''): City => {
  const [lng, lat] = feature.geometry.coordinates
  return { name: feature.properties.city ?? feature.properties.name ?? fallback, lat, lng }
}

const municipalities = (query: string, limit: number) =>
  `${BASE}/search?q=${encodeURIComponent(query)}&index=address&type=municipality&limit=${limit}`

/** Commune la plus proche du texte saisi ; null si aucune ne correspond. */
export async function searchCity(query: string): Promise<City | null> {
  const [feature] = await features(municipalities(query, 1))
  return feature ? toCity(feature, query) : null
}

/** Communes commençant comme le texte saisi, avec leur département (« 33 ») pour départager les homonymes. */
export async function suggestCities(query: string): Promise<(City & { department: string })[]> {
  const found = await features(`${municipalities(query, 5)}&autocomplete=1`)
  return found.map((f) => ({
    ...toCity(f, query),
    department: f.properties.context?.split(',')[0]?.trim() ?? '',
  }))
}

/** Commune d'une position (bouton « Me localiser »). */
export async function reverseCity(lat: number, lng: number): Promise<string | null> {
  const [feature] = await features(`${BASE}/reverse?lon=${lng}&lat=${lat}&index=address&limit=1`)
  return feature?.properties.city ?? null
}

export type AddressSuggestion = {
  /** « 12 Rue des Faures 33000 Bordeaux » */
  label: string
  /** « 12 Rue des Faures » et « Bordeaux » (fiche lieu, LKO-115) */
  street: string
  city: string
  lat: number
  lng: number
  /** Affiché aux autres joueurs : « Paris · Paris 11e Arrondissement », « Bordeaux (33100) ». */
  areaLabel: string
}

type AddressFeature = Feature & {
  properties: { label: string; district?: string; postcode?: string }
}

/**
 * Adresses proposées pendant la saisie (room à domicile, nouveau lieu) ; rien n'est gardé côté IGN ni
 * chez nous. `near` : priorité aux adresses proches de ce point.
 */
export async function searchAddresses(
  query: string,
  near?: { lat: number; lng: number },
): Promise<AddressSuggestion[]> {
  const around = near ? `&lat=${near.lat}&lon=${near.lng}` : ''
  const response = await fetch(
    `${BASE}/search?q=${encodeURIComponent(query)}&index=address&autocomplete=1&limit=5${around}`,
  )
  if (!response.ok) throw new Error(`Géocodage : ${response.status}`)
  const { features } = (await response.json()) as { features: AddressFeature[] }
  return features.map(({ geometry, properties }) => ({
    label: properties.label,
    street: properties.name ?? properties.label,
    city: properties.city ?? '',
    lat: geometry.coordinates[1],
    lng: geometry.coordinates[0],
    areaLabel: properties.district
      ? `${properties.city} · ${properties.district}`
      : `${properties.city ?? properties.label}${properties.postcode ? ` (${properties.postcode})` : ''}`,
  }))
}
