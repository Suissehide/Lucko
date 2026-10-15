import 'maplibre-gl/dist/maplibre-gl.css'
import { mapStyle } from '@lucko/design-system'
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import maplibregl from 'maplibre-gl/dist/maplibre-gl-csp'

// Build « CSP » : Metro transforme la build standard, dont le worker (recréé à partir de son propre
// code) ne démarre plus ; celui-ci est copié dans public/ à l'installation (script postinstall)
maplibregl.setWorkerUrl('/maplibre-gl-csp-worker.js')

import { type RefObject, useEffect, useState } from 'react'

export type LngLat = { lat: number; lng: number }

/**
 * Carte MapLibre au style Lucko (LKO-122) dans `container`, renvoyée une fois le style chargé ; détruite
 * au démontage. Le centre initial seulement : la suite (lieu choisi, position) passe par `flyTo`.
 */
export function useMapLibre(
  container: RefObject<HTMLDivElement | null>,
  center: LngLat,
  zoom: number,
) {
  const [map, setMap] = useState<MapLibreMap | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: la carte est créée une seule fois
  useEffect(() => {
    if (!container.current) return
    const created = new maplibregl.Map({
      container: container.current,
      style: mapStyle as StyleSpecification,
      center: [center.lng, center.lat],
      zoom,
      attributionControl: { compact: true },
    })
    created.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    created.on('load', () => setMap(created))
    return () => {
      setMap(null)
      created.remove()
    }
  }, [])
  return map
}

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

export const EMPTY = { type: 'FeatureCollection' as const, features: [] }

export const point = ({ lat, lng }: LngLat, properties: Record<string, unknown> = {}) => ({
  type: 'Feature' as const,
  properties,
  geometry: { type: 'Point' as const, coordinates: [lng, lat] },
})
