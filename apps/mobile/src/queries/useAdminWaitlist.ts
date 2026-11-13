import type { AdminWaitlistQuery } from '@lucko/shared'
import { useQuery } from '@tanstack/react-query'
import { ADMIN } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { unwrap } from '@/lib/queryClient'

// Liste d'attente de la landing (lucko.fr) : lecture seule.

// * QUERIES

/** Inscrits filtrés par e-mail, ville et période, avec le nombre d'inscrits par ville. */
export const useAdminWaitlistQuery = (query: AdminWaitlistQuery) =>
  useQuery({
    queryKey: [ADMIN.WAITLIST, query],
    queryFn: () => unwrap(api.GET('/admin/waitlist', { params: { query } })),
    placeholderData: (previous) => previous,
  })
