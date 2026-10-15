import { border, colors, radius } from '@lucko/design-system'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { View } from 'react-native'
import type { Place } from '@/lib/useLocation'
import { mapVenuesQueryOptions } from '@/queries/useExplore'
import { ExploreMap } from './ExploreMap'
import { type MapBounds, type MapPin, mergePins, pinsArea } from './mapPins'

/**
 * Carte des lieux dans son cadre (accueil, liste des lieux) : les lieux de la liste, plus tous ceux de
 * la zone affichée (LKO-122), regroupés quand on dézoome. `openNow` : seulement les lieux ouverts.
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
      <ExploreMap {...map} venues={mergePins(venues, area.data ?? [])} onBoundsChange={setBounds} />
    </View>
  )
}
