import { AgendaEventCard, Button, Note, Typography } from '@lucko/design-system'
import {
  EVENT_MIN_AGE_FLOOR,
  EVENT_TYPE_LABELS,
  EVENT_TYPES,
  eventCreateSchema,
  eventUpdateSchema,
  type Game,
  type RegistrationMode,
} from '@lucko/shared'
import { useStore } from '@tanstack/react-form'
import { View } from 'react-native'
import { useAppForm } from '@/hooks/formConfig'
import { agendaItem } from '@/lib/venue'
import {
  createBody,
  type EditMode,
  managerFormValues,
  previewEvent,
  repeatOptions,
  updateBody,
} from '@/lib/venueEvents'
import { useVenueEventMutations } from '@/queries/useVenueEvents'

const REGISTRATION_OPTIONS: { key: RegistrationMode; label: string }[] = [
  { key: 'IN_APP', label: 'Dans l’app' },
  { key: 'EXTERNAL', label: 'Billetterie externe' },
  { key: 'NONE', label: 'Entrée libre' },
]

/** Champ du schéma → champ du formulaire (prix saisi en euros, récurrence choisie dans une liste). */
const FIELD_OF: Record<string, string> = { priceCents: 'price', recurrence: 'repeat' }

/**
 * Événement publié par le gérant (LKO-61) : création (ponctuelle ou récurrente), copie, ou
 * modification d'une date ou de toute la série, avec l'aperçu tel que les joueurs le verront.
 */
export function ManagerEventForm({
  venueId,
  mode,
  games,
  onDone,
}: {
  venueId: string
  mode: EditMode
  games: Game[]
  onDone: () => void
}) {
  const { create, update } = useVenueEventMutations(venueId)
  const scope = mode.kind === 'edit' ? mode.scope : null
  const form = useAppForm({
    defaultValues: managerFormValues(mode),
    onSubmit: async ({ value, formApi }) => {
      const body = scope ? updateBody(value, scope) : createBody(value)
      const parsed = (scope ? eventUpdateSchema : eventCreateSchema).safeParse(body)
      if (!parsed.success) {
        const fields: Record<string, string> = {}
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0])
          fields[FIELD_OF[key] ?? key] ??= issue.message
        }
        formApi.setErrorMap({ onSubmit: { fields } })
        return
      }
      try {
        if (mode.kind === 'edit')
          await update.mutateAsync({ id: mode.event.id, body: updateBody(value, mode.scope) })
        else await create.mutateAsync(createBody(value))
        onDone()
      } catch (error) {
        formApi.setErrorMap({
          onSubmit: { form: error instanceof Error ? error.message : 'Réessaie.', fields: {} },
        })
      }
    },
  })
  const values = useStore(form.store, (s) => s.values)
  const preview = previewEvent(values, games)
  const item = preview && agendaItem(preview, null)
  const row = { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } as const
  const cell = { flexGrow: 1, flexBasis: 140 }

  return (
    <View style={{ gap: 14 }}>
      {scope === 'series' ? (
        <Note tone="plain">
          Toute la série : les dates à venir changent, sauf celles modifiées à part. Les inscrits
          sont prévenus d’un changement d’horaire.
        </Note>
      ) : scope === 'occurrence' && mode.kind === 'edit' && mode.event.series ? (
        <Note tone="plain">Cette date seulement : la série ne la modifiera plus.</Note>
      ) : null}
      <form.AppField name="type">
        {(field) => (
          <field.Choice
            label="Type"
            options={EVENT_TYPES.map((key) => ({ key, label: EVENT_TYPE_LABELS[key] }))}
          />
        )}
      </form.AppField>
      <form.AppField name="title">
        {(field) => <field.Text label="Titre" placeholder="Soirée Commander" />}
      </form.AppField>
      <View style={row}>
        {scope === 'series' ? null : (
          <View style={cell}>
            <form.AppField name="date">
              {(field) => (
                <field.Text
                  label={values.repeat === 'NONE' ? 'Date' : 'Première date'}
                  placeholder="2026-10-24"
                />
              )}
            </form.AppField>
          </View>
        )}
        <View style={cell}>
          <form.AppField name="startTime">
            {(field) => <field.Text label="Début" placeholder="19:00" />}
          </form.AppField>
        </View>
        <View style={cell}>
          <form.AppField name="endTime">
            {(field) => (
              <field.Text
                label="Fin (facultatif)"
                placeholder="23:30"
                help="Avant le début : le lendemain"
              />
            )}
          </form.AppField>
        </View>
      </View>
      {scope ? null : (
        <form.AppField name="repeat">
          {(field) => <field.Choice label="Répétition" options={repeatOptions(values.date)} />}
        </form.AppField>
      )}
      {values.repeat !== 'NONE' && scope !== 'occurrence' ? (
        <form.AppField name="untilDate">
          {(field) => (
            <field.Text
              label="Jusqu’au (facultatif)"
              placeholder="2027-06-30"
              help="Sans date de fin, les dates sont publiées 3 mois à l’avance"
            />
          )}
        </form.AppField>
      ) : null}
      <form.AppField name="registrationMode">
        {(field) => <field.Choice label="Inscription" options={REGISTRATION_OPTIONS} />}
      </form.AppField>
      {values.registrationMode === 'EXTERNAL' ? (
        <form.AppField name="externalUrl">
          {(field) => (
            <field.Text
              label="Lien de la billetterie"
              placeholder="https://www.helloasso.com/…"
              help="EventLink, HelloAsso, Weezevent… Les joueurs s’inscrivent là-bas."
            />
          )}
        </form.AppField>
      ) : null}
      <View style={row}>
        {values.registrationMode === 'IN_APP' ? (
          <View style={cell}>
            <form.AppField name="capacity">
              {(field) => <field.Text label="Places" keyboardType="number-pad" />}
            </form.AppField>
          </View>
        ) : null}
        <View style={cell}>
          <form.AppField name="price">
            {(field) => <field.Text label="Prix (€)" keyboardType="decimal-pad" />}
          </form.AppField>
        </View>
        <View style={cell}>
          <form.AppField name="minAge">
            {(field) => (
              <field.Text
                label="Âge minimum"
                keyboardType="number-pad"
                help={`${EVENT_MIN_AGE_FLOOR} ans ou plus ; vide = tous`}
              />
            )}
          </form.AppField>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Typography variant="label">Jeux (aucun = tous jeux)</Typography>
        <form.AppField name="gameIds">
          {(field) => (
            <field.MultiChoice compact options={games.map((g) => ({ key: g.id, label: g.name }))} />
          )}
        </form.AppField>
      </View>
      <form.AppField name="description">
        {(field) => <field.Text label="Description" multiline maxLength={2000} />}
      </form.AppField>
      <form.AppField name="draft">
        {(field) => (
          <field.Switch
            label="Brouillon"
            description="Visible de ton lieu seulement, jusqu’à la publication"
          />
        )}
      </form.AppField>

      {item ? (
        <View style={{ gap: 8 }}>
          <Typography variant="label">Aperçu dans l’agenda du lieu</Typography>
          <AgendaEventCard {...item} action={undefined} />
        </View>
      ) : null}

      <form.AppForm>
        <form.FormError />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button small kind="ghost" label="Annuler" onPress={onDone} />
          <form.SubmitButton
            small
            kind="event"
            label={
              mode.kind === 'edit'
                ? 'Enregistrer'
                : values.draft
                  ? 'Enregistrer le brouillon'
                  : 'Publier'
            }
          />
        </View>
      </form.AppForm>
    </View>
  )
}
