import { View } from 'react-native'
import { Typography } from '../atoms/Typography'
import { border, colors } from '../tokens'

/** Légende sous une carte : une pastille ronde par type d'épingle ; `ring` = anneau (lieu partenaire). */
export function MapLegend({
  items,
}: {
  items: { label: string; color: string; ring?: boolean }[]
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              borderWidth: item.ring ? 3 : border.thin,
              borderColor: item.ring ? item.color : colors.ink,
              backgroundColor: item.ring ? colors.white : item.color,
            }}
          />
          <Typography variant="small">{item.label}</Typography>
        </View>
      ))}
    </View>
  )
}
