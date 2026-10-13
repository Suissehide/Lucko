import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PARENTAL_CONSENT } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { unwrap } from '@/lib/queryClient'
import { meQueryOptions } from '@/queries/useMe'

/** L'accord arrive pendant que l'enfant attend sur l'écran : vérifié toutes les 15 s. */
const WAIT_POLL_MS = 15_000

// * QUERIES

/** Accord de mon parent (13-14 ans, LKO-49). */
export const useMyParentalConsentQuery = () =>
  useQuery({
    queryKey: [PARENTAL_CONSENT.MINE],
    queryFn: () => unwrap(api.GET('/me/parental-consent')),
    refetchInterval: (query) => (query.state.data?.granted ? false : WAIT_POLL_MS),
  })

/** Demande vue par le parent depuis le lien de l'e-mail. ApiError 404 : lien plus valable. */
export const useParentalConsentRequestQuery = (token: string) =>
  useQuery({
    queryKey: [PARENTAL_CONSENT.GET, token],
    queryFn: () => unwrap(api.GET('/parental-consents/{token}', { params: { path: { token } } })),
    retry: false,
  })

// * MUTATIONS

/** Envoie ou renvoie l'e-mail au parent. ApiError 400 : c'est l'e-mail de l'enfant. */
export function useRequestParentalConsentMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationKey: [PARENTAL_CONSENT.REQUEST],
    mutationFn: (parentEmail: string) =>
      unwrap(api.POST('/me/parental-consent', { body: { parentEmail } })),
    onSuccess: (consent) => client.setQueryData([PARENTAL_CONSENT.MINE], consent),
  })
}

/** Accord du parent connecté. ApiError 403 : pas majeur, ou c'est l'enfant ; 409 : autre parent. */
export function useGrantParentalConsentMutation(token: string) {
  const client = useQueryClient()
  return useMutation({
    mutationKey: [PARENTAL_CONSENT.GRANT, token],
    mutationFn: () =>
      unwrap(api.POST('/parental-consents/{token}', { params: { path: { token } } })),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [PARENTAL_CONSENT.GET, token] })
      void client.invalidateQueries({ queryKey: meQueryOptions.queryKey })
    },
  })
}
