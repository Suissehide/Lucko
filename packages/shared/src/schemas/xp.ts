import { z } from 'zod'
import { XP_BONUSES } from '../xp'
import { isoDateTime } from './common'

/** GET /me/xp (LKO-89) : total, niveau, progression et derniers gains. */
export const myXpSchema = z.object({
  xp: z.number().int(),
  level: z.number().int(),
  name: z.string(),
  current: z.number().int(),
  max: z.number().int(),
  recent: z.array(
    z.object({
      id: z.string(),
      amount: z.number().int(),
      bonuses: z.array(z.enum(XP_BONUSES)),
      /** Jeu et format de la room, ex. « Magic: The Gathering · Commander ». */
      label: z.string(),
      createdAt: isoDateTime,
    }),
  ),
})

export type MyXp = z.input<typeof myXpSchema>
