import type { AttendanceEntry } from '@lucko/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ATTENDANCE } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { queryClient, unwrap } from '@/lib/queryClient'

// * QUERIES

/** Feuille de pointage d'une room (hôte ou staff du lieu). */
export const useRoomAttendanceQuery = (roomId: string) =>
  useQuery({
    queryKey: [ATTENDANCE.ROOM, roomId],
    queryFn: () => unwrap(api.GET('/rooms/{id}/attendance', { params: { path: { id: roomId } } })),
  })

/** Rooms de la soirée en cours dans le lieu, pour le staff. */
export const useVenueAttendanceQuery = (venueId: string) =>
  useQuery({
    queryKey: [ATTENDANCE.VENUE, venueId],
    queryFn: () =>
      unwrap(api.GET('/venues/{venueId}/attendance', { params: { path: { venueId }, query: {} } })),
  })

// * MUTATIONS

/** Pointer des joueurs : ApiError 409 avec le motif hors de la fenêtre de pointage. */
export const useMarkAttendanceMutation = (roomId: string) =>
  useMutation({
    mutationKey: [ATTENDANCE.MARK, roomId],
    mutationFn: (entries: AttendanceEntry[]) =>
      unwrap(
        api.PUT('/rooms/{id}/attendance', { params: { path: { id: roomId } }, body: { entries } }),
      ),
    onSuccess: (sheet) => {
      queryClient.setQueryData([ATTENDANCE.ROOM, roomId], sheet)
      return queryClient.invalidateQueries({ queryKey: [ATTENDANCE.VENUE] })
    },
  })
