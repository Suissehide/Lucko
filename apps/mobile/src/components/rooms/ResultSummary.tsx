import { ListCard, ListRow, StatusPill, Typography } from '@lucko/design-system'
import { type Placements, RESULT_STATUS_LABELS, type RoomResult } from '@lucko/shared'
import { View } from 'react-native'
import { rankingRows } from '@/lib/results'

const TONE = {
  PENDING: 'warn',
  DISPUTED: 'err',
  CONFIRMED: 'ok',
  RESOLVED: 'ok',
  VOID: 'err',
} as const

/** Un classement en lecture seule : place, pseudo, ex aequo. */
export function RankingList({
  placements,
  players,
}: {
  placements: Placements
  players: RoomResult['players']
}) {
  const rows = rankingRows(placements, players)
  return (
    <ListCard>
      {rows.map((row, i) => (
        <ListRow
          key={row.userId}
          inset={16}
          title={row.title}
          right={row.tie ? <Typography variant="small">ex aequo</Typography> : undefined}
          last={i === rows.length - 1}
        />
      ))}
    </ListCard>
  )
}

/**
 * Résultat saisi (LKO-83) : statut, classement, score, qui l'a saisi et les contestations avec leur
 * motif et la contre-proposition éventuelle.
 */
export function ResultSummary({
  result,
  players,
  statusText,
}: {
  result: NonNullable<RoomResult['result']>
  players: RoomResult['players']
  statusText?: string
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <StatusPill tone={TONE[result.status]} label={RESULT_STATUS_LABELS[result.status]} />
        <Typography variant="small">
          Saisi par {result.submittedBy ?? 'un joueur'}
          {result.score ? ` · ${result.score}` : ''}
        </Typography>
      </View>
      {statusText ? <Typography variant="small">{statusText}</Typography> : null}
      <RankingList placements={result.placements} players={players} />
      {result.disputes.map((d) => (
        <View key={`${d.pseudo}-${d.reason}`} style={{ gap: 8 }}>
          <Typography variant="small" weight={700}>
            Contesté par {d.pseudo ?? 'un joueur'} : {d.reason}
          </Typography>
          {d.placements ? <RankingList placements={d.placements} players={players} /> : null}
        </View>
      ))}
    </View>
  )
}
