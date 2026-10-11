import { Banner, PageTitle, SkeletonCard } from '@lucko/design-system'
import { formatTime } from '@lucko/shared'
import { useLocalSearchParams } from 'expo-router'
import { DetailScreen } from '@/components/DetailScreen'
import { AttendanceSheet } from '@/components/rooms/AttendanceSheet'
import { useRoomAttendanceQuery } from '@/queries/useAttendance'
import { useMeQuery } from '@/queries/useMe'

/** Pointage des présents d'une room par son hôte (LKO-78), ouvert aussi par le rappel de fin de partie. */
export default function RoomAttendanceScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  useMeQuery({ required: true })
  const sheet = useRoomAttendanceQuery(roomId)

  return (
    <DetailScreen title="Pointer les présents">
      <PageTitle
        eyebrow={sheet.data ? `${sheet.data.title} · ${formatTime(sheet.data.startsAt)}` : 'Room'}
        title="Qui était là ?"
      />
      {sheet.isError ? (
        <Banner
          tone="err"
          message={sheet.error.message}
          action="Réessayer"
          onAction={() => void sheet.refetch()}
        />
      ) : !sheet.data ? (
        <SkeletonCard />
      ) : (
        <AttendanceSheet sheet={sheet.data} />
      )}
    </DetailScreen>
  )
}
