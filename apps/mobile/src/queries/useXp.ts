import { useQuery } from '@tanstack/react-query'
import { XP } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { unwrap } from '@/lib/queryClient'

// * QUERIES

/** Mon XP : total, niveau nommé, progression et derniers gains (LKO-89). */
export const useMyXpQuery = () =>
  useQuery({ queryKey: [XP.GET], queryFn: () => unwrap(api.GET('/me/xp')) })
