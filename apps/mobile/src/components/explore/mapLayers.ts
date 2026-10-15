import { border, colors, fuzzyZone, venuePin } from '@lucko/design-system'
import { VENUE_TYPE_LABELS } from '@lucko/shared'
import type { MapPin } from './mapPins'

// Couches des cartes Lucko (LKO-122), communes au web (maplibre-gl) et au natif (maplibre-react-native)

export type LngLat = { lat: number; lng: number }

export const EMPTY = { type: 'FeatureCollection' as const, features: [] }

export const point = ({ lat, lng }: LngLat, properties: Record<string, unknown> = {}) => ({
  type: 'Feature' as const,
  properties,
  geometry: { type: 'Point' as const, coordinates: [lng, lat] },
})

/** Cercle de `radiusM` mètres en polygone (MapLibre n'a pas de cercle en mètres). */
export function circlePolygon({ lat, lng }: LngLat, radiusM: number) {
  const dLat = radiusM / 111_320
  const dLng = dLat / Math.cos((lat * Math.PI) / 180)
  const ring = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * 2 * Math.PI
    return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]
  })
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [ring] },
  }
}

export const venuesGeoJSON = (venues: MapPin[], selectedId: string | null) => ({
  type: 'FeatureCollection' as const,
  features: venues.map((v) =>
    point(
      { lat: v.latitude, lng: v.longitude },
      {
        id: v.id,
        name: v.name,
        type: v.type,
        isPartner: v.isPartner,
        selected: v.id === selectedId,
      },
    ),
  ),
})

/** Regroupement des épingles : jusqu'au zoom 14, au-delà chaque lieu est seul. */
export const CLUSTER = { cluster: true, clusterRadius: 40, clusterMaxZoom: 14 } as const

const IS_CLUSTER = ['has', 'point_count']

/** Position du joueur, sous les épingles : sur la fiche lieu, elle est au même endroit que le lieu. */
export const meLayer = {
  id: 'me',
  type: 'circle' as const,
  paint: {
    'circle-color': colors.event,
    'circle-radius': 7,
    'circle-stroke-color': colors.ink,
    'circle-stroke-width': border.thin,
  },
}

/** Groupes en noir (le jaune est celui des boutiques TCG). */
export const clusterLayer = {
  id: 'clusters',
  type: 'circle' as const,
  filter: IS_CLUSTER,
  paint: {
    'circle-color': colors.ink,
    'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 100, 24],
    'circle-stroke-color': colors.white,
    'circle-stroke-width': border.thin,
  },
}

export const clusterCountLayer = {
  id: 'cluster-count',
  type: 'symbol' as const,
  filter: IS_CLUSTER,
  layout: {
    'text-field': ['get', 'point_count_abbreviated'],
    'text-font': ['Noto Sans Bold'],
    'text-size': 12,
  },
  paint: { 'text-color': colors.white },
}

/** Lieu seul : couleur de son type, anneau vert épais si partenaire, rouge s'il est choisi. */
export const venueLayer = {
  id: 'venue',
  type: 'circle' as const,
  filter: ['!', IS_CLUSTER],
  paint: {
    'circle-color': [
      'case',
      ['get', 'selected'],
      venuePin.selected,
      ['match', ['get', 'type'], ...Object.entries(venuePin.type).flat(), colors.white],
    ],
    'circle-radius': ['case', ['get', 'selected'], 12, 9],
    'circle-stroke-color': ['case', ['get', 'isPartner'], venuePin.partnerRing, colors.ink],
    'circle-stroke-width': ['case', ['get', 'isPartner'], 4, border.base],
  },
}

/** Légende des épingles (MapLegend), sous les cartes d'exploration. */
export const MAP_LEGEND = [
  { label: VENUE_TYPE_LABELS.GAME_BAR, color: venuePin.type.GAME_BAR },
  { label: VENUE_TYPE_LABELS.TCG_SHOP, color: venuePin.type.TCG_SHOP },
  { label: VENUE_TYPE_LABELS.CAFE, color: venuePin.type.CAFE },
  { label: 'Ludothèque · association', color: venuePin.type.LUDOTHEQUE },
  { label: 'Partenaire', color: venuePin.partnerRing, ring: true },
]

export const zoneFillLayer = {
  id: 'zone-fill',
  type: 'fill' as const,
  paint: { 'fill-color': fuzzyZone.fill },
}

export const zoneLineLayer = {
  id: 'zone-line',
  type: 'line' as const,
  paint: {
    'line-color': fuzzyZone.stroke,
    'line-width': fuzzyZone.strokeWidth,
    'line-dasharray': fuzzyZone.dash.map((d) => d / fuzzyZone.strokeWidth),
  },
}

export const homePinLayer = {
  id: 'pin',
  type: 'circle' as const,
  paint: {
    'circle-color': fuzzyZone.pin.color,
    'circle-radius': fuzzyZone.pin.size / 2,
    'circle-stroke-color': colors.ink,
    'circle-stroke-width': border.base,
  },
}
