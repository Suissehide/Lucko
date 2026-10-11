import { useMutation, useQuery } from '@tanstack/react-query'
import { BILLING } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { queryClient, unwrap } from '@/lib/queryClient'

// * QUERIES

/** Venues facturables du mois (« 2026-10 ») et total prévisionnel, pour le gérant. */
export const useVenueVisitsQuery = (venueId: string, month: string) =>
  useQuery({
    queryKey: [BILLING.VISITS, venueId, month],
    queryFn: () =>
      unwrap(
        api.GET('/venues/{venueId}/visits', { params: { path: { venueId }, query: { month } } }),
      ),
  })

// * MUTATIONS

/** Contester une venue : ApiError 409 avec le motif (délai dépassé, déjà contestée). */
export const useDisputeVisitMutation = (venueId: string) =>
  useMutation({
    mutationKey: [BILLING.DISPUTE, venueId],
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      unwrap(
        api.POST('/venues/{venueId}/visits/{id}/dispute', {
          params: { path: { venueId, id } },
          body: { reason },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [BILLING.VISITS, venueId] }),
  })
