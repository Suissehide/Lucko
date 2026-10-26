import type { ComponentProps, ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { CountBadge } from '../atoms/CountBadge'
import { Raised } from '../atoms/Raised'
import { useHover } from '../atoms/useHover'
import { Brand } from '../molecules/Brand'
import {
  border,
  colors,
  font,
  motion,
  radius,
  shadow,
  space,
  textOn,
  transition,
  z,
} from '../tokens'
import { AccountMenu } from './AccountMenu'

/** `badge` : pastille de compte (messages non lus), masquée à 0. */
export type TopNavItem = { key: string; label: string; badge?: number }

export function TopNav({
  items = [],
  active,
  onSelect,
  color = colors.room,
  right,
  onHome,
  account,
}: {
  items?: TopNavItem[]
  active?: string
  onSelect?: (key: string) => void
  color?: string
  right?: ReactNode
  onHome?: () => void
  /** Joueur connecté : avatar qui ouvre le menu du compte. */
  account?: ComponentProps<typeof AccountMenu>
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: space.page,
        borderBottomWidth: border.base,
        borderColor: colors.ink,
        // Le menu du compte déborde sur le contenu
        zIndex: z.popover,
      }}
    >
      <Brand onPress={onHome} />
      {items.length ? (
        <View role="navigation" style={{ flexDirection: 'row', gap: 8, marginLeft: 40 }}>
          {items.map((item) => (
            <NavLink
              key={item.key}
              label={item.label}
              badge={item.badge}
              active={item.key === active}
              color={color}
              onPress={() => onSelect?.(item.key)}
            />
          ))}
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      {right}
      {account ? <AccountMenu {...account} /> : null}
    </View>
  )
}

function NavLink({
  label,
  badge,
  active,
  color,
  onPress,
}: {
  label: string
  badge?: number
  active: boolean
  color: string
  onPress: () => void
}) {
  const { hovered, hoverProps } = useHover()
  const pill = (
    <View
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: radius.field,
        borderWidth: border.thin,
        borderColor: active ? colors.ink : 'transparent',
        backgroundColor: active ? color : 'transparent',
        transform: active && hovered ? [{ translateX: -1 }, { translateY: -1 }] : [],
        ...transition(['transform'], motion.fast),
      }}
    >
      <Text
        style={{
          ...font('body', active ? 800 : 600),
          fontSize: 14,
          color: active ? textOn(color) : colors.ink,
        }}
      >
        {label}
      </Text>
      {badge ? <CountBadge count={badge} /> : null}
      {active ? null : (
        <View
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 2,
            height: border.base,
            borderRadius: border.base,
            backgroundColor: colors.ink,
            transform: [{ scaleX: hovered ? 1 : 0 }],
            ...transition(['transform']),
          }}
        />
      )}
    </View>
  )
  return (
    <Pressable
      role="link"
      aria-label={badge ? `${label}, ${badge} non lus` : label}
      aria-current={active ? 'page' : undefined}
      onPress={onPress}
      {...hoverProps}
      // L'ombre de la pastille mange l'espace avec le lien suivant
      style={{ borderRadius: radius.field, marginRight: active ? shadow.sm + 6 : 0 }}
    >
      {active ? (
        <Raised offset={shadow.sm} r={radius.field}>
          {pill}
        </Raised>
      ) : (
        pill
      )}
    </Pressable>
  )
}
