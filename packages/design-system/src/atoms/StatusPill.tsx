import { Text, View } from 'react-native'
import { border, colors, font, radius, semantic } from '../tokens'

export type StatusTone = 'ok' | 'warn' | 'err' | 'info' | 'neutral' | 'strong'
const tones: Record<StatusTone, { bg: string; dot: string }> = {
  ok: { bg: semantic.successSoft, dot: semantic.success },
  warn: { bg: semantic.warningSoft, dot: semantic.warningDot },
  err: { bg: semantic.dangerSoft, dot: semantic.danger },
  info: { bg: semantic.infoSoft, dot: semantic.info },
  neutral: { bg: semantic.neutralSoft, dot: colors.muted },
  strong: { bg: colors.ink, dot: colors.white },
}

/** Statut : toujours point coloré + libellé, jamais la couleur seule. */
export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  const t = tones[tone]
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        // Colonne étroite : le libellé passe à la ligne plutôt que d'être coupé
        maxWidth: '100%',
        backgroundColor: t.bg,
        borderWidth: border.thin,
        borderColor: colors.ink,
        borderRadius: radius.pill,
        paddingVertical: 2,
        paddingLeft: 7,
        paddingRight: 9,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: t.dot,
          borderWidth: 1.5,
          borderColor: colors.ink,
        }}
      />
      <Text
        style={{
          ...font('body', 700),
          fontSize: 12,
          color: tone === 'strong' ? colors.white : colors.ink,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </View>
  )
}
