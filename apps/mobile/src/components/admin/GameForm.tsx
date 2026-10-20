import { Banner, Button, colors, IconButton, Inset, Typography } from '@lucko/design-system'
import { type AdminGame, type GameKind, gameInputSchema } from '@lucko/shared'
import { useStore } from '@tanstack/react-form'
import { Plus, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { useAppForm } from '@/hooks/formConfig'
import { useAdminCatalogMutations } from '@/queries/useAdminCatalog'

const KINDS: { key: GameKind; label: string }[] = [
  { key: 'TCG', label: 'Jeu de cartes (TCG)' },
  { key: 'BOARD_GAME', label: 'Jeu de société' },
]

const newFormat = () => ({
  id: undefined as string | undefined,
  name: '',
  minPlayers: '2',
  maxPlayers: '2',
  durationMinutes: '45',
})

const valuesOf = (game: AdminGame) => ({
  name: game.name,
  kind: game.kind,
  minPlayers: String(game.minPlayers),
  maxPlayers: String(game.maxPlayers),
  formats: game.formats.map((f) => ({
    id: f.id as string | undefined,
    name: f.name,
    minPlayers: String(f.minPlayers),
    maxPlayers: String(f.maxPlayers),
    durationMinutes: String(f.durationMinutes),
  })),
})

const row = { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 } as const
const cell = { flexGrow: 1, flexBasis: 110 }

/**
 * Ajout (sans `game`) ou modification d'un jeu : un TCG avec ses formats, ou un jeu de société avec
 * ses joueurs. Le type ne change pas une fois le jeu créé ; un jeu que rien n'utilise peut être supprimé.
 */
export function GameForm({
  game,
  onDone,
  onCancel,
  onDeleted,
}: {
  game?: AdminGame
  onDone: (game: AdminGame) => void
  onCancel: () => void
  onDeleted?: () => void
}) {
  const { saveGame, deleteGame } = useAdminCatalogMutations()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const form = useAppForm({
    defaultValues: game
      ? valuesOf(game)
      : {
          name: '',
          kind: 'TCG' as GameKind,
          minPlayers: '2',
          maxPlayers: '4',
          formats: [{ ...newFormat(), name: 'Standard' }],
        },
    onSubmit: async ({ value, formApi }) => {
      const tcg = value.kind === 'TCG'
      const parsed = gameInputSchema.safeParse({
        name: value.name,
        kind: value.kind,
        minPlayers: Number(value.minPlayers),
        maxPlayers: Number(value.maxPlayers),
        formats: tcg
          ? value.formats.map((f) => ({
              id: f.id,
              name: f.name,
              minPlayers: Number(f.minPlayers),
              maxPlayers: Number(f.maxPlayers),
              durationMinutes: Number(f.durationMinutes),
            }))
          : [],
      })
      if (!parsed.success) {
        const fields: Record<string, string> = {}
        let formError: string | undefined
        for (const issue of parsed.error.issues) {
          const [key, index, sub] = issue.path
          if (key === 'formats' && sub === undefined) formError ??= issue.message
          else
            fields[key === 'formats' ? `formats[${String(index)}].${String(sub)}` : String(key)] ??=
              issue.message
        }
        formApi.setErrorMap({ onSubmit: { form: formError, fields } })
        return
      }
      try {
        onDone(await saveGame.mutateAsync({ id: game?.id, body: parsed.data }))
      } catch (error) {
        formApi.setErrorMap({
          onSubmit: { form: error instanceof Error ? error.message : 'Réessaie.', fields: {} },
        })
      }
    },
  })
  const tcg = useStore(form.store, (s) => s.values.kind === 'TCG')

  return (
    <Inset>
      <Typography variant="title" style={{ fontSize: 15 }}>
        {game ? `Modifier « ${game.name} »` : 'Nouveau jeu'}
      </Typography>
      <View style={row}>
        <View style={{ flexGrow: 2, flexBasis: 220 }}>
          <form.AppField name="name">
            {(field) => <field.Text label="Nom" placeholder="Riftbound, Ark Nova…" autoFocus />}
          </form.AppField>
        </View>
        {game ? null : (
          <form.AppField name="kind">
            {(field) => <field.Choice label="Type" options={KINDS} />}
          </form.AppField>
        )}
      </View>
      {tcg ? (
        <form.AppField name="formats" mode="array">
          {(formats) => (
            <View style={{ gap: 10 }}>
              <Typography variant="label">Formats</Typography>
              {formats.state.value.map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: les lignes n'ont pas d'id, l'index est leur clé dans le formulaire
                <View key={i} style={row}>
                  <View style={{ flexGrow: 2, flexBasis: 180 }}>
                    <form.AppField name={`formats[${i}].name`}>
                      {(field) => <field.Text label="Nom" placeholder="Standard, Draft…" />}
                    </form.AppField>
                  </View>
                  <View style={cell}>
                    <form.AppField name={`formats[${i}].minPlayers`}>
                      {(field) => <field.Text label="Joueurs min" keyboardType="number-pad" />}
                    </form.AppField>
                  </View>
                  <View style={cell}>
                    <form.AppField name={`formats[${i}].maxPlayers`}>
                      {(field) => <field.Text label="Joueurs max" keyboardType="number-pad" />}
                    </form.AppField>
                  </View>
                  <View style={cell}>
                    <form.AppField name={`formats[${i}].durationMinutes`}>
                      {(field) => <field.Text label="Durée (min)" keyboardType="number-pad" />}
                    </form.AppField>
                  </View>
                  <View style={{ paddingTop: 26 }}>
                    <IconButton
                      label="Retirer le format"
                      icon={<Trash2 size={18} color={colors.ink} strokeWidth={2.5} />}
                      disabled={formats.state.value.length === 1}
                      onPress={() => formats.removeValue(i)}
                    />
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: 'row' }}>
                <Button
                  small
                  kind="ghost"
                  icon={Plus}
                  label="Ajouter un format"
                  onPress={() => formats.pushValue(newFormat())}
                />
              </View>
            </View>
          )}
        </form.AppField>
      ) : (
        <View style={row}>
          <View style={cell}>
            <form.AppField name="minPlayers">
              {(field) => <field.Text label="Joueurs min" keyboardType="number-pad" />}
            </form.AppField>
          </View>
          <View style={cell}>
            <form.AppField name="maxPlayers">
              {(field) => <field.Text label="Joueurs max" keyboardType="number-pad" />}
            </form.AppField>
          </View>
        </View>
      )}
      {confirmDelete && game ? (
        <View style={{ gap: 8 }}>
          <Typography variant="small" weight={800} style={{ color: colors.room }}>
            « {game.name} » et ses formats seront supprimés. Cette action est définitive.
          </Typography>
          {deleteGame.isError ? <Banner tone="err" message={deleteGame.error.message} /> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Button
              small
              kind="ghost"
              label="Garder le jeu"
              onPress={() => setConfirmDelete(false)}
            />
            <Button
              small
              kind="room"
              label="Supprimer"
              disabled={deleteGame.isPending}
              onPress={() => deleteGame.mutate(game.id, { onSuccess: onDeleted })}
            />
          </View>
        </View>
      ) : null}
      <form.AppForm>
        <form.FormError />
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}
        >
          {game && !confirmDelete ? (
            <View style={{ flexGrow: 1 }}>
              <View style={{ flexDirection: 'row' }}>
                <Button
                  small
                  kind="ghost"
                  label="Supprimer le jeu"
                  onPress={() => {
                    deleteGame.reset()
                    setConfirmDelete(true)
                  }}
                />
              </View>
            </View>
          ) : null}
          <Button small kind="ghost" label="Annuler" onPress={onCancel} />
          <form.SubmitButton
            small
            kind="venue"
            label={game ? 'Enregistrer' : 'Ajouter au catalogue'}
          />
        </View>
      </form.AppForm>
    </Inset>
  )
}
