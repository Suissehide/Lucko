import type { CreateRoomInput, HostAction, RoomDetail } from '@lucko/shared'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AGENDA, CHAT, EXPLORE, ROOM, VENUE } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { queryClient, unwrap } from '@/lib/queryClient'
import { useRealtime } from '@/lib/realtime'

// * QUERIES

export const roomQueryOptions = (id: string) =>
  queryOptions({
    queryKey: [ROOM.GET, id],
    queryFn: () => unwrap(api.GET('/rooms/{id}', { params: { path: { id } } })),
  })

/**
 * Adresse d'une room à domicile (LKO-71) : l'app ne la demande qu'à l'hôte et aux acceptés, à partir de
 * `revealAt`. Oubliée dès que l'écran se ferme.
 */
export const roomAddressQueryOptions = (id: string) =>
  queryOptions({
    queryKey: [ROOM.ADDRESS, id],
    queryFn: () => unwrap(api.GET('/rooms/{id}/address', { params: { path: { id } } })),
    gcTime: 0,
  })

/**
 * Fiche room. Pour l'hôte et les joueurs inscrits (acceptés, en attente, liste d'attente), rechargée en direct
 * quand elle change (places restantes, candidatures, statut).
 */
export function useRoomQuery(id: string) {
  const options = roomQueryOptions(id)
  const query = useQuery(options)
  const room = query.data
  const member =
    room?.isHost === true ||
    room?.myStatus === 'ACCEPTED' ||
    room?.myStatus === 'PENDING' ||
    room?.myStatus === 'WAITLISTED'
  useRealtime({ type: 'room', id }, options.queryKey, member)
  return query
}

/** Une room change : Mes parties, l'accueil, la fiche du lieu (places restantes) et Messages (LKO-132) aussi. */
const refreshLists = () =>
  Promise.all(
    [AGENDA.GET, EXPLORE.TONIGHT, VENUE.GET, CHAT.LIST].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  )

// * MUTATIONS

export function useRoomMutations() {
  /** POST /rooms : ApiError 400 avec le motif (lieu fermé, format, mineurs…). */
  const createRoom = useMutation({
    mutationKey: [ROOM.CREATE],
    mutationFn: (body: CreateRoomInput) => unwrap(api.POST('/rooms', { body })),
    onSuccess: refreshLists,
  })

  return { createRoom }
}

/** Demander à rejoindre, quitter ; pour l'hôte, accepter ou refuser une demande (ApiError 409 avec le motif). */
export function useParticipationMutations(id: string) {
  const client = useQueryClient()
  const path = { params: { path: { id } } }
  // La fiche prend la réponse de l'API
  const onSuccess = (room: RoomDetail) => {
    client.setQueryData(roomQueryOptions(id).queryKey, room)
    void refreshLists()
  }

  const join = useMutation({
    mutationKey: [ROOM.JOIN, id],
    mutationFn: () => unwrap(api.POST('/rooms/{id}/participation', path)),
    onSuccess,
  })

  const leave = useMutation({
    mutationKey: [ROOM.LEAVE, id],
    mutationFn: () => unwrap(api.DELETE('/rooms/{id}/participation', path)),
    onSuccess,
  })

  const decide = useMutation({
    mutationKey: [ROOM.DECIDE, id],
    mutationFn: ({ userId, accept }: { userId: string; accept: boolean }) => {
      const params = { params: { path: { id, userId } } }
      return unwrap(
        accept
          ? api.POST('/rooms/{id}/candidates/{userId}/accept', params)
          : api.POST('/rooms/{id}/candidates/{userId}/decline', params),
      )
    },
    onSuccess,
  })

  /** Hôte : retirer, transférer, fermer / rouvrir les inscriptions, annuler (ApiError 409 avec le motif). */
  const hostAction = useMutation({
    mutationKey: [ROOM.HOST_ACTION, id],
    mutationFn: (body: HostAction) =>
      unwrap(api.POST('/rooms/{id}/host-action', { ...path, body })),
    onSuccess,
  })

  return { join, leave, decide, hostAction }
}
