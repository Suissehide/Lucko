import { Banner, Button, Panel, ReasonForm, Typography } from '@lucko/design-system'
import type { Placements, RoomResult } from '@lucko/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { eventWhen } from '@/lib/explore'
import { useDecideResultMutation } from '@/queries/useResults'
import { ResultEntry } from './ResultEntry'
import { ResultSummary } from './ResultSummary'

type Choice = { label: string; placements: Placements | null }

/**
 * Contestation à trancher (LKO-83), par le staff du lieu partenaire (`venueId`) ou un admin : garder la
 * saisie, une contre-proposition, un autre classement, ou classer la room sans résultat. Motif obligatoire.
 */
export function ResultDisputeCard({ item, venueId }: { item: RoomResult; venueId?: string }) {
  const decide = useDecideResultMutation(venueId)
  const [choice, setChoice] = useState<Choice | null>(null)
  const [other, setOther] = useState(false)
  const result = item.result
  if (!result) return null

  const choices: Choice[] = [
    { label: 'Garder la saisie', placements: result.placements },
    ...result.disputes.flatMap((d) =>
      d.placements
        ? [{ label: `Garder la version de ${d.pseudo ?? 'ce joueur'}`, placements: d.placements }]
        : [],
    ),
    { label: 'Sans résultat', placements: null },
  ]

  return (
    <Panel
      title={`${item.title} · ${eventWhen(item.startsAt, null)}`}
      right={item.venueName ? <Typography variant="small">{item.venueName}</Typography> : null}
    >
      <View style={{ gap: 12 }}>
        <ResultSummary result={result} players={item.players} />
        {decide.error ? (
          <Banner tone="err" message={decide.error.message} onClose={() => decide.reset()} />
        ) : null}
        {choice ? (
          <ReasonForm
            label={`${choice.label} : pourquoi ?`}
            placeholder="Ex. vérifié avec les joueurs à la table"
            consequence={
              choice.placements
                ? 'Le classement est validé et les LK des joueurs mis à jour.'
                : 'La room reste sans résultat : aucun effet sur les LK.'
            }
            confirmLabel="Trancher"
            busy={decide.isPending}
            onConfirm={({ text }) =>
              decide.mutate({ roomId: item.roomId, placements: choice.placements, reason: text })
            }
            onCancel={() => setChoice(null)}
          />
        ) : other ? (
          <>
            <ResultEntry
              players={item.players}
              label="Retenir ce classement"
              onSubmit={({ placements }) => {
                setOther(false)
                setChoice({ label: 'Autre classement', placements })
              }}
            />
            <Button kind="ghost" label="Annuler" onPress={() => setOther(false)} />
          </>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {choices.map((c) => (
              <Button
                key={c.label}
                kind={c.placements ? 'soft' : 'ghost'}
                label={c.label}
                onPress={() => setChoice(c)}
              />
            ))}
            <Button kind="ghost" label="Autre classement" onPress={() => setOther(true)} />
          </View>
        )}
      </View>
    </Panel>
  )
}
