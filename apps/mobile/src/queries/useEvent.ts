import type { ReportInput } from '@lucko/shared'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AGENDA, EVENT, EXPLORE } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { unwrap } from '@/lib/queryClient'
import { useRealtime } from '@/lib/realtime'

// * QUERIES

const fetchEvent = (id: string) => unwrap(api.GET('/events/{id}', { params: { path: { id } } }))
type EventDetail = Awaited<ReturnType<typeof fetchEvent>>

export const eventQueryOptions = (id: string) =>
  queryOptions({ queryKey: [EVENT.GET, id], queryFn: () => fetchEvent(id) })

/** Fiche événement, rechargée en direct quand les places restantes changent. */
export function useEventQuery(id: string) {
  const options = eventQueryOptions(id)
  useRealtime({ type: 'event', id }, options.queryKey)
  return useQuery(options)
}

// * MUTATIONS

/** Inscription dans l'app (liste d'attente si c'est complet) et désinscription. */
export function useEventMutations(id: string) {
  const client = useQueryClient()
  const params = { params: { path: { id } } }
  // La fiche prend la réponse ; Mes parties et les places restantes de l'accueil changent aussi
  const onSuccess = (event: EventDetail) => {
    client.setQueryData(eventQueryOptions(id).queryKey, event)
    void client.invalidateQueries({ queryKey: [AGENDA.GET] })
    void client.invalidateQueries({ queryKey: [EXPLORE.TONIGHT] })
  }

  const register = useMutation({
    mutationKey: [EVENT.REGISTER, id],
    mutationFn: () => unwrap(api.POST('/events/{id}/registration', params)),
    onSuccess,
  })

  const unregister = useMutation({
    mutationKey: [EVENT.UNREGISTER, id],
    mutationFn: () => unwrap(api.DELETE('/events/{id}/registration', params)),
    onSuccess,
  })

  /** Signalement (contenu trompeur, inapproprié…) : traité par l'équipe Lucko. */
  const report = useMutation({
    mutationKey: [EVENT.REPORT, id],
    mutationFn: (body: ReportInput) => unwrap(api.POST('/events/{id}/report', { ...params, body })),
  })

  return { register, unregister, report }
}
