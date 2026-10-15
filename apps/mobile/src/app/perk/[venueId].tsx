import { Banner, Note, SkeletonCard, Typography } from '@lucko/design-system'
import { useLocalSearchParams } from 'expo-router'
import { DetailScreen } from '@/components/DetailScreen'
import { useAppForm } from '@/hooks/formConfig'
import { useSetVenuePerkMutation, useVenuePerkQuery } from '@/queries/useCheckin'
import { useMeQuery } from '@/queries/useMe'

/**
 * Avantage Lucko d'un lieu partenaire (LKO-92), saisi par son gérant : montré sur la fiche du lieu et
 * au staff à chaque scan du QR Lucko, une fois par joueur et par soirée.
 */
export default function VenuePerkScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>()
  const me = useMeQuery({ required: true })
  const venue = me?.venues.find((v) => v.id === venueId)
  const perk = useVenuePerkQuery(venueId)

  return (
    <DetailScreen title="Avantage Lucko">
      <Typography variant="h1">Avantage Lucko</Typography>
      {venue ? <Typography variant="small">{venue.name}</Typography> : null}
      {perk.isError ? (
        <Banner tone="err" message={perk.error.message} />
      ) : perk.data ? (
        <PerkForm venueId={venueId} initial={perk.data.luckoPerk ?? ''} />
      ) : (
        <SkeletonCard />
      )}
    </DetailScreen>
  )
}

function PerkForm({ venueId, initial }: { venueId: string; initial: string }) {
  const save = useSetVenuePerkMutation(venueId)
  const form = useAppForm({
    defaultValues: { perk: initial },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value.perk).catch(() => undefined)
    },
  })

  return (
    <>
      <Typography>
        Offert aux joueurs venus avec Lucko : il s’affiche sur la fiche du lieu, et au comptoir
        quand tu scannes leur QR Lucko, une fois par joueur et par soirée.
      </Typography>
      <form.AppField
        name="perk"
        validators={{
          onSubmit: ({ value }) =>
            value.trim().length > 120 ? '120 caractères maximum' : undefined,
        }}
      >
        {(field) => (
          <field.Text
            label="Avantage"
            placeholder="-10 % sur les boosters"
            help="Laisse vide pour ne rien proposer."
            returnKeyType="done"
            onSubmitEditing={() => void form.handleSubmit()}
          />
        )}
      </form.AppField>
      {save.isSuccess ? <Banner tone="ok" message="Avantage enregistré." /> : null}
      {save.isError ? <Banner tone="err" message={save.error.message} /> : null}
      <form.AppForm>
        <form.SubmitButton label="Enregistrer" />
      </form.AppForm>
      <Note>Un mineur ne reçoit pas d’avantage sur l’alcool : le scan le signale au staff.</Note>
    </>
  )
}
