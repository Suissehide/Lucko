import type { ReactNode, Ref } from 'react'
import { ScrollView, type StyleProp, View, type ViewStyle } from 'react-native'
import { border, colors, radius } from '../tokens'

/**
 * Liste encadrée ; avec `maxHeight`, les lignes défilent dans le cadre, qui reste entier (`scrollRef` :
 * pour faire défiler jusqu'à une ligne).
 */
export function ListCard({
  children,
  maxHeight,
  scrollRef,
  style,
}: {
  children: ReactNode
  maxHeight?: number
  scrollRef?: Ref<ScrollView>
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.white,
          borderWidth: border.base,
          borderColor: colors.ink,
          borderRadius: radius.card,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {maxHeight ? (
        <ScrollView ref={scrollRef} style={{ maxHeight }} nestedScrollEnabled>
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  )
}
