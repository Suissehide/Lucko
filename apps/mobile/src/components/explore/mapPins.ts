import type { MapVenue } from '@lucko/shared'

/** Épingle de carte : un lieu de la liste ou du chargement par zone (LKO-122). */
export type MapPin = Pick<MapVenue, 'id' | 'name' | 'type' | 'latitude' | 'longitude' | 'isPartner'>

export type MapBounds = { west: number; south: number; east: number; north: number }

/** Au-delà (≈ 20 km de large), on ne charge plus la zone : la liste suffit, la carte reste lisible. */
const MAX_SPAN_DEG = 0.25

/**
 * Zone à charger, élargie au centième de degré (~1 km) : de petits déplacements réutilisent le cache.
 * null si elle est trop grande.
 */
export function pinsArea(bounds: MapBounds | null): MapBounds | null {
  if (!bounds || bounds.east - bounds.west > MAX_SPAN_DEG) return null
  const down = (n: number) => Math.floor(n * 100) / 100
  const up = (n: number) => Math.ceil(n * 100) / 100
  return {
    west: down(bounds.west),
    south: down(bounds.south),
    east: up(bounds.east),
    north: up(bounds.north),
  }
}

/** Liste d'abord (elle porte le lieu choisi), puis les épingles de la zone qui n'y sont pas. */
export function mergePins(list: MapPin[], area: MapPin[]): MapPin[] {
  const ids = new Set(list.map((v) => v.id))
  return [...list, ...area.filter((v) => !ids.has(v.id))]
}
