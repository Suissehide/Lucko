import { Pressable, Text, View } from 'react-native'
import { useHover } from '../atoms/useHover'
import { border, colors, font, radius, sizes, transition } from '../tokens'

/** Bascule compacte dans un cadre (Liste / Calendrier) ; l'option active est en ink. */
export function ToggleGroup({
  items,
  value,
  onChange,
}: {
  items: string[]
  value: number
  onChange: (i: number) => void
}) {
  return (
    <View
      role="tablist"
      style={{
        flexDirection: 'row',
        gap: 4,
        padding: 3,
        borderWidth: border.thin,
        borderColor: colors.ink,
        borderRadius: radius.field,
        backgroundColor: colors.white,
      }}
    >
      {items.map((label, i) => (
        <Option key={label} label={label} active={i === value} onPress={() => onChange(i)} />
      ))}
    </View>
  )
}

function Option({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const { hovered, hoverProps } = useHover()
  return (
    <Pressable
      role="tab"
      aria-selected={active}
      aria-label={label}
      onPress={onPress}
      hitSlop={(sizes.touch - 32) / 2}
      {...hoverProps}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 7,
        backgroundColor: active ? colors.ink : hovered ? colors.hover : colors.white,
        ...transition(['background-color']),
      }}
    >
      <Text
        style={{
          ...font('body', active ? 800 : 600),
          fontSize: 13,
          color: active ? colors.white : colors.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
