import { Pressable, Text, View } from 'react-native'
import { useHover } from '../atoms/useHover'
import { border, colors, font, radius, textOn, transition } from '../tokens'

/** Segments égaux ; l'actif prend la couleur du contenu (Rooms rouge, Événements bleu…). */
export function Segmented({
  items,
  value,
  onChange,
  color = colors.room,
}: {
  items: string[]
  value: number
  onChange?: (i: number) => void
  color?: string
}) {
  return (
    <View role="tablist" style={{ flexDirection: 'row', gap: 6 }}>
      {items.map((label, i) => (
        <Segment
          key={label}
          label={label}
          active={i === value}
          color={color}
          onPress={() => onChange?.(i)}
        />
      ))}
    </View>
  )
}

function Segment({
  label,
  active,
  color,
  onPress,
}: {
  label: string
  active: boolean
  color: string
  onPress: () => void
}) {
  const { hovered, hoverProps } = useHover()
  return (
    <Pressable
      role="tab"
      aria-selected={active}
      aria-label={label}
      onPress={onPress}
      {...hoverProps}
      style={{
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderWidth: border.thin,
        borderColor: colors.ink,
        borderRadius: radius.sm,
        backgroundColor: active ? color : hovered ? colors.hover : colors.white,
        ...transition(['background-color']),
      }}
    >
      <Text
        style={{
          ...font('body', active ? 800 : 600),
          fontSize: 13,
          color: active ? textOn(color) : colors.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
