import type { AdminFeedbackQuery, UpdateFeedbackInput } from '@lucko/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ADMIN } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { unwrap } from '@/lib/queryClient'

// Retours utilisateurs dans le back-office (LKO-166).

// * QUERIES

/** Retours filtrés par recherche, statut et catégorie, avec le nombre de retours par statut. */
export const useAdminFeedbackQuery = (query: AdminFeedbackQuery) =>
  useQuery({
    queryKey: [ADMIN.FEEDBACK, query],
    queryFn: () => unwrap(api.GET('/admin/feedback', { params: { query } })),
    placeholderData: (previous) => previous,
  })

// * MUTATIONS

/** Statut ou note changés : la liste et le compteur du tableau de bord sont rafraîchis. */
export function useAdminFeedbackMutations() {
  const client = useQueryClient()
  const update = useMutation({
    mutationKey: [ADMIN.UPDATE_FEEDBACK],
    mutationFn: ({ id, ...body }: UpdateFeedbackInput & { id: string }) =>
      unwrap(api.PATCH('/admin/feedback/{id}', { params: { path: { id } }, body })),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: [ADMIN.FEEDBACK] }),
        client.invalidateQueries({ queryKey: [ADMIN.DASHBOARD] }),
      ]),
  })
  return { update }
}
