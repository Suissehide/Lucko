import { Text, View } from 'react-native'
import { Tag } from '../atoms/Tag'
import { border, colors, font } from '../tokens'
import { ListRow } from './ListRow'

export function VenueRow({
  name,
  subtitle,
  distance,
  partner,
  perk,
  inset,
  last,
  selected,
  onPress,
}: {
  name: string
  subtitle: string
  distance: string
  partner?: boolean
  perk?: string | null
  inset?: number
  last?: boolean
  /** Lieu choisi sur la carte : ligne mise en évidence */
  selected?: boolean
  onPress?: () => void
}) {
  return (
    <ListRow
      inset={inset}
      last={last}
      selected={selected}
      onPress={onPress}
      left={
        <View
          aria-label={partner ? 'Lieu partenaire' : undefined}
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            borderWidth: border.thin,
            borderColor: colors.ink,
            backgroundColor: partner ? colors.venue : colors.white,
          }}
        />
      }
      title={name}
      subtitle={subtitle}
      note={perk ?? undefined}
      right={
        // Badge en toutes lettres : la couleur de la pastille seule ne suffit pas (accessibilité)
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {partner ? <Tag label="Partenaire" variant="partner" /> : null}
          <Text style={{ ...font('mono', 700), fontSize: 13, color: colors.ink }}>{distance}</Text>
        </View>
      }
    />
  )
}
