import { mapStyle } from '@lucko/design-system'
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  type GeoJSONSourceRef,
  Layer,
  type LayerProps,
  type MapProps,
  Map as MapView,
} from '@maplibre/maplibre-react-native'
import { useEffect, useRef } from 'react'
import type { Place } from '@/lib/useLocation'
import {
  CLUSTER,
  clusterCountLayer,
  clusterLayer,
  meLayer,
  point,
  venueLayer,
  venuesGeoJSON,
} from './mapLayers'
import type { MapBounds, MapPin } from './mapPins'

/**
 * Carte des lieux sur mobile (LKO-122) : MapLibre natif au style Lucko, mêmes couches que le web.
 * Épingles regroupées quand on dézoome ; `onBoundsChange` à chaque fin de déplacement.
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
  const camera = useRef<CameraRef>(null)
  const source = useRef<GeoJSONSourceRef>(null)

  // Lieu choisi (épingle ou liste) : la carte s'y déplace, assez près pour défaire les regroupements
  const selected = venues.find((v) => v.id === selectedId)
  const lat = selected?.latitude
  const lng = selected?.longitude
  useEffect(() => {
    if (lat === undefined || lng === undefined) return
    camera.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 600 })
  }, [lat, lng])

  return (
    <MapView
      style={{ flex: 1 }}
      mapStyle={mapStyle as MapProps['mapStyle']}
      logo={false}
      onRegionDidChange={(e) => {
        const [west, south, east, north] = e.nativeEvent.bounds
        onBoundsChange?.({ west, south, east, north })
      }}
    >
      <Camera ref={camera} initialViewState={{ center: [center.lng, center.lat], zoom: 13 }} />
      <GeoJSONSource id="me" data={point(center)}>
        <Layer {...(meLayer as LayerProps)} />
      </GeoJSONSource>
      <GeoJSONSource
        id="venues"
        ref={source}
        data={venuesGeoJSON(venues, selectedId)}
        {...CLUSTER}
        onPress={async (e) => {
          const feature = e.nativeEvent.features[0]
          if (feature?.geometry.type !== 'Point') return
          const [fLng = 0, fLat = 0] = feature.geometry.coordinates
          if (feature.properties?.cluster) {
            const zoom = await source.current?.getClusterExpansionZoom(
              Number(feature.properties.cluster_id),
            )
            camera.current?.easeTo({ center: [fLng, fLat], zoom, duration: 400 })
          } else if (typeof feature.properties?.id === 'string') onSelect(feature.properties.id)
        }}
      >
        <Layer {...(clusterLayer as LayerProps)} />
        <Layer {...(clusterCountLayer as LayerProps)} />
        <Layer {...(venueLayer as LayerProps)} />
      </GeoJSONSource>
    </MapView>
  )
}
