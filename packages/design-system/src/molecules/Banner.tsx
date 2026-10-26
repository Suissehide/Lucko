import { X } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { border, colors, font, type Tone, toneStyles } from '../tokens'

export function Banner({
  message,
  tone = 'warn',
  action,
  onAction,
  onClose,
}: {
  message: string
  tone?: Tone
  action?: string
  onAction?: () => void
  onClose?: () => void
}) {
  const { soft, icon: Icon } = toneStyles[tone]
  return (
    <View
      role="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: soft,
        borderWidth: border.base,
        borderColor: colors.ink,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
      }}
    >
      <Icon size={18} color={colors.ink} strokeWidth={2.5} />
      <Text style={{ flex: 1, ...font('body', 600), fontSize: 14, color: colors.ink }}>
        {message}
      </Text>
      {action ? (
        <Pressable role="button" aria-label={action} onPress={onAction}>
          <Text style={{ ...font('body', 800), fontSize: 13, color: colors.event }}>{action}</Text>
        </Pressable>
      ) : null}
      {onClose ? (
        <Pressable role="button" onPress={onClose} aria-label="Fermer" hitSlop={12}>
          <X size={16} color={colors.ink} strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </View>
  )
}
