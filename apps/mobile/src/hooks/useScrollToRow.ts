import { useEffect, useRef } from 'react'
import { type LayoutChangeEvent, Platform, type ScrollView } from 'react-native'

const rowId = (id: string) => `list-row-${id}`

/**
 * Liste qui suit la carte : quand un lieu est choisi (épingle), la liste défile jusqu'à sa ligne.
 * `scrollRef` va sur `ListCard` (avec `maxHeight`), `rowProps(id)` sur la vue de chaque ligne.
 * Web : la ligne est cherchée dans le DOM (les mesures `onLayout` de react-native-web se décalent
 * pendant un défilement) ; natif : sa position relevée par `onLayout`.
 */
export function useScrollToRow(selectedId: string | null) {
  const scrollRef = useRef<ScrollView>(null)
  const offsets = useRef(new Map<string, number>())

  useEffect(() => {
    if (!selectedId) return
    if (Platform.OS === 'web') {
      // `nearest` : seule la liste défile, pas la page
      document
        .getElementById(rowId(selectedId))
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      return
    }
    const y = offsets.current.get(selectedId)
    if (y !== undefined) scrollRef.current?.scrollTo({ y, animated: true })
  }, [selectedId])

  const rowProps = (id: string) => ({
    nativeID: rowId(id),
    onLayout: (event: LayoutChangeEvent) => {
      offsets.current.set(id, event.nativeEvent.layout.y)
    },
  })

  return { scrollRef, rowProps }
}
