import {
  Button,
  Chip,
  type Column,
  colors,
  DataTable,
  EmptyState,
  TextField,
  Typography,
} from '@lucko/design-system'
import { type AdminWaitlistEntry, WAITLIST_NO_CITY, type WaitlistPeriod } from '@lucko/shared'
import { Download, MailX, Search } from 'lucide-react-native'
import { useState } from 'react'
import { Platform, useWindowDimensions, View } from 'react-native'
import { dateTime, WAITLIST_PERIOD_FILTERS, waitlistCsv } from '@/lib/admin'
import { useAdminWaitlistQuery } from '@/queries/useAdminWaitlist'
import { AdminScreen } from './AdminScreen'

const NARROW = 768
/** Villes proposées en filtre : les plus représentées, la ville choisie reste affichée. */
const CITY_CHIPS = 12

const columns: Column<AdminWaitlistEntry>[] = [
  {
    key: 'email',
    label: 'E-mail',
    flex: 2,
    render: (e) => (
      <Typography variant="small" weight={700} numberOfLines={1} style={{ color: colors.ink }}>
        {e.email}
      </Typography>
    ),
  },
  {
    key: 'city',
    label: 'Ville',
    flex: 1,
    render: (e) => (
      <Typography
        variant="small"
        numberOfLines={1}
        style={{ color: e.city ? colors.ink : colors.inkMuted }}
      >
        {e.city || 'Non renseignée'}
      </Typography>
    ),
  },
  {
    key: 'createdAt',
    label: 'Inscrit',
    width: 150,
    render: (e) => (
      <Typography variant="number" weight={400} style={{ fontSize: 12 }}>
        {dateTime(e.createdAt)}
      </Typography>
    ),
  },
]

/** Télécharge le CSV (web uniquement : le back-office s'utilise sur ordinateur). */
function downloadCsv(entries: AdminWaitlistEntry[]) {
  const blob = new Blob([`﻿${waitlistCsv(entries)}`], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `lucko-liste-attente-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

/** Liste d'attente de la landing : recherche par e-mail, filtres par ville et période, export CSV. */
export function AdminWaitlist() {
  const narrow = useWindowDimensions().width < NARROW
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [period, setPeriod] = useState<WaitlistPeriod>('all')
  const waitlist = useAdminWaitlistQuery({ q: q.trim(), city, period })
  const data = waitlist.data
  const cities = data?.cities ?? []
  const shownCities = cities.filter(
    (c, i) => i < CITY_CHIPS || (c.city ?? WAITLIST_NO_CITY).toLowerCase() === city.toLowerCase(),
  )
  const truncated = data ? data.matching > data.entries.length : false

  return (
    <AdminScreen
      section="waitlist"
      note={data ? `${data.total} inscrit${data.total > 1 ? 's' : ''}` : undefined}
    >
      <View style={{ gap: 14 }}>
        <TextField
          placeholder="Rechercher un e-mail"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          right={<Search size={18} color={colors.muted} strokeWidth={2.5} />}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {WAITLIST_PERIOD_FILTERS.map((p) => (
            <Chip
              key={p.key}
              label={p.label}
              active={period === p.key}
              onPress={() => setPeriod(p.key)}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Chip
            label="Toutes les villes"
            count={cities.reduce((sum, c) => sum + c.count, 0)}
            active={city === ''}
            onPress={() => setCity('')}
          />
          {shownCities.map((c) => {
            const key = c.city ?? WAITLIST_NO_CITY
            return (
              <Chip
                key={key}
                label={c.city ?? 'Sans ville'}
                count={c.count}
                active={city.toLowerCase() === key.toLowerCase()}
                onPress={() => setCity(key)}
              />
            )
          })}
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="small" style={{ color: colors.muted }}>
            {data
              ? `${data.matching} inscrit${data.matching > 1 ? 's' : ''} pour ces filtres${
                  truncated ? ` (les ${data.entries.length} plus récents affichés)` : ''
                }`
              : ' '}
          </Typography>
          {Platform.OS === 'web' && data?.entries.length ? (
            <Button
              small
              kind="ghost"
              icon={Download}
              label="Exporter en CSV"
              onPress={() => downloadCsv(data.entries)}
            />
          ) : null}
        </View>
        <DataTable
          columns={columns}
          rows={data?.entries ?? []}
          loading={!data}
          mobileCards={narrow}
          primary="email"
          cardKeys={['city', 'createdAt']}
          empty={
            <EmptyState
              dashed
              icon={<MailX size={28} color={colors.ink} strokeWidth={2.5} />}
              title="Aucun inscrit"
              text={
                data?.total
                  ? 'Personne ne correspond à ces filtres.'
                  : 'Les inscriptions du formulaire de lucko.fr apparaîtront ici.'
              }
            />
          }
        />
      </View>
    </AdminScreen>
  )
}
