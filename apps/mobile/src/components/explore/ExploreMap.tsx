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
  UserLocation,
} from '@maplibre/maplibre-react-native'
import { useEffect, useRef } from 'react'
import type { Place } from '@/lib/useLocation'
import { CLUSTER, clusterCountLayer, clusterLayer, venueLayer, venuesGeoJSON } from './mapLayers'
import type { MapBounds, MapPin } from './mapPins'

/**
 * Carte des lieux sur mobile (LKO-122) : MapLibre natif au style Lucko, mêmes couches que le web, et
 * la position GPS du joueur. Épingles regroupées quand on dézoome ; `onBoundsChange` à chaque fin de
 * déplacement.
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
  const camera = useRef<CameraRef>(null)
  const source = useRef<GeoJSONSourceRef>(null)

  // Une seule fois, dès que la liste arrive : ensuite, la carte reste là où le joueur la déplace
  const framed = useRef(false)
  useEffect(() => {
    if (!frame || framed.current) return
    framed.current = true
    camera.current?.fitBounds([frame.west, frame.south, frame.east, frame.north], {
      padding: { top: 40, right: 40, bottom: 40, left: 40 },
      duration: 0,
    })
  }, [frame])

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
      {/* Point bleu GPS (comme Apple Plans), avec son cercle de précision ; rien sans permission */}
      <UserLocation accuracy />
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
