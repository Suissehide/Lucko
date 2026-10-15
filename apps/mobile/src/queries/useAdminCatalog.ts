import type {
  AdminEventInput,
  CancelEventInput,
  CreateVenueInput,
  UpdateVenueInput,
  VenueStatus,
} from '@lucko/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ADMIN } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { unwrap } from '@/lib/queryClient'

// Back-office (LKO-20) : validation des lieux, événements, fusion des jeux.

// * QUERIES

export const useAdminVenuesQuery = (query: { q: string; status?: VenueStatus }) =>
  useQuery({
    queryKey: [ADMIN.VENUES, query],
    queryFn: () => unwrap(api.GET('/admin/venues', { params: { query } })),
    placeholderData: (previous) => previous,
  })

export const useAdminEventsQuery = (venueId: string) =>
  useQuery({
    queryKey: [ADMIN.EVENTS, venueId],
    queryFn: () =>
      unwrap(api.GET('/admin/venues/{id}/events', { params: { path: { id: venueId } } })),
  })

/** Fiche pré-remplie depuis un lieu OSM choisi dans la recherche ; null tant qu'aucun n'est choisi. */
export const useOsmVenueQuery = (osmId: string | null) => {
  const [type = '', ref = ''] = osmId?.split('/') ?? []
  return useQuery({
    queryKey: [ADMIN.OSM_VENUE, osmId],
    queryFn: () =>
      unwrap(api.GET('/admin/venues/osm/{type}/{ref}', { params: { path: { type, ref } } })),
    enabled: !!osmId,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export const useAdminGamesQuery = () =>
  useQuery({ queryKey: [ADMIN.GAMES], queryFn: () => unwrap(api.GET('/admin/games')) })

// * MUTATIONS

/** Lieux, événements et jeux se voient aussi dans l'app (Explorer, fiches) : tout le cache est rafraîchi. */
export function useAdminCatalogMutations() {
  const client = useQueryClient()
  const onSuccess = () => client.invalidateQueries()

  const createVenue = useMutation({
    mutationKey: [ADMIN.CREATE_VENUE],
    mutationFn: (body: CreateVenueInput) => unwrap(api.POST('/admin/venues', { body })),
    onSuccess,
  })

  const updateVenue = useMutation({
    mutationKey: [ADMIN.UPDATE_VENUE],
    mutationFn: ({ id, ...body }: UpdateVenueInput & { id: string }) =>
      unwrap(api.PATCH('/admin/venues/{id}', { params: { path: { id } }, body })),
    onSuccess,
  })

  /** Création (`venueId`) ou modification d'une occurrence (`eventId`). */
  const saveEvent = useMutation({
    mutationKey: [ADMIN.SAVE_EVENT],
    mutationFn: async ({ venueId, eventId, body: { repeatWeeks, ...body } }: SaveEvent) => {
      if (eventId)
        await unwrap(api.PUT('/admin/events/{id}', { params: { path: { id: eventId } }, body }))
      else
        await unwrap(
          api.POST('/admin/venues/{id}/events', {
            params: { path: { id: venueId } },
            body: { ...body, repeatWeeks },
          }),
        )
    },
    onSuccess,
  })

  const cancelEvent = useMutation({
    mutationKey: [ADMIN.CANCEL_EVENT],
    mutationFn: ({ id, ...body }: CancelEventInput & { id: string }) =>
      unwrap(api.POST('/admin/events/{id}/cancel', { params: { path: { id } }, body })),
    onSuccess,
  })

  const mergeGames = useMutation({
    mutationKey: [ADMIN.MERGE_GAMES],
    mutationFn: ({ id, intoId }: { id: string; intoId: string }) =>
      unwrap(api.POST('/admin/games/{id}/merge', { params: { path: { id } }, body: { intoId } })),
    onSuccess,
  })

  return { createVenue, updateVenue, saveEvent, cancelEvent, mergeGames }
}

type SaveEvent = { venueId: string; eventId?: string; body: AdminEventInput }
