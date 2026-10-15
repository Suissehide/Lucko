import { border, colors } from '@lucko/design-system'
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import type { Place } from '@/lib/useLocation'
import { EMPTY, type LngLat, point, useMapLibre } from './maplibre.web'
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
}: {
  center: Place
  venues: MapPin[]
  selectedId: string | null
  onSelect: (id: string) => void
  onBoundsChange?: (bounds: MapBounds) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useMapLibre(container, center, 14)
  // Les gestionnaires posés une fois lisent toujours les derniers rappels
  const handlers = useRef({ onSelect, onBoundsChange })
  handlers.current = { onSelect, onBoundsChange }

  useEffect(() => {
    if (!map) return
    map.addSource('me', { type: 'geojson', data: EMPTY })
    map.addSource('venues', {
      type: 'geojson',
      data: EMPTY,
      cluster: true,
      clusterRadius: 40,
      clusterMaxZoom: 14,
    })
    // Position sous les épingles : sur la fiche lieu, elle est au même endroit que le lieu
    map.addLayer({
      id: 'me',
      type: 'circle',
      source: 'me',
      paint: {
        'circle-color': colors.event,
        'circle-radius': 7,
        'circle-stroke-color': colors.ink,
        'circle-stroke-width': border.thin,
      },
    })
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'venues',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': colors.rating,
        'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 100, 24],
        'circle-stroke-color': colors.ink,
        'circle-stroke-width': border.base,
      },
    })
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'venues',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
      },
      paint: { 'text-color': colors.ink },
    })
    map.addLayer({
      id: 'venue',
      type: 'circle',
      source: 'venues',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'case',
          ['get', 'selected'],
          colors.room,
          ['get', 'isPartner'],
          colors.venue,
          colors.white,
        ],
        'circle-radius': ['case', ['get', 'selected'], 12, 9],
        'circle-stroke-color': colors.ink,
        'circle-stroke-width': border.base,
      },
    })

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
    map?.getSource<GeoJSONSource>('venues')?.setData({
      type: 'FeatureCollection',
      features: venues.map((v) =>
        point(
          { lat: v.latitude, lng: v.longitude },
          { id: v.id, name: v.name, isPartner: v.isPartner, selected: v.id === selectedId },
        ),
      ),
    })
  }, [map, venues, selectedId])

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
