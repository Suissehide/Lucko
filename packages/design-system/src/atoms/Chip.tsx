import type { LucideIcon } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { border, colors, font, radius, sizes, textOn, transition } from '../tokens'
import { useHover } from './useHover'

/** Pastille de filtre ; active = fond rating (ou `color`). Sans `onPress` : simple étiquette, sans survol. */
export function Chip({
  label,
  active,
  color = colors.rating,
  tall,
  count,
  icon: Icon,
  dashed,
  onPress,
}: {
  label: string
  active?: boolean
  color?: string
  /** Cible tactile de 44 px (choix sur téléphone). */
  tall?: boolean
  count?: number
  /** Icône Lucide avant le libellé (coche d'un filtre actif). */
  icon?: LucideIcon
  /** Choix « Autre… » qui ouvre un réglage : bordure en pointillés tant qu'il est inactif. */
  dashed?: boolean
  onPress?: () => void
}) {
  const { hovered, hoverProps } = useHover()
  const style = {
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderStyle: dashed && !active ? ('dashed' as const) : ('solid' as const),
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: tall ? 14 : 11,
    minHeight: tall ? sizes.touch : undefined,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    justifyContent: 'center' as const,
    backgroundColor: active ? color : hovered ? colors.hover : colors.white,
    ...transition(['background-color']),
  }
  const fg = active ? textOn(color) : colors.ink
  const text = (
    <Text
      style={{
        ...font('body', active ? 800 : 600),
        fontSize: 13,
        color: fg,
      }}
    >
      {label}
      {count === undefined ? null : (
        <Text style={{ ...font('mono', 400), fontSize: 11 }}>{`  ${count}`}</Text>
      )}
    </Text>
  )
  const icon = Icon ? <Icon size={14} color={fg} strokeWidth={3} /> : null
  if (!onPress) {
    return (
      <View style={[style, { alignSelf: 'flex-start' }]}>
        {icon}
        {text}
      </View>
    )
  }
  return (
    <Pressable
      role="button"
      aria-label={count === undefined ? label : `${label} (${count})`}
      aria-pressed={!!active}
      onPress={onPress}
      {...hoverProps}
      style={style}
    >
      {icon}
      {text}
    </Pressable>
  )
}
