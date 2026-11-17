import type { SendFeedbackInput } from '@lucko/shared'
import { useMutation } from '@tanstack/react-query'
import { FEEDBACK } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { unwrap } from '@/lib/queryClient'

// Retours utilisateurs (LKO-166) : envoi seul, l'auteur ne relit pas ses retours.

// * MUTATIONS

export function useFeedbackMutations() {
  const send = useMutation({
    mutationKey: [FEEDBACK.SEND],
    mutationFn: (body: SendFeedbackInput) => unwrap(api.POST('/feedback', { body })),
  })
  return { send }
}
