import { Button, Typography } from '@lucko/design-system'
import {
  type AdminEvent,
  adminEventInputSchema,
  EVENT_REPEAT_MAX_WEEKS,
  EVENT_TYPE_LABELS,
  EVENT_TYPES,
  type Game,
  type RegistrationMode,
} from '@lucko/shared'
import { useStore } from '@tanstack/react-form'
import { View } from 'react-native'
import { useAppForm } from '@/hooks/formConfig'
import { eventBody, eventFormValues } from '@/lib/admin'
import { useAdminCatalogMutations } from '@/queries/useAdminCatalog'

const REGISTRATION_OPTIONS: { key: RegistrationMode; label: string }[] = [
  { key: 'IN_APP', label: 'Dans l’app' },
  { key: 'EXTERNAL', label: 'Site externe' },
  { key: 'NONE', label: 'Entrée libre' },
]

/** Champ du schéma → champ du formulaire (le prix est saisi en euros). */
const FIELD_OF: Record<string, string> = { priceCents: 'price' }

/**
 * Événement d'un lieu saisi au back-office (démarrage à froid, LKO-16) : création, éventuellement
 * répétée chaque semaine, ou modification d'une occurrence (`event`).
 */
export function EventForm({
  venueId,
  event,
  games,
  onDone,
}: {
  venueId: string
  event?: AdminEvent
  games: Game[]
  onDone: () => void
}) {
  const { saveEvent } = useAdminCatalogMutations()
  const form = useAppForm({
    defaultValues: eventFormValues(event),
    onSubmit: async ({ value, formApi }) => {
      const body = eventBody(value)
      const parsed = adminEventInputSchema.safeParse(body)
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
        await saveEvent.mutateAsync({ venueId, eventId: event?.id, body })
        onDone()
      } catch (error) {
        formApi.setErrorMap({
          onSubmit: { form: error instanceof Error ? error.message : 'Réessaie.', fields: {} },
        })
      }
    },
  })
  const external = useStore(form.store, (s) => s.values.registrationMode === 'EXTERNAL')
  const row = { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } as const
  const cell = { flexGrow: 1, flexBasis: 140 }

  return (
    <View style={{ gap: 14 }}>
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
        <View style={cell}>
          <form.AppField name="date">
            {(field) => <field.Text label="Date" placeholder="AAAA-MM-JJ" />}
          </form.AppField>
        </View>
        <View style={cell}>
          <form.AppField name="startTime">
            {(field) => <field.Text label="Début" placeholder="19:00" />}
          </form.AppField>
        </View>
        <View style={cell}>
          <form.AppField name="endTime">
            {(field) => <field.Text label="Fin (facultatif)" placeholder="23:30" />}
          </form.AppField>
        </View>
        {event ? null : (
          <View style={cell}>
            <form.AppField name="repeatWeeks">
              {(field) => (
                <field.Text
                  label="Répéter (semaines)"
                  help={`0 à ${EVENT_REPEAT_MAX_WEEKS}, même jour et même heure`}
                  keyboardType="number-pad"
                />
              )}
            </form.AppField>
          </View>
        )}
      </View>
      <form.AppField name="registrationMode">
        {(field) => <field.Choice label="Inscription" options={REGISTRATION_OPTIONS} />}
      </form.AppField>
      {external ? (
        <form.AppField name="externalUrl">
          {(field) => <field.Text label="Lien d’inscription" placeholder="https://…" />}
        </form.AppField>
      ) : null}
      <View style={row}>
        <View style={cell}>
          <form.AppField name="capacity">
            {(field) => <field.Text label="Places" keyboardType="number-pad" />}
          </form.AppField>
        </View>
        <View style={cell}>
          <form.AppField name="price">
            {(field) => <field.Text label="Prix (€)" keyboardType="decimal-pad" />}
          </form.AppField>
        </View>
        <View style={cell}>
          <form.AppField name="minAge">
            {(field) => <field.Text label="Âge minimum" keyboardType="number-pad" />}
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
      <form.AppForm>
        <form.FormError />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button small kind="ghost" label="Annuler" onPress={onDone} />
          <form.SubmitButton small kind="event" label={event ? 'Enregistrer' : 'Créer'} />
        </View>
      </form.AppForm>
    </View>
  )
}
