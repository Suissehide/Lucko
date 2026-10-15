import {
  duelPlacements,
  type GameKind,
  type Placements,
  RESULT_DEADLINE_MS,
  type ResultStatus,
  type RoomMode,
  type RoomStatus,
} from '@lucko/shared'
import { lifecycleStatus, ROOM_PLAY_MS } from './rooms.rules'

/** Fin du délai de 48 h après la fin de la room : validation automatique sans contestation. */
export const resultDeadline = (startsAt: Date) =>
  new Date(startsAt.getTime() + ROOM_PLAY_MS + RESULT_DEADLINE_MS)

type ResultRoom = { mode: RoomMode; kind: GameKind; status: RoomStatus; startsAt: Date }

/**
 * Saisie d'un résultat (LKO-83) : motif de refus, ou null. Rooms TCG classées terminées seulement,
 * par un joueur pointé présent, avant la fin du délai de 48 h.
 */
export function submitRefusal(
  room: ResultRoom,
  presentIds: string[],
  userId: string,
  now = new Date(),
): string | null {
  if (room.mode !== 'RANKED' || room.kind !== 'TCG')
    return 'Pas de résultat en room normale : seule la présence compte'
  const status = lifecycleStatus(room, now)
  if (status === 'CANCELLED') return 'Cette room est annulée'
  if (status !== 'FINISHED') return 'Le résultat se saisit à la fin de la partie'
  if (now > resultDeadline(room.startsAt)) return 'Délai de saisie dépassé : room sans résultat'
  if (presentIds.length < 2) return 'Il faut au moins deux joueurs pointés présents'
  if (!presentIds.includes(userId))
    return 'Seuls les joueurs pointés présents saisissent le résultat'
  return null
}

/** Classement saisi : tous les présents et eux seuls, places cohérentes, score de duel cohérent. */
export function placementsRefusal(
  placements: Placements,
  presentIds: string[],
  score?: string | null,
): string | null {
  const ids = placements.map((p) => p.userId)
  if (ids.length !== presentIds.length || ids.some((id) => !presentIds.includes(id)))
    return 'Le classement doit compter tous les joueurs présents, et eux seuls'
  if (placements.some((p) => p.place > placements.length)) return 'Place hors du classement'
  if (score) {
    const [a, b] = placements
    if (!a || !b || placements.length !== 2) return 'Le score ne concerne qu’un duel'
    const expected = duelPlacements([a.userId, b.userId], score)
    if (expected.some((p, i) => p.place !== placements[i]?.place))
      return 'Le score ne correspond pas au classement'
  }
  return null
}

/** Plus de la moitié des présents ont confirmé (le saisisseur compte) ; en duel, les deux. */
export const majorityReached = (accepted: number, present: number) => accepted * 2 > present

/**
 * Confirmer ou contester : motif de refus, ou null. Seuls les présents votent, une fois, tant que le
 * résultat attend ; plusieurs joueurs peuvent contester un résultat déjà contesté.
 */
export function voteRefusal(
  status: ResultStatus,
  present: boolean,
  voted: boolean,
  dispute: boolean,
): string | null {
  if (!present) return 'Seuls les joueurs pointés présents confirment le résultat'
  if (voted) return 'Tu as déjà donné ton avis sur ce résultat'
  if (status === 'PENDING' || (dispute && status === 'DISPUTED')) return null
  if (status === 'DISPUTED') return 'Résultat contesté : le lieu ou Lucko va trancher'
  return 'Ce résultat n’attend plus de confirmation'
}
