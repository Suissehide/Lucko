import { ATTENDANCE_WINDOW_MS, type RoomStatus } from '@lucko/shared'

export type Marker = 'HOST' | 'VENUE'

/**
 * Pointage d'une room (LKO-78) : motif si ce rôle ne peut pas pointer, ou null. Ouvert dès le début ;
 * l'hôte jusqu'à 12 h après, le lieu ensuite encore pour corriger (qui et quand restent tracés).
 */
export function attendanceClosed(
  room: { status: RoomStatus; startsAt: Date },
  role: Marker,
  now = new Date(),
): string | null {
  if (room.status === 'CANCELLED') return 'Cette room est annulée'
  if (now < room.startsAt) return 'Le pointage ouvre au début de la partie'
  if (role === 'HOST' && now.getTime() > room.startsAt.getTime() + ATTENDANCE_WINDOW_MS)
    return 'Pointage clos : le lieu peut encore corriger'
  return null
}

/**
 * Joueur que ce rôle ne peut pas pointer : motif, ou null. Le scan du QR vaut présence ; le lieu fait
 * foi sur l'hôte ; l'hôte ne se pointe pas lui-même (anti-abus : pas d'XP gagnée seul).
 */
export function presenceLocked(
  player: { userId: string; source: Marker | null; scanned: boolean },
  role: Marker,
  hostId: string,
): string | null {
  if (player.scanned) return 'Présence validée par le scan du QR Lucko'
  if (role === 'HOST' && player.userId === hostId)
    return 'Ta présence est pointée par le lieu ou le scan'
  if (role === 'HOST' && player.source === 'VENUE') return 'Déjà pointé par le lieu'
  return null
}
