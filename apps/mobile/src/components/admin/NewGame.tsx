import { Button, colors, IconButton, Inset, Typography } from '@lucko/design-system'
import { type AdminGame, createGameSchema, type GameKind } from '@lucko/shared'
import { useStore } from '@tanstack/react-form'
import { Plus, Trash2 } from 'lucide-react-native'
import { View } from 'react-native'
import { useAppForm } from '@/hooks/formConfig'
import { useAdminCatalogMutations } from '@/queries/useAdminCatalog'

const KINDS: { key: GameKind; label: string }[] = [
  { key: 'TCG', label: 'Jeu de cartes (TCG)' },
  { key: 'BOARD_GAME', label: 'Jeu de société' },
]

const newFormat = () => ({ name: '', minPlayers: '2', maxPlayers: '2', durationMinutes: '45' })

const row = { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 } as const
const cell = { flexGrow: 1, flexBasis: 110 }

/** Ajout d'un jeu au catalogue : un TCG avec ses formats, ou un jeu de société avec ses joueurs. */
export function NewGame({
  onDone,
  onCancel,
}: {
  onDone: (game: AdminGame) => void
  onCancel: () => void
}) {
  const { createGame } = useAdminCatalogMutations()
  const form = useAppForm({
    defaultValues: {
      name: '',
      kind: 'TCG' as GameKind,
      minPlayers: '2',
      maxPlayers: '4',
      formats: [{ ...newFormat(), name: 'Standard' }],
    },
    onSubmit: async ({ value, formApi }) => {
      const tcg = value.kind === 'TCG'
      const parsed = createGameSchema.safeParse({
        name: value.name,
        kind: value.kind,
        minPlayers: Number(value.minPlayers),
        maxPlayers: Number(value.maxPlayers),
        formats: tcg
          ? value.formats.map((f) => ({
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
        onDone(await createGame.mutateAsync(parsed.data))
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
        Nouveau jeu
      </Typography>
      <View style={row}>
        <View style={{ flexGrow: 2, flexBasis: 220 }}>
          <form.AppField name="name">
            {(field) => <field.Text label="Nom" placeholder="Riftbound, Ark Nova…" autoFocus />}
          </form.AppField>
        </View>
        <form.AppField name="kind">
          {(field) => <field.Choice label="Type" options={KINDS} />}
        </form.AppField>
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
      <form.AppForm>
        <form.FormError />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          <Button small kind="ghost" label="Annuler" onPress={onCancel} />
          <form.SubmitButton small kind="venue" label="Ajouter au catalogue" />
        </View>
      </form.AppForm>
    </Inset>
  )
}
