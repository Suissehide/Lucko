import { border, colors, MapLegend, radius } from '@lucko/design-system'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { View } from 'react-native'
import type { Place } from '@/lib/useLocation'
import { mapVenuesQueryOptions } from '@/queries/useExplore'
import { ExploreMap } from './ExploreMap'
import { MAP_LEGEND } from './mapLayers'
import { type MapBounds, type MapPin, mergePins, openingFrame, pinsArea } from './mapPins'

/**
 * Carte des lieux dans son cadre (accueil, liste des lieux) : les lieux de la liste, plus tous ceux de
 * la zone affichée (LKO-122), regroupés quand on dézoome, avec la légende des épingles. `openNow` :
 * seulement les lieux ouverts.
 */
export function MapFrame({
  height,
  venues,
  openNow = false,
  ...map
}: {
  height: number
  center: Place
  venues: MapPin[]
  openNow?: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  const area = useQuery(mapVenuesQueryOptions(pinsArea(bounds), openNow))
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          height,
          borderWidth: border.base,
          borderColor: colors.ink,
          borderRadius: radius.card,
          overflow: 'hidden',
          backgroundColor: colors.creamDark,
        }}
      >
        <ExploreMap
          {...map}
          venues={mergePins(venues, area.data ?? [])}
          frame={openingFrame(map.center, venues)}
          onBoundsChange={setBounds}
        />
      </View>
      <MapLegend items={MAP_LEGEND} />
    </View>
  )
}
