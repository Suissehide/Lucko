import { Platform, Pressable, Text, View, type ViewStyle } from 'react-native'
import { border, colors, font, type Tone, textOn, toneStyles, z } from '../tokens'

/** Toast sombre, ombre à la couleur du ton (web) ; à positionner par l'écran appelant. */
export function Toast({
  message,
  tone = 'ok',
  action,
  onAction,
}: {
  message: string
  tone?: Tone
  action?: string
  onAction?: () => void
}) {
  const t = toneStyles[tone]
  const Icon = t.icon
  const toneShadow: ViewStyle | null =
    Platform.OS === 'web' ? { boxShadow: `4px 4px 0 ${t.solid}` } : null
  return (
    <View
      role="status"
      aria-live="polite"
      style={[
        {
          zIndex: z.toast,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: colors.ink,
          borderWidth: border.base,
          borderColor: colors.ink,
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 14,
        },
        toneShadow,
      ]}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: t.solid,
          borderWidth: border.thin,
          borderColor: colors.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={14} color={textOn(t.solid)} strokeWidth={3} />
      </View>
      <Text style={{ flex: 1, ...font('body', 600), fontSize: 14, color: colors.white }}>
        {message}
      </Text>
      {action ? (
        <Pressable role="button" aria-label={action} onPress={onAction}>
          <Text
            style={{
              ...font('body', 800),
              fontSize: 13,
              color: colors.rating,
              textTransform: 'uppercase',
            }}
          >
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
