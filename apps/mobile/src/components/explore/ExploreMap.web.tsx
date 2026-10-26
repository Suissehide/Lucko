import maplibregl, {
  type AddLayerObject,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import type { Place } from '@/lib/useLocation'
import {
  CLUSTER,
  clusterCountLayer,
  clusterLayer,
  EMPTY,
  type LngLat,
  meHaloLayer,
  meLayer,
  point,
  venueLayer,
  venuesGeoJSON,
} from './mapLayers'
import { useMapLibre } from './maplibre.web'
import type { MapBounds, MapPin } from './mapPins'

/**
 * Carte des lieux sur le web (LKO-122) : MapLibre au style Lucko, épingles regroupées quand on dézoome.
 * Partenaires en vert, lieu sélectionné en rouge ; `onBoundsChange` à chaque fin de déplacement.
 */
export function ExploreMap({
  center,
  venues,
  selectedId,
  onSelect,
  onBoundsChange,
  frame,
}: {
  center: Place
  venues: MapPin[]
  selectedId: string | null
  onSelect: (id: string) => void
  onBoundsChange?: (bounds: MapBounds) => void
  /** Cadre d'ouverture (joueur et lieux les plus proches), appliqué une fois. */
  frame?: MapBounds | null
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useMapLibre(container, center, 14)
  // Les gestionnaires posés une fois lisent toujours les derniers rappels
  const handlers = useRef({ onSelect, onBoundsChange })
  handlers.current = { onSelect, onBoundsChange }

  useEffect(() => {
    if (!map) return
    map.addSource('me', { type: 'geojson', data: EMPTY })
    map.addSource('venues', { type: 'geojson', data: EMPTY, ...CLUSTER })
    map.addLayer({ ...meHaloLayer, source: 'me' } as AddLayerObject)
    map.addLayer({ ...meLayer, source: 'me' } as AddLayerObject)
    for (const layer of [clusterLayer, clusterCountLayer, venueLayer])
      map.addLayer({ ...layer, source: 'venues' } as AddLayerObject)

    const popup = new maplibregl.Popup({ closeButton: false, offset: 12, className: 'lucko-pin' })
    const hover = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      map.getCanvas().style.cursor = 'pointer'
      if (feature?.geometry.type === 'Point' && feature.properties.name)
        popup
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setText(String(feature.properties.name))
          .addTo(map)
    }
    const leave = () => {
      map.getCanvas().style.cursor = ''
      popup.remove()
    }
    map.on('mouseenter', 'venue', hover)
    map.on('mouseenter', 'clusters', hover)
    map.on('mouseleave', 'venue', leave)
    map.on('mouseleave', 'clusters', leave)
    map.on('click', 'venue', (e) => {
      const id = e.features?.[0]?.properties.id
      if (typeof id === 'string') handlers.current.onSelect(id)
    })
    map.on('click', 'clusters', async (e) => {
      const feature = e.features?.[0]
      if (feature?.geometry.type !== 'Point') return
      const source = map.getSource<GeoJSONSource>('venues')
      const zoom = await source?.getClusterExpansionZoom(Number(feature.properties.cluster_id))
      map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom })
    })
    const bounds = () => {
      const b = map.getBounds()
      handlers.current.onBoundsChange?.({
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      })
    }
    map.on('moveend', bounds)
    bounds()
  }, [map])

  const { lat: meLat, lng: meLng } = center
  useEffect(() => {
    map?.getSource<GeoJSONSource>('me')?.setData(point({ lat: meLat, lng: meLng }))
  }, [map, meLat, meLng])

  useEffect(() => {
    map?.getSource<GeoJSONSource>('venues')?.setData(venuesGeoJSON(venues, selectedId))
  }, [map, venues, selectedId])

  // Une seule fois, dès que la liste arrive : ensuite, la carte reste là où le joueur la déplace
  const framed = useRef(false)
  useEffect(() => {
    if (!map || !frame || framed.current) return
    framed.current = true
    map.fitBounds(
      [
        [frame.west, frame.south],
        [frame.east, frame.north],
      ],
      { padding: 40, maxZoom: 15, duration: 0 },
    )
  }, [map, frame])

  // Lieu choisi (épingle ou liste) : la carte s'y déplace, assez près pour défaire les regroupements
  const selected = venues.find((v) => v.id === selectedId)
  const target: LngLat | null = selected
    ? { lat: selected.latitude, lng: selected.longitude }
    : null
  const lat = target?.lat
  const lng = target?.lng
  useEffect(() => {
    if (!map || lat === undefined || lng === undefined) return
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 600 })
  }, [map, lat, lng])

  return <div ref={container} style={{ width: '100%', height: '100%' }} />
}
