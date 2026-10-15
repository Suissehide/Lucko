import { colors, Typography } from '@lucko/design-system'
import type { VenueListItem } from '@lucko/shared'
import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import type { Place } from '@/lib/useLocation'

/** Carte des lieux (B1) : épingle verte pour les partenaires, blanche sinon ; centrée sur le lieu choisi. */
export function ExploreMap({
  center,
  venues,
  selectedId,
  onSelect,
}: {
  center: Place
  venues: VenueListItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const map = useRef<MapView>(null)
  const selected = venues.find((v) => v.id === selectedId)
  const lat = selected?.latitude
  const lng = selected?.longitude
  useEffect(() => {
    if (lat === undefined || lng === undefined) return
    map.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      600,
    )
  }, [lat, lng])
  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        }}
        showsUserLocation
      >
        {venues.map((venue) => (
          <Marker
            key={venue.id}
            coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
            title={venue.name}
            pinColor={
              venue.id === selectedId ? colors.room : venue.isPartner ? colors.venue : colors.ink
            }
            onPress={() => onSelect(venue.id)}
          />
        ))}
      </MapView>
      {/* Lieux importés d'OSM (LKO-74) : attribution ODbL ; le web l'a déjà sur le fond Leaflet */}
      <Typography
        variant="small"
        style={{
          position: 'absolute',
          right: 4,
          bottom: 2,
          fontSize: 10,
          backgroundColor: colors.white,
        }}
      >
        © contributeurs OpenStreetMap
      </Typography>
    </View>
  )
}
