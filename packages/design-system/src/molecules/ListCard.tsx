import type { ReactNode } from 'react'
import { ScrollView, type StyleProp, View, type ViewStyle } from 'react-native'
import { border, colors, radius } from '../tokens'

/** Liste encadrée ; avec `maxHeight`, les lignes défilent dans le cadre, qui reste entier. */
export function ListCard({
  children,
  maxHeight,
  style,
}: {
  children: ReactNode
  maxHeight?: number
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
        <ScrollView style={{ maxHeight }} nestedScrollEnabled>
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  )
}
