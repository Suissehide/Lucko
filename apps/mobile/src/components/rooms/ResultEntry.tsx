import { Button, RankPicker, ScorePicker, Segmented, Typography } from '@lucko/design-system'
import { duelPlacements, type Placements, type RoomResult } from '@lucko/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { orderPlacements, rankPlayers } from '@/lib/results'

const BEST_OF = [1, 3] as const

/**
 * Saisie d'un classement (LKO-83) : score en duel (une manche ou au meilleur des 3), ordre d'arrivée par
 * touchers successifs en multijoueur. Sert à la saisie, à la contre-proposition et à l'arbitrage.
 */
export function ResultEntry({
  players,
  label,
  busy,
  onSubmit,
}: {
  players: RoomResult['players']
  label: string
  busy?: boolean
  onSubmit: (input: { placements: Placements; score: string | null }) => void
}) {
  const [order, setOrder] = useState<string[]>([])
  const [bestOf, setBestOf] = useState(0)
  const [score, setScore] = useState<string | null>(null)
  const [a, b] = players

  if (players.length === 2 && a && b) {
    return (
      <View style={{ gap: 12 }}>
        <Segmented
          items={['Une manche', 'Au meilleur des 3']}
          value={bestOf}
          onChange={(i) => {
            setBestOf(i)
            setScore(null)
          }}
        />
        <Typography variant="small">
          Score de {a.pseudo ?? 'Joueur 1'} contre {b.pseudo ?? 'Joueur 2'}
        </Typography>
        <ScorePicker bestOf={BEST_OF[bestOf] ?? 1} value={score} onChange={setScore} />
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            kind="room"
            label={label}
            disabled={!score || busy}
            onPress={() =>
              score && onSubmit({ placements: duelPlacements([a.userId, b.userId], score), score })
            }
          />
        </View>
      </View>
    )
  }

  return (
    <View style={{ gap: 12 }}>
      <Typography variant="small">
        Touche les joueurs dans l’ordre d’arrivée, du premier au dernier.
      </Typography>
      <RankPicker players={rankPlayers(players)} order={order} onChange={setOrder} />
      <View style={{ alignSelf: 'flex-start' }}>
        <Button
          kind="room"
          label={label}
          disabled={order.length !== players.length || busy}
          onPress={() => onSubmit({ placements: orderPlacements(order), score: null })}
        />
      </View>
    </View>
  )
}
