import { HOME_SAFETY_VERSION, type UpdateProfileInput } from '@lucko/shared'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { ME } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { authClient } from '@/lib/auth'
import { forgetPush } from '@/lib/push'
import { ApiError, queryClient, unwrap } from '@/lib/queryClient'
import { disconnectRealtime } from '@/lib/realtime'

// * QUERIES

/** null sans session : un 401 est une réponse, pas une erreur (sinon chaque écran relançait /me en boucle, LKO-126). */
export const meQueryOptions = queryOptions({
  queryKey: [ME.GET],
  queryFn: () =>
    unwrap(api.GET('/me')).catch((error) => {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }),
})

/**
 * Joueur connecté (gardé entre deux lancements, voir lib/queryClient.ts) ; null s'il n'est pas connu.
 * `required` : écran réservé aux joueurs connectés, renvoie vers /auth sans session.
 */
export function useMeQuery({ required = false } = {}) {
  const { data, isSuccess } = useQuery(meQueryOptions)
  const unauthenticated = isSuccess && data === null
  useEffect(() => {
    if (unauthenticated && required) router.replace('/auth')
  }, [unauthenticated, required])
  return data ?? null
}

/** Oublie le joueur connecté (déconnexion, changement de compte). */
export const forgetMe = () => queryClient.removeQueries({ queryKey: [ME.GET] })

/** Déconnexion : téléphone oublié pour les push, session Better Auth fermée, cache vidé, retour à la connexion. */
export async function signOut() {
  await forgetPush().catch(() => undefined)
  await authClient.signOut().catch(() => undefined)
  disconnectRealtime()
  queryClient.clear()
  router.replace({ pathname: '/auth', params: { signedOut: '1' } })
}

// * MUTATIONS

export function useMeMutations() {
  const client = useQueryClient()

  /** PATCH /me : seuls les champs envoyés changent. ApiError 409 si le pseudo est pris. */
  const updateProfile = useMutation({
    mutationKey: [ME.UPDATE],
    mutationFn: (body: UpdateProfileInput) => unwrap(api.PATCH('/me', { body })),
    onSuccess: (me) => client.setQueryData(meQueryOptions.queryKey, me),
  })

  /** Date de naissance après une première connexion Apple / Google. ApiError 403 : trop jeune, compte supprimé. */
  const setBirthDate = useMutation({
    mutationKey: [ME.SET_BIRTH_DATE],
    mutationFn: (birthDate: string) => unwrap(api.POST('/me/birth-date', { body: { birthDate } })),
    onSuccess: () => client.invalidateQueries({ queryKey: meQueryOptions.queryKey }),
  })

  /** Photo de profil analysée à l'envoi. ApiError 422 : refusée d'office, l'ancienne reste. */
  const setAvatar = useMutation({
    mutationKey: [ME.SET_AVATAR],
    mutationFn: (file: FormData) =>
      unwrap(api.POST('/me/avatar', { body: file as never, bodySerializer: (body) => body })),
    onSuccess: (me) => client.setQueryData(meQueryOptions.queryKey, me),
  })

  const deleteAccount = useMutation({
    mutationKey: [ME.DELETE],
    mutationFn: () => unwrap(api.DELETE('/me')),
    // Plus rien du compte supprimé ne doit rester en cache
    onSuccess: () => client.clear(),
  })

  /** Avertissement sécurité des rooms à domicile accepté (LKO-72). */
  const acceptHomeSafety = useMutation({
    mutationKey: [ME.ACCEPT_HOME_SAFETY],
    mutationFn: () =>
      unwrap(api.PUT('/me/home-safety', { body: { version: HOME_SAFETY_VERSION } })),
    onSuccess: (me) => client.setQueryData(meQueryOptions.queryKey, me),
  })

  return { updateProfile, setBirthDate, setAvatar, deleteAccount, acceptHomeSafety }
}
