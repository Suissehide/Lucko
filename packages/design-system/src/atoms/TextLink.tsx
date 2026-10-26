import type { LucideIcon } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { colors, font, transition } from '../tokens'
import { useHover } from './useHover'

/** `muted` : lien discret souligné (ex. « Supprimer mon compte »). */
export function TextLink({
  label,
  muted,
  icon: Icon,
  iconAfter,
  onDark,
  onPress,
}: {
  label: string
  muted?: boolean
  /** Sur fond ink : jaune, blanc au survol. */
  onDark?: boolean
  /** Icône Lucide avant le libellé (ex. retour). */
  icon?: LucideIcon
  /** Icône après le libellé (ex. chevron « Profil › »). */
  iconAfter?: boolean
  onPress?: () => void
}) {
  const { hovered, hoverProps } = useHover()
  const color = onDark
    ? hovered
      ? colors.white
      : colors.rating
    : hovered
      ? colors.room
      : muted
        ? colors.muted
        : colors.event
  return (
    <Pressable role="link" aria-label={label} onPress={onPress} {...hoverProps}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {Icon && !iconAfter ? <Icon size={15} color={color} strokeWidth={2.5} /> : null}
        <Text
          style={{
            ...font('body', muted ? 600 : 800),
            fontSize: 13,
            color,
            textDecorationLine: muted ? 'underline' : 'none',
            ...transition(['color']),
          }}
        >
          {label}
        </Text>
        {Icon && iconAfter ? <Icon size={15} color={color} strokeWidth={2.5} /> : null}
      </View>
    </Pressable>
  )
}
