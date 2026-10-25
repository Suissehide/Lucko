import { Pressable, Text, View } from 'react-native'
import { border, colors, font, sizes, transition } from '../tokens'
import { useHover } from './useHover'

export type Presence = 'present' | 'absent'

/**
 * Pointage d'un joueur : Là / Absent. `null` = pas encore pointé, aucun segment actif.
 * Sans `onChange` (pointage pas encore ouvert, clos, ou présence verrouillée) : grisé et inactif (LKO-159).
 */
export function PresenceToggle({
  value,
  onChange,
  label,
}: {
  value: Presence | null
  onChange?: (v: Presence) => void
  /** Nom du joueur, lu par les lecteurs d'écran. */
  label?: string
}) {
  return (
    <View
      role="radiogroup"
      aria-label={label ? `Présence de ${label}` : 'Présence'}
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-start',
        borderWidth: border.thin,
        borderColor: colors.ink,
        borderRadius: 9,
        overflow: 'hidden',
        opacity: onChange ? 1 : 0.45,
      }}
    >
      <Segment
        text="Là"
        active={value === 'present'}
        bg={colors.venue}
        disabled={!onChange}
        onPress={() => onChange?.('present')}
      />
      <Segment
        text="Absent"
        active={value === 'absent'}
        bg={colors.room}
        divider
        disabled={!onChange}
        onPress={() => onChange?.('absent')}
      />
    </View>
  )
}

function Segment({
  text,
  active,
  bg,
  divider,
  disabled,
  onPress,
}: {
  text: string
  active: boolean
  bg: string
  divider?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { hovered, hoverProps } = useHover()
  return (
    <Pressable
      role="radio"
      aria-checked={active}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      {...(disabled ? {} : hoverProps)}
      style={{
        minWidth: sizes.touch,
        minHeight: 40,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderLeftWidth: divider ? border.thin : 0,
        borderColor: colors.ink,
        backgroundColor: active ? bg : hovered ? colors.hover : colors.white,
        ...transition(['background-color']),
      }}
    >
      <Text
        style={{ ...font('body', 800), fontSize: 12, color: active ? colors.white : colors.ink }}
      >
        {text}
      </Text>
    </Pressable>
  )
}
