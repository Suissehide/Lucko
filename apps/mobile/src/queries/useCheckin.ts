import { QR_TOKEN_TTL_MS } from '@lucko/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CHECKIN } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { unwrap } from '@/lib/queryClient'

/** Marge avant l'expiration du jeton pour en demander un nouveau. */
const REFRESH_MARGIN_MS = 10_000

// * QUERIES

/**
 * Jeton du QR Lucko (LKO-77), renouvelé toutes les ~50 s tant que l'écran est ouvert.
 * Jamais gardé en cache : hors connexion, pas de QR (archi §10).
 */
export const useQrTokenQuery = () =>
  useQuery({
    queryKey: [CHECKIN.QR_TOKEN],
    queryFn: () => unwrap(api.POST('/me/qr-token')),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: QR_TOKEN_TTL_MS - REFRESH_MARGIN_MS,
  })

/** Avantage Lucko du lieu partenaire, pour son gérant (LKO-92). */
export const useVenuePerkQuery = (venueId: string) =>
  useQuery({
    queryKey: [CHECKIN.PERK, venueId],
    queryFn: () => unwrap(api.GET('/venues/{venueId}/perk', { params: { path: { venueId } } })),
  })

// * MUTATIONS

/** Scan au comptoir par le staff du lieu. */
export const useScanMutation = (venueId: string) =>
  useMutation({
    mutationKey: [CHECKIN.SCAN, venueId],
    mutationFn: (token: string) =>
      unwrap(
        api.POST('/venues/{venueId}/scan', { params: { path: { venueId } }, body: { token } }),
      ),
  })

/** Change l'avantage Lucko ; vide = aucun avantage. */
export function useSetVenuePerkMutation(venueId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationKey: [CHECKIN.SET_PERK, venueId],
    mutationFn: (luckoPerk: string) =>
      unwrap(
        api.PUT('/venues/{venueId}/perk', {
          params: { path: { venueId } },
          body: { luckoPerk },
        }),
      ),
    onSuccess: (perk) => client.setQueryData([CHECKIN.PERK, venueId], perk),
  })
}
