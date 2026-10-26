import {
  Banner,
  Button,
  Checkbox,
  ChipGroup,
  Note,
  PageTitle,
  ScreenHeader,
  SettingsCard,
  SettingsRow,
  SkeletonCard,
  Typography,
} from '@lucko/design-system'
import { PLAY_WHEN, PLAY_WHEN_LABELS, type PlayWhen } from '@lucko/shared'
import { useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { PlayerScreen } from '@/components/PlayerScreen'
import { goBack } from '@/lib/navigation'
import { demandLine, PLAY_INTENTS_NOTE, usePlayIntents } from '@/lib/playIntents'
import { useMeQuery } from '@/queries/useMe'

const WIDE = 900

/** « Je veux jouer à… » (LKO-17, maquette 9c) : jeux cochés et moment, enregistrés d'un coup. */
export default function PlayIntentsScreen() {
  const wide = useWindowDimensions().width >= WIDE
  useMeQuery({ required: true })
  const intents = usePlayIntents()
  const [gameIds, setGameIds] = useState<string[] | null>(null)
  const [when, setWhen] = useState<PlayWhen | null>(null)
  const [failed, setFailed] = useState(false)

  // Brouillon initialisé une fois les envies chargées
  useEffect(() => {
    if (!intents.loaded) return
    setGameIds((current) => current ?? intents.gameIds)
    setWhen((current) => current ?? intents.when)
  }, [intents.loaded, intents.gameIds, intents.when])

  const selected = gameIds ?? []
  // Tout décocher n'a de sens que pour retirer des envies déjà enregistrées (LKO-162)
  const clearing = selected.length === 0 && intents.gameIds.length > 0
  const toggle = (id: string) =>
    setGameIds(selected.includes(id) ? selected.filter((g) => g !== id) : [...selected, id])
  const save = async () => {
    setFailed(false)
    try {
      await intents.save({ gameIds: selected, when: when ?? 'ANY' })
      goBack()
    } catch {
      setFailed(true)
    }
  }

  return (
    <PlayerScreen
      tab="agenda"
      wide={wide}
      pushed
      header={<ScreenHeader title="Je veux jouer à…" onBack={goBack} />}
      footer={
        <View style={wide ? { alignSelf: 'flex-start' } : null}>
          <Button
            label={clearing ? 'Ne plus me prévenir' : 'Me prévenir'}
            disabled={intents.saving || (selected.length === 0 && !clearing)}
            onPress={() => void save()}
          />
        </View>
      }
    >
      {wide ? <PageTitle title="Je veux jouer à…" /> : null}
      <Typography variant="body" style={{ maxWidth: 640 }}>
        Coche tes jeux. Quand quelqu'un ouvre une room compatible dans ton rayon, tu reçois une
        notification.
      </Typography>
      {failed ? <Banner tone="err" message="Impossible d'enregistrer tes jeux. Réessaie." /> : null}
      {!intents.loaded ? (
        <SkeletonCard />
      ) : (
        <View style={{ gap: 16, maxWidth: 640 }}>
          <SettingsCard>
            {intents.demand.map((d) => {
              const on = selected.includes(d.game.id)
              return (
                <SettingsRow
                  key={d.game.id}
                  label={d.game.name}
                  description={demandLine(d, intents.city)}
                  onPress={() => toggle(d.game.id)}
                  aside={
                    <Checkbox
                      hideLabel
                      label={d.game.name}
                      value={on}
                      onChange={() => toggle(d.game.id)}
                    />
                  }
                />
              )
            })}
          </SettingsCard>
          <View style={{ gap: 8 }}>
            <Typography variant="label">Quand ?</Typography>
            <ChipGroup
              items={PLAY_WHEN.map((key) => ({ key, label: PLAY_WHEN_LABELS[key] }))}
              value={when ?? 'ANY'}
              onChange={setWhen}
            />
          </View>
          <Note tone="plain">{PLAY_INTENTS_NOTE}</Note>
        </View>
      )}
    </PlayerScreen>
  )
}
