import {
  Chip,
  type Column,
  colors,
  DataTable,
  EmptyState,
  PersonCell,
  TextField,
  Typography,
} from '@lucko/design-system'
import type { AdminUser, AdminUserFilter } from '@lucko/shared'
import { Search, SearchX } from 'lucide-react-native'
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { dayMonth, ROLE_LABELS, USER_FILTERS } from '@/lib/admin'
import { useAdminUsersQuery } from '@/queries/useAdminModeration'
import { AdminScreen } from './AdminScreen'
import { UserPanel } from './UserPanel'
import { UserStatus } from './UserStatus'

const NARROW = 768
const TWO_PANELS = 1100

const person: Column<AdminUser> = {
  key: 'pseudo',
  label: 'Joueur',
  flex: 2,
  render: (u) => (
    <PersonCell name={u.pseudo ?? 'Sans pseudo'} subtitle={u.email} muted={!u.pseudo} />
  ),
}
const reports: Column<AdminUser> = {
  key: 'openReports',
  label: 'Signal.',
  width: 60,
  align: 'right',
  render: (u) => (
    <Typography variant="number" style={{ color: u.openReports ? colors.room : colors.inkMuted }}>
      {u.openReports}
    </Typography>
  ),
}
const status: Column<AdminUser> = {
  key: 'status',
  label: 'Statut',
  // « Suspendu jusqu'au 13 nov. » tient sur deux lignes au plus à 1024 px
  flex: 1.7,
  render: (u) => <UserStatus user={u} />,
}
const columns: Column<AdminUser>[] = [
  person,
  {
    key: 'role',
    label: 'Rôle',
    width: 110,
    render: (u) => (
      <Typography variant="small" weight={700} style={{ color: colors.ink }}>
        {ROLE_LABELS[u.role]}
      </Typography>
    ),
  },
  {
    key: 'createdAt',
    label: 'Inscrit',
    width: 90,
    render: (u) => (
      <Typography variant="number" weight={400} style={{ fontSize: 12 }}>
        {dayMonth(u.createdAt)}
      </Typography>
    ),
  },
  reports,
  status,
]

/** Joueurs : recherche, filtres, tableau ; la fiche s'ouvre dans un panneau sans quitter la liste. */
export function AdminUsers({ initialId }: { initialId?: string }) {
  const width = useWindowDimensions().width
  const narrow = width < NARROW
  const twoPanels = width >= TWO_PANELS
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<AdminUserFilter>('all')
  const [openId, setOpenId] = useState(initialId ?? null)
  const users = useAdminUsersQuery({ q: q.trim(), filter })
  const panel = openId ? (
    <UserPanel key={openId} id={openId} onClose={() => setOpenId(null)} />
  ) : null

  return (
    <AdminScreen section="users" note={users.data ? `${users.data.counts.all} comptes` : undefined}>
      {panel && !twoPanels ? panel : null}
      <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
          <TextField
            placeholder="Pseudo, e-mail ou id"
            value={q}
            onChangeText={setQ}
            autoCapitalize="none"
            right={<Search size={18} color={colors.muted} strokeWidth={2.5} />}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {USER_FILTERS.map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                count={users.data?.counts[f.key]}
                active={filter === f.key}
                onPress={() => setFilter(f.key)}
              />
            ))}
          </View>
          <DataTable
            columns={panel && twoPanels ? [person, reports, status] : columns}
            rows={users.data?.users ?? []}
            loading={!users.data}
            selected={openId ? [openId] : []}
            onRowPress={(u) => setOpenId(u.id)}
            mobileCards={narrow}
            primary="pseudo"
            cardKeys={['openReports']}
            statusKey="status"
            empty={
              <EmptyState
                dashed
                icon={<SearchX size={28} color={colors.ink} strokeWidth={2.5} />}
                title="Aucun joueur"
                text="Personne ne correspond à cette recherche."
              />
            }
          />
        </View>
        {panel && twoPanels ? <View style={{ width: 360 }}>{panel}</View> : null}
      </View>
    </AdminScreen>
  )
}
