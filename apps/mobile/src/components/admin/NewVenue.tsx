import {
  Banner,
  Button,
  colors,
  DataCredit,
  HoursCard,
  ListCard,
  ListRow,
  SourceTag,
  TextField,
  TextLink,
  Typography,
} from '@lucko/design-system'
import { createVenueSchema, DEFAULT_CITY, VENUE_TYPE_LABELS, VENUE_TYPES } from '@lucko/shared'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { useAppForm } from '@/hooks/formConfig'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import {
  draftFromAddress,
  draftFromOsm,
  openAdmin,
  openAdminVenue,
  type VenueDraft,
  venueBody,
} from '@/lib/admin'
import type { AddressSuggestion } from '@/lib/geocode'
import type { PlaceSuggestion } from '@/lib/places'
import { hoursRows } from '@/lib/venue'
import { useAdminCatalogMutations, useOsmVenueQuery } from '@/queries/useAdminCatalog'
import { addressSearchQueryOptions, placeSearchQueryOptions } from '@/queries/useGeocode'
import { AdminScreen } from './AdminScreen'

const CREDITS = {
  osm: { source: '© contributeurs OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
  ban: { source: 'Base Adresse Nationale (IGN)', href: 'https://adresse.data.gouv.fr' },
}

/**
 * Nouveau lieu (LKO-115) : recherche par nom (Photon, OpenStreetMap) ou par adresse (BAN), puis fiche
 * pré-remplie qu'un admin relit et corrige avant de l'enregistrer.
 */
export function NewVenue() {
  const [place, setPlace] = useState<PlaceSuggestion | null>(null)
  const [draft, setDraft] = useState<VenueDraft | null>(null)
  const osmId = place?.osmId ?? null
  const preview = useOsmVenueQuery(draft ? null : osmId)
  const picked = draft ?? (preview.data ? draftFromOsm(preview.data, place?.city ?? '') : null)
  const reset = () => {
    setPlace(null)
    setDraft(null)
  }

  return (
    <AdminScreen
      section="venues"
      title="Nouveau lieu"
      subpage
      note="Cherche le lieu par son nom ou son adresse : la fiche se pré-remplit, tu la relis avant de l’enregistrer."
    >
      <View style={{ width: '100%', maxWidth: 720, gap: 16 }}>
        {picked ? (
          <>
            {preview.data?.duplicate ? (
              <Banner
                tone="warn"
                message={`« ${preview.data.duplicate.name} » existe déjà à cet endroit.`}
                action="Voir la fiche"
                onAction={() => openAdminVenue(preview.data?.duplicate?.id ?? '')}
              />
            ) : null}
            <VenueForm key={osmId ?? picked.values.address} draft={picked} onBack={reset} />
          </>
        ) : osmId ? (
          preview.isError ? (
            <Banner
              tone="err"
              message={preview.error.message}
              action="Réessayer"
              onAction={() => void preview.refetch()}
            />
          ) : (
            <Typography variant="small">Lecture de la fiche OpenStreetMap…</Typography>
          )
        ) : (
          <PlaceSearch onPlace={setPlace} onAddress={(a) => setDraft(draftFromAddress(a))} />
        )}
      </View>
    </AdminScreen>
  )
}

function PlaceSearch({
  onPlace,
  onAddress,
}: {
  onPlace: (place: PlaceSuggestion) => void
  onAddress: (address: AddressSuggestion) => void
}) {
  const [q, setQ] = useState('')
  const query = useDebouncedValue(q)
  const places = useQuery(placeSearchQueryOptions(query))
  const addresses = useQuery(addressSearchQueryOptions(query, DEFAULT_CITY))
  const placeList = places.data ?? []
  const addressList = addresses.data ?? []

  return (
    <View style={{ gap: 16 }}>
      <TextField
        label="Nom ou adresse du lieu"
        placeholder="Jeux Descartes, 12 rue des Faures…"
        value={q}
        onChangeText={setQ}
        autoFocus
        right={<Search size={18} color={colors.muted} strokeWidth={2.5} />}
      />
      {places.isFetching ? <Typography variant="small">Recherche des lieux…</Typography> : null}
      {places.isError || addresses.isError ? (
        <Banner tone="err" message="La recherche ne répond pas, réessaie dans un instant." />
      ) : null}
      {placeList.length ? (
        <View style={{ gap: 8 }}>
          <Typography variant="label">Lieux</Typography>
          <ListCard>
            {placeList.map((place, i) => (
              <ListRow
                key={place.osmId}
                inset={14}
                title={place.name}
                subtitle={place.detail}
                onPress={() => onPlace(place)}
                last={i === placeList.length - 1}
              />
            ))}
          </ListCard>
          <DataCredit {...CREDITS.osm} />
        </View>
      ) : null}
      {addressList.length ? (
        <View style={{ gap: 8 }}>
          <Typography variant="label">Adresses (lieu absent de la liste)</Typography>
          <ListCard>
            {addressList.map((address, i) => (
              <ListRow
                key={address.label}
                inset={14}
                title={address.label}
                onPress={() => onAddress(address)}
                last={i === addressList.length - 1}
              />
            ))}
          </ListCard>
        </View>
      ) : null}
      <TextLink label="Retour aux lieux" onPress={() => openAdmin('venues')} />
    </View>
  )
}

function VenueForm({ draft, onBack }: { draft: VenueDraft; onBack: () => void }) {
  const { createVenue } = useAdminCatalogMutations()
  const credit = CREDITS[draft.source]
  // Champs venus de la source : signalés tant que l'admin ne les a pas relus
  const filled = (value: string) => (value ? `Pré-rempli · ${credit.source}` : undefined)
  const form = useAppForm({
    defaultValues: draft.values,
    onSubmit: async ({ value, formApi }) => {
      const body = venueBody(value, draft)
      const parsed = createVenueSchema.safeParse(body)
      if (!parsed.success) {
        const fields: Record<string, string> = {}
        for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message
        formApi.setErrorMap({ onSubmit: { fields } })
        return
      }
      try {
        openAdminVenue((await createVenue.mutateAsync(parsed.data)).id)
      } catch (error) {
        formApi.setErrorMap({
          onSubmit: { form: error instanceof Error ? error.message : 'Réessaie.', fields: {} },
        })
      }
    },
  })
  const row = { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } as const
  const cell = { flexGrow: 1, flexBasis: 200 }
  const { values } = draft

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <SourceTag source={draft.source} />
        <DataCredit {...credit} />
      </View>
      <form.AppField name="name">
        {(field) => <field.Text label="Nom" help={filled(values.name)} />}
      </form.AppField>
      <form.AppField name="type">
        {(field) => (
          <field.Choice
            label="Type"
            options={VENUE_TYPES.map((key) => ({ key, label: VENUE_TYPE_LABELS[key] }))}
          />
        )}
      </form.AppField>
      <View style={row}>
        <View style={cell}>
          <form.AppField name="address">
            {(field) => <field.Text label="Adresse" help={filled(values.address)} />}
          </form.AppField>
        </View>
        <View style={cell}>
          <form.AppField name="city">
            {(field) => <field.Text label="Ville" help={filled(values.city)} />}
          </form.AppField>
        </View>
      </View>
      <View style={row}>
        <View style={cell}>
          <form.AppField name="phone">
            {(field) => (
              <field.Text label="Téléphone" keyboardType="phone-pad" help={filled(values.phone)} />
            )}
          </form.AppField>
        </View>
        <View style={cell}>
          <form.AppField name="website">
            {(field) => (
              <field.Text label="Site" placeholder="https://…" help={filled(values.website)} />
            )}
          </form.AppField>
        </View>
      </View>
      <form.AppField name="acceptsUnaccompaniedMinors">
        {(field) => (
          <field.Switch
            label="Mineurs seuls acceptés"
            description="À refuser pour un bar ou un café qui sert de l’alcool"
          />
        )}
      </form.AppField>
      {draft.openingHours.length ? (
        <View style={{ gap: 8 }}>
          <form.AppField name="keepHours">
            {(field) => <field.Switch label="Reprendre ces horaires" description={credit.source} />}
          </form.AppField>
          <HoursCard plain rows={hoursRows(draft.openingHours)} />
        </View>
      ) : null}
      <form.AppForm>
        <form.FormError />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button small kind="ghost" label="Changer de lieu" onPress={onBack} />
          <form.SubmitButton small kind="venue" label="Valider et publier" />
        </View>
      </form.AppForm>
    </View>
  )
}
