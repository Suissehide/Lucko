import type { DisputeResultInput, ResultDecisionInput, SubmitResultInput } from '@lucko/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { RESULTS } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { queryClient, unwrap } from '@/lib/queryClient'

// * QUERIES

/** Résultat d'une room classée, avec les présents et ce que je peux faire. */
export const useRoomResultQuery = (roomId: string) =>
  useQuery({
    queryKey: [RESULTS.ROOM, roomId],
    queryFn: () => unwrap(api.GET('/rooms/{id}/result', { params: { path: { id: roomId } } })),
  })

/** Contestations à trancher : celles d'un lieu partenaire, ou toutes (admin) sans `venueId`. */
export const useResultDisputesQuery = (venueId?: string) =>
  useQuery({
    queryKey: venueId ? [RESULTS.VENUE_DISPUTES, venueId] : [RESULTS.ADMIN_DISPUTES],
    queryFn: () =>
      unwrap(
        venueId
          ? api.GET('/venues/{venueId}/results/disputes', { params: { path: { venueId } } })
          : api.GET('/admin/results/disputes'),
      ),
  })

// * MUTATIONS

/** Saisir, confirmer ou contester : ApiError 409 avec le motif. */
export function useResultMutations(roomId: string) {
  const path = { params: { path: { id: roomId } } }
  const onSuccess = (result: unknown) => queryClient.setQueryData([RESULTS.ROOM, roomId], result)
  return {
    submit: useMutation({
      mutationKey: [RESULTS.SUBMIT, roomId],
      mutationFn: (body: SubmitResultInput) =>
        unwrap(api.POST('/rooms/{id}/result', { ...path, body })),
      onSuccess,
    }),
    confirm: useMutation({
      mutationKey: [RESULTS.CONFIRM, roomId],
      mutationFn: () => unwrap(api.POST('/rooms/{id}/result/confirm', path)),
      onSuccess,
    }),
    dispute: useMutation({
      mutationKey: [RESULTS.DISPUTE, roomId],
      mutationFn: (body: DisputeResultInput) =>
        unwrap(api.POST('/rooms/{id}/result/dispute', { ...path, body })),
      onSuccess,
    }),
  }
}

/** Trancher une contestation : par le staff du lieu (`venueId`) ou un admin. */
export const useDecideResultMutation = (venueId?: string) =>
  useMutation({
    mutationKey: [RESULTS.DECIDE, venueId],
    mutationFn: ({ roomId, ...body }: ResultDecisionInput & { roomId: string }) =>
      unwrap(
        venueId
          ? api.POST('/venues/{venueId}/results/{roomId}/decision', {
              params: { path: { venueId, roomId } },
              body,
            })
          : api.POST('/admin/results/{id}/decision', { params: { path: { id: roomId } }, body }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: venueId ? [RESULTS.VENUE_DISPUTES, venueId] : [RESULTS.ADMIN_DISPUTES],
      }),
  })
