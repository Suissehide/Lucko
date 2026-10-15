import { FuzzyZoneLabel, mapStyle } from '@lucko/design-system'
import {
  Camera,
  GeoJSONSource,
  Layer,
  type LayerProps,
  type MapProps,
  Map as MapView,
} from '@maplibre/maplibre-react-native'
import { View } from 'react-native'
import type { Place } from '@/lib/useLocation'
import { circlePolygon, homePinLayer, point, zoneFillLayer, zoneLineLayer } from './mapLayers'

/**
 * Carte d'une room à domicile (MapLibre, LKO-122) : zone floue tant que l'adresse n'est pas révélée,
 * épingle ensuite. `center` arrive déjà décalé par le serveur (aléatoire et stable par room) : le client
 * n'a jamais les vraies coordonnées avant la révélation.
 */
export function FuzzyZoneMap({
  center,
  radiusM = 500,
  revealed,
  address,
}: {
  center: Pick<Place, 'lat' | 'lng'>
  radiusM?: number
  revealed: boolean
  address?: string
}) {
  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} mapStyle={mapStyle as MapProps['mapStyle']} logo={false}>
        <Camera center={[center.lng, center.lat]} zoom={14} />
        {revealed ? (
          <GeoJSONSource id="pin" data={point(center)}>
            <Layer {...(homePinLayer as LayerProps)} />
          </GeoJSONSource>
        ) : (
          <GeoJSONSource id="zone" data={circlePolygon(center, radiusM)}>
            <Layer {...(zoneFillLayer as LayerProps)} />
            <Layer {...(zoneLineLayer as LayerProps)} />
          </GeoJSONSource>
        )}
      </MapView>
      <View style={{ position: 'absolute', left: 12, bottom: 12 }}>
        <FuzzyZoneLabel radiusM={radiusM} revealed={revealed} address={address} />
      </View>
    </View>
  )
}
