import { XP_ROOMS_PER_EVENING } from '@lucko/shared'

/**
 * Que faire de l'XP d'un joueur pour une room (LKO-89) : la donner, la retirer, ou ne rien changer.
 * Présence vérifiée = scan du QR ou pointage « Là » ; une room à un seul joueur ne compte pas ; au plus
 * XP_ROOMS_PER_EVENING rooms par soirée ; jamais deux fois la même room.
 */
export function xpChange({
  present,
  scanned,
  cancelled,
  players,
  awarded,
  awardedTonight,
}: {
  present: boolean | null
  scanned: boolean
  cancelled: boolean
  /** Joueurs acceptés dans la room, hôte compris. */
  players: number
  /** Gain déjà donné pour cette room. */
  awarded: boolean
  /** Rooms qui ont déjà rapporté de l'XP ce soir-là. */
  awardedTonight: number
}): 'award' | 'revoke' | 'keep' {
  const verified = !cancelled && players >= 2 && (scanned || present === true)
  if (!verified) return awarded ? 'revoke' : 'keep'
  if (awarded || awardedTonight >= XP_ROOMS_PER_EVENING) return 'keep'
  return 'award'
}
