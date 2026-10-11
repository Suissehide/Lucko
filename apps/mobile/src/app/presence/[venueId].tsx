import {
  Banner,
  colors,
  EmptyState,
  PageTitle,
  Panel,
  SkeletonCard,
  TextField,
} from '@lucko/design-system'
import { formatTime } from '@lucko/shared'
import { useLocalSearchParams } from 'expo-router'
import { UserCheck } from 'lucide-react-native'
import { useState } from 'react'
import { DetailScreen } from '@/components/DetailScreen'
import { AttendanceSheet } from '@/components/rooms/AttendanceSheet'
import { useVenueAttendanceQuery } from '@/queries/useAttendance'
import { useMeQuery } from '@/queries/useMe'

/**
 * Pointage de la soirée par le staff du lieu (LKO-78) : toutes les rooms du soir, recherche par pseudo.
 * Les joueurs déjà scannés au comptoir sont affichés présents ; le lieu fait foi sur l'hôte.
 */
export default function VenueAttendanceScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>()
  const me = useMeQuery({ required: true })
  const venue = me?.venues.find((v) => v.id === venueId)
  const sheets = useVenueAttendanceQuery(venueId)
  const [search, setSearch] = useState('')

  return (
    <DetailScreen title={venue?.name ?? 'Mon lieu'}>
      <PageTitle eyebrow={venue?.name ?? 'Mon lieu'} title="Pointage du soir" />
      <TextField
        placeholder="Rechercher un pseudo"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />
      {sheets.isError ? (
        <Banner
          tone="err"
          message={sheets.error.message}
          action="Réessayer"
          onAction={() => void sheets.refetch()}
        />
      ) : !sheets.data ? (
        <SkeletonCard />
      ) : sheets.data.length === 0 ? (
        <EmptyState
          dashed
          icon={<UserCheck size={28} color={colors.ink} strokeWidth={2.5} />}
          title="Pas de room ce soir"
          text="Les rooms organisées dans ton lieu apparaîtront ici le soir venu."
        />
      ) : (
        sheets.data.map((sheet) => (
          <Panel key={sheet.roomId} title={`${formatTime(sheet.startsAt)} · ${sheet.title}`}>
            <AttendanceSheet sheet={sheet} filter={search} />
          </Panel>
        ))
      )}
    </DetailScreen>
  )
}
