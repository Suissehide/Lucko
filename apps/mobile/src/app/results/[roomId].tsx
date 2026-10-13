import { Banner, Button, PageTitle, Panel, ReasonForm, SkeletonCard } from '@lucko/design-system'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { DetailScreen } from '@/components/DetailScreen'
import { ResultEntry } from '@/components/rooms/ResultEntry'
import { ResultSummary } from '@/components/rooms/ResultSummary'
import { eventWhen } from '@/lib/explore'
import { resultStatusText } from '@/lib/results'
import { useMeQuery } from '@/queries/useMe'
import { useResultMutations, useRoomResultQuery } from '@/queries/useResults'

/**
 * Résultat d'une room classée (LKO-83), après la partie : un présent saisit le classement, les autres le
 * confirment ou le contestent (motif, ou autre classement). Ouvert aussi par les relances push.
 */
export default function RoomResultScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  const me = useMeQuery({ required: true })
  const query = useRoomResultQuery(roomId)
  const { submit, confirm, dispute } = useResultMutations(roomId)
  const [mode, setMode] = useState<'reason' | 'ranking' | null>(null)
  const data = query.data
  const error = submit.error ?? confirm.error ?? dispute.error
  const busy = submit.isPending || confirm.isPending || dispute.isPending
  const clearError = () => {
    submit.reset()
    confirm.reset()
    dispute.reset()
  }
  const done = { onSuccess: () => setMode(null) }

  const result = data?.result
  const present = !!me && !!data?.players.some((p) => p.userId === me.id)
  const canVote =
    present && !result?.myVote && (result?.status === 'PENDING' || result?.status === 'DISPUTED')

  return (
    <DetailScreen title="Résultat">
      <PageTitle
        eyebrow={data ? `${data.title} · ${eventWhen(data.startsAt, null)}` : 'Room classée'}
        title={result ? 'Résultat de la partie' : 'Qui a gagné ?'}
      />
      {error ? <Banner tone="err" message={error.message} onClose={clearError} /> : null}
      {query.isError ? (
        <Banner
          tone="err"
          message={query.error.message}
          action="Réessayer"
          onAction={() => void query.refetch()}
        />
      ) : !data ? (
        <SkeletonCard />
      ) : !result ? (
        data.submitRefused ? (
          <Banner tone="warn" message={data.submitRefused} />
        ) : (
          <ResultEntry
            players={data.players}
            label="Envoyer le résultat"
            busy={busy}
            onSubmit={(input) => submit.mutate(input)}
          />
        )
      ) : (
        <>
          <ResultSummary
            result={result}
            players={data.players}
            statusText={resultStatusText(result, data.deadline)}
          />
          {canVote && mode === null ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {result.status === 'PENDING' ? (
                <Button
                  kind="room"
                  label="Confirmer"
                  disabled={busy}
                  onPress={() => confirm.mutate()}
                />
              ) : null}
              <Button kind="ghost" label="Contester" onPress={() => setMode('reason')} />
              <Button
                kind="ghost"
                label="Proposer un autre classement"
                onPress={() => setMode('ranking')}
              />
            </View>
          ) : null}
          {mode === 'reason' ? (
            <Panel title="Contester le résultat">
              <ReasonForm
                label="Qu’est-ce qui ne va pas ?"
                placeholder="Ex. Léa a gagné la dernière partie, pas Hugo"
                consequence="Le résultat est gelé : le lieu partenaire, ou Lucko, tranche."
                confirmLabel="Contester"
                busy={busy}
                onConfirm={({ text }) => dispute.mutate({ reason: text }, done)}
                onCancel={() => setMode(null)}
              />
            </Panel>
          ) : null}
          {mode === 'ranking' ? (
            <Panel title="Ton classement">
              <ResultEntry
                players={data.players}
                label="Envoyer ma version"
                busy={busy}
                onSubmit={(input) => submit.mutate(input, done)}
              />
              <Button kind="ghost" label="Annuler" onPress={() => setMode(null)} />
            </Panel>
          ) : null}
        </>
      )}
    </DetailScreen>
  )
}
