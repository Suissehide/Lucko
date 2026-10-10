import type { EventCancelInput, EventCreateInput, EventUpdateInput } from '@lucko/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { VENUE_EVENTS } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { unwrap } from '@/lib/queryClient'

// Espace gérant (LKO-61) : événements du lieu, brouillons et annulés compris.

// * QUERIES

export const useVenueEventsQuery = (venueId: string, when: 'upcoming' | 'past') =>
  useQuery({
    queryKey: [VENUE_EVENTS.LIST, venueId, when],
    queryFn: () =>
      unwrap(
        api.GET('/venues/{venueId}/events', {
          params: { path: { venueId }, query: { when } },
        }),
      ),
  })

// * MUTATIONS

/** Les événements se voient aussi côté joueurs (fiche lieu, agenda, accueil) : tout le cache est rafraîchi. */
export function useVenueEventMutations(venueId: string) {
  const client = useQueryClient()
  const onSuccess = () => client.invalidateQueries()

  const create = useMutation({
    mutationKey: [VENUE_EVENTS.CREATE, venueId],
    mutationFn: (body: EventCreateInput) =>
      unwrap(api.POST('/venues/{venueId}/events', { params: { path: { venueId } }, body })),
    onSuccess,
  })

  const update = useMutation({
    mutationKey: [VENUE_EVENTS.UPDATE, venueId],
    mutationFn: ({ id, body }: { id: string; body: EventUpdateInput }) =>
      unwrap(api.PATCH('/events/{id}', { params: { path: { id } }, body })),
    onSuccess,
  })

  const cancel = useMutation({
    mutationKey: [VENUE_EVENTS.CANCEL, venueId],
    mutationFn: ({ id, ...body }: EventCancelInput & { id: string }) =>
      unwrap(api.POST('/events/{id}/cancel', { params: { path: { id } }, body })),
    onSuccess,
  })

  return { create, update, cancel }
}
