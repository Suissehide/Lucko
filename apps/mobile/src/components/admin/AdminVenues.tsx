import {
  Banner,
  Button,
  colors,
  EmptyState,
  ListCard,
  ListRow,
  Segmented,
  SkeletonCard,
  StatusPill,
  TextField,
} from '@lucko/design-system'
import { VENUE_TYPE_LABELS, type VenueStatus } from '@lucko/shared'
import { MapPinCheck, Plus, Search } from 'lucide-react-native'
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { openNewVenue } from '@/lib/admin'
import { useAdminVenuesQuery } from '@/queries/useAdminCatalog'
import { useAdminDashboardQuery } from '@/queries/useAdminModeration'
import { AdminScreen } from './AdminScreen'
import { VenueDetail } from './VenueDetail'

const TWO_PANELS = 1100

const FILTERS: { label: string; status?: VenueStatus }[] = [
  { label: 'À valider', status: 'PENDING' },
  { label: 'Publiés', status: 'PUBLISHED' },
  { label: 'Tous' },
]

/** Lieux proposés ou importés : liste filtrée à gauche, fiche du lieu choisi à droite. */
export function AdminVenues({ initialId }: { initialId?: string }) {
  const twoPanels = useWindowDimensions().width >= TWO_PANELS
  const [filter, setFilter] = useState(initialId ? 2 : 0)
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState(initialId ?? null)
  const venues = useAdminVenuesQuery({ q: q.trim(), status: FILTERS[filter]?.status })
  const pending = useAdminDashboardQuery().data?.pendingVenues
  const list = venues.data ?? []
  const selected = list.find((v) => v.id === selectedId) ?? list[0]

  return (
    <AdminScreen
      section="venues"
      note="Un lieu proposé ou importé reste caché tant qu’il n’est pas publié."
    >
      <View
        style={{ flexDirection: twoPanels ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}
      >
        <View style={{ width: twoPanels ? 400 : '100%', gap: 12 }}>
          <Button small kind="venue" icon={Plus} label="Ajouter un lieu" onPress={openNewVenue} />
          <Segmented
            items={FILTERS.map((f, i) =>
              i === 0 && pending !== undefined ? `${f.label} (${pending})` : f.label,
            )}
            value={filter}
            onChange={setFilter}
            color={colors.room}
          />
          <TextField
            placeholder="Nom, ville ou adresse"
            value={q}
            onChangeText={setQ}
            right={<Search size={18} color={colors.muted} strokeWidth={2.5} />}
          />
          {venues.isError ? (
            <Banner
              tone="err"
              message="Impossible de charger les lieux."
              action="Réessayer"
              onAction={() => void venues.refetch()}
            />
          ) : !venues.data ? (
            <SkeletonCard />
          ) : list.length === 0 ? (
            <EmptyState
              dashed
              icon={<MapPinCheck size={28} color={colors.ink} strokeWidth={2.5} />}
              title="Aucun lieu"
              text={filter === 0 ? 'Aucun lieu en attente de validation.' : 'Aucun lieu trouvé.'}
            />
          ) : (
            <ListCard>
              {list.map((venue, i) => (
                <ListRow
                  key={venue.id}
                  inset={14}
                  title={venue.name}
                  subtitle={`${VENUE_TYPE_LABELS[venue.type]} · ${venue.city}`}
                  right={
                    venue.status === 'PENDING' ? (
                      <StatusPill tone="warn" label="À valider" />
                    ) : (
                      <StatusPill tone="ok" label="Publié" />
                    )
                  }
                  selected={venue.id === selected?.id}
                  onPress={() => setSelectedId(venue.id)}
                  last={i === list.length - 1}
                />
              ))}
            </ListCard>
          )}
        </View>
        {selected ? (
          <View style={{ flex: twoPanels ? 1 : undefined, width: twoPanels ? undefined : '100%' }}>
            <VenueDetail key={selected.id} venue={selected} />
          </View>
        ) : null}
      </View>
    </AdminScreen>
  )
}
