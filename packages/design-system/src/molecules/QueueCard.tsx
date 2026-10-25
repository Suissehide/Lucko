import { ArrowRight } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { Raised } from '../atoms/Raised'
import { useHover } from '../atoms/useHover'
import { border, colors, font, radius, shadow, transition } from '../tokens'

/** File à traiter : nombre, libellé, note ; à zéro, chiffre éteint et sans ombre. */
export function QueueCard({
  value,
  label,
  note,
  color,
  onPress,
}: {
  value: number
  label: string
  note: string
  color: string
  onPress: () => void
}) {
  const { hovered, hoverProps } = useHover()
  const card = (
    <View
      style={{
        borderWidth: border.base,
        borderColor: colors.ink,
        borderRadius: radius.card,
        backgroundColor: hovered ? colors.hover : colors.white,
        overflow: 'hidden',
        ...transition(['background-color']),
      }}
    >
      <View
        style={{
          height: 8,
          backgroundColor: color,
          borderBottomWidth: border.thin,
          borderColor: colors.ink,
        }}
      />
      <View style={{ padding: 14, gap: 2 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}
        >
          <Text
            style={{
              ...font('display'),
              fontSize: 44,
              lineHeight: 46,
              color: value > 0 ? color : colors.inkMuted,
            }}
          >
            {value}
          </Text>
          <ArrowRight size={20} color={colors.ink} strokeWidth={3} style={{ marginBottom: 10 }} />
        </View>
        <Text style={{ ...font('body', 800), fontSize: 15, color: colors.ink }}>{label}</Text>
        <Text numberOfLines={1} style={{ ...font('body', 400), fontSize: 13, color: colors.muted }}>
          {note}
        </Text>
      </View>
    </View>
  )
  return (
    <Pressable role="link" onPress={onPress} {...hoverProps} style={{ flex: 1, minWidth: 180 }}>
      {value > 0 ? (
        <Raised offset={shadow.card} r={radius.card}>
          {card}
        </Raised>
      ) : (
        card
      )}
    </Pressable>
  )
}
