import type {
  AdminReasonInput,
  AdminUserFilter,
  ResolveReportInput,
  SuspendInput,
} from '@lucko/shared'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ADMIN } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { unwrap } from '@/lib/queryClient'

// Back-office (LKO-20) : tableau de bord, journal, signalements, joueurs, photos de profil.

// * QUERIES

export const adminDashboardQueryOptions = queryOptions({
  queryKey: [ADMIN.DASHBOARD],
  queryFn: () => unwrap(api.GET('/admin/dashboard')),
})

export const useAdminDashboardQuery = () => useQuery(adminDashboardQueryOptions)

export const useAdminActionsQuery = () =>
  useQuery({ queryKey: [ADMIN.ACTIONS], queryFn: () => unwrap(api.GET('/admin/actions')) })

/** File des signalements ouverts, mineurs en tête. */
export const useAdminReportsQuery = () =>
  useQuery({ queryKey: [ADMIN.REPORTS], queryFn: () => unwrap(api.GET('/admin/reports')) })

/** Recherche par pseudo, e-mail ou id (vide : derniers inscrits), avec le nombre de comptes par filtre. */
export const useAdminUsersQuery = (query: { q: string; filter: AdminUserFilter }) =>
  useQuery({
    queryKey: [ADMIN.USERS, query],
    queryFn: () => unwrap(api.GET('/admin/users', { params: { query } })),
    placeholderData: (previous) => previous,
  })

export const useAdminUserQuery = (id: string) =>
  useQuery({
    queryKey: [ADMIN.USER, id],
    queryFn: () => unwrap(api.GET('/admin/users/{id}', { params: { path: { id } } })),
  })

export const useAdminAvatarsQuery = () =>
  useQuery({ queryKey: [ADMIN.AVATARS], queryFn: () => unwrap(api.GET('/admin/avatars')) })

// * MUTATIONS

/** Une action d'admin change les compteurs, les files et les fiches : tout le cache est rafraîchi. */
export function useAdminModerationMutations() {
  const client = useQueryClient()
  const onSuccess = () => client.invalidateQueries()

  const resolveReport = useMutation({
    mutationKey: [ADMIN.RESOLVE_REPORT],
    mutationFn: ({ id, ...body }: ResolveReportInput & { id: string }) =>
      unwrap(api.POST('/admin/reports/{id}/resolve', { params: { path: { id } }, body })),
    onSuccess,
  })

  const suspend = useMutation({
    mutationKey: [ADMIN.SUSPEND],
    mutationFn: ({ id, ...body }: SuspendInput & { id: string }) =>
      unwrap(api.POST('/admin/users/{id}/suspend', { params: { path: { id } }, body })),
    onSuccess,
  })

  const unsuspend = useMutation({
    mutationKey: [ADMIN.UNSUSPEND],
    mutationFn: ({ id, ...body }: AdminReasonInput & { id: string }) =>
      unwrap(api.POST('/admin/users/{id}/unsuspend', { params: { path: { id } }, body })),
    onSuccess,
  })

  const approveAvatar = useMutation({
    mutationKey: [ADMIN.REVIEW_AVATAR, 'approve'],
    mutationFn: (id: string) =>
      unwrap(api.POST('/admin/avatars/{id}/approve', { params: { path: { id } } })),
    onSuccess,
  })

  const rejectAvatar = useMutation({
    mutationKey: [ADMIN.REVIEW_AVATAR, 'reject'],
    mutationFn: ({ id, ...body }: AdminReasonInput & { id: string }) =>
      unwrap(api.POST('/admin/avatars/{id}/reject', { params: { path: { id } }, body })),
    onSuccess,
  })

  /** Masquer un événement signalé (LKO-153) : il disparaît de l'app, les inscrits sont prévenus. */
  const hideEvent = useMutation({
    mutationKey: [ADMIN.HIDE_EVENT],
    mutationFn: ({ id, reason }: AdminReasonInput & { id: string }) =>
      unwrap(
        api.POST('/admin/events/{id}/hide', {
          params: { path: { id } },
          body: { reason, series: false },
        }),
      ),
    onSuccess,
  })

  return { resolveReport, suspend, unsuspend, approveAvatar, rejectAvatar, hideEvent }
}
