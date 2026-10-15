import 'maplibre-gl/dist/maplibre-gl.css'
import { mapStyle } from '@lucko/design-system'
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import maplibregl from 'maplibre-gl/dist/maplibre-gl-csp'

// Build « CSP » : Metro transforme la build standard, dont le worker (recréé à partir de son propre
// code) ne démarre plus ; celui-ci est copié dans public/ à l'installation (script postinstall)
maplibregl.setWorkerUrl('/maplibre-gl-csp-worker.js')

import { type RefObject, useEffect, useState } from 'react'
import type { LngLat } from './mapLayers'

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
