import { Check, TriangleAlert } from 'lucide-react-native'
import { Text, View } from 'react-native'
import { border, colors, font, radius } from '../tokens'

export type ChecklistState = 'done' | 'todo' | 'warn' | 'locked'
const boxes: Record<ChecklistState, string> = {
  done: colors.venue,
  todo: colors.white,
  warn: colors.rating,
  locked: colors.ink,
}

/**
 * Étape d'une liste dans un cadre : faite, à faire, à surveiller ou imposée (check-in tournoi,
 * publication d'un lieu, garde-fous du back-office).
 */
export function ChecklistRow({
  state,
  label,
  note,
}: {
  state: ChecklistState
  label: string
  note?: string
}) {
  const said = { done: 'fait', todo: 'à faire', warn: 'à surveiller', locked: 'imposé' }[state]
  return (
    <View
      aria-label={`${label}, ${said}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 10,
        backgroundColor: colors.white,
        borderWidth: border.thin,
        borderColor: colors.ink,
        borderRadius: radius.field,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: border.thin,
          borderColor: colors.ink,
          backgroundColor: boxes[state],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {state === 'done' || state === 'locked' ? (
          <Check size={14} color={colors.white} strokeWidth={3.5} />
        ) : state === 'warn' ? (
          <TriangleAlert size={14} color={colors.ink} strokeWidth={3} />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ ...font('body', 800), fontSize: 14, color: colors.ink }}>{label}</Text>
        {note ? (
          <Text style={{ ...font('body', 400), fontSize: 12, color: colors.muted }}>{note}</Text>
        ) : null}
      </View>
      {state === 'locked' ? (
        <Text style={{ ...font('mono', 700), fontSize: 10, color: colors.muted }}>IMPOSÉ</Text>
      ) : null}
    </View>
  )
}

/** Point de vérification : coché (vert) ou à surveiller (triangle jaune), libellé et détail. */
export function ChecklistItem({
  ok,
  label,
  detail,
}: {
  ok: boolean
  label: string
  detail?: string
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          borderWidth: border.thin,
          borderColor: colors.ink,
          backgroundColor: ok ? colors.venue : colors.rating,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {ok ? (
          <Check size={13} color={colors.white} strokeWidth={3.5} />
        ) : (
          <TriangleAlert size={13} color={colors.ink} strokeWidth={3} />
        )}
      </View>
      <Text style={{ ...font('body', 800), fontSize: 14, color: colors.ink }}>{label}</Text>
      {detail ? (
        <Text style={{ flexShrink: 1, ...font('body', 400), fontSize: 13, color: colors.muted }}>
          {detail}
        </Text>
      ) : null}
    </View>
  )
}
