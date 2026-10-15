import { border, colors, FuzzyZoneLabel, fuzzyZone } from '@lucko/design-system'
import type { GeoJSONSource } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import type { Place } from '@/lib/useLocation'
import { circlePolygon, EMPTY, point, useMapLibre } from './maplibre.web'

/** Version web (MapLibre, LKO-122) de la carte d'une room à domicile ; voir FuzzyZoneMap.tsx. */
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
  const container = useRef<HTMLDivElement>(null)
  const map = useMapLibre(container, center, 14)

  useEffect(() => {
    if (!map) return
    map.addSource('zone', { type: 'geojson', data: EMPTY })
    map.addSource('pin', { type: 'geojson', data: EMPTY })
    map.addLayer({
      id: 'zone-fill',
      type: 'fill',
      source: 'zone',
      paint: { 'fill-color': fuzzyZone.fill },
    })
    map.addLayer({
      id: 'zone-line',
      type: 'line',
      source: 'zone',
      paint: {
        'line-color': fuzzyZone.stroke,
        'line-width': fuzzyZone.strokeWidth,
        'line-dasharray': fuzzyZone.dash.map((d) => d / fuzzyZone.strokeWidth),
      },
    })
    map.addLayer({
      id: 'pin',
      type: 'circle',
      source: 'pin',
      paint: {
        'circle-color': fuzzyZone.pin.color,
        'circle-radius': fuzzyZone.pin.size / 2,
        'circle-stroke-color': colors.ink,
        'circle-stroke-width': border.base,
      },
    })
  }, [map])

  // Zone floue tant que l'adresse n'est pas révélée, épingle ensuite ; le centre peut changer (saisie)
  const { lat, lng } = center
  useEffect(() => {
    if (!map) return
    map.getSource<GeoJSONSource>('zone')?.setData(circlePolygon({ lat, lng }, radiusM))
    map.getSource<GeoJSONSource>('pin')?.setData(point({ lat, lng }))
    for (const id of ['zone-fill', 'zone-line'])
      map.setLayoutProperty(id, 'visibility', revealed ? 'none' : 'visible')
    map.setLayoutProperty('pin', 'visibility', revealed ? 'visible' : 'none')
    map.jumpTo({ center: [lng, lat] })
  }, [map, lat, lng, radiusM, revealed])

  return (
    <View style={{ flex: 1 }}>
      <div ref={container} style={{ width: '100%', height: '100%' }} />
      <View style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 1000 }}>
        <FuzzyZoneLabel radiusM={radiusM} revealed={revealed} address={address} />
      </View>
    </View>
  )
}
