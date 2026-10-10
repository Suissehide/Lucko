import { QR_TOKEN_TTL_MS } from '@lucko/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
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
