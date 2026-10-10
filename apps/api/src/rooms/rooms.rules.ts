import {
  addDays,
  type createRoomSchema,
  formatTime,
  fromLocalDateTime,
  type GameKind,
  type HostAction,
  localDateTime,
  type ParticipantStatus,
  ROOM_MAX_DAYS_AHEAD,
  type RoomStatus,
} from '@lucko/shared'
import type { z } from 'zod'

// ponytail: limite fixe contre le spam, à ajuster quand on verra l'usage réel
export const MAX_OPEN_ROOMS_PER_HOST = 5

const DAY_MS = 24 * 60 * 60 * 1000

type PlayerRange = { minPlayers: number; maxPlayers: number }

export type RoomContext = {
  /** Jeu et ses formats ; les bornes de joueurs du jeu servent sans format (jeux de société). */
  game: PlayerRange & {
    kind: GameKind
    formats: (PlayerRange & { id: string; hasBrackets: boolean })[]
  }
  /** Lieu ouvert à l'heure de la room ; null si ses horaires ne sont pas renseignés ou à domicile. */
  venueOpen: boolean | null
  hostIsMinor: boolean
  /** Moins de 16 ans dans un lieu qui ne les accueille pas seuls (LKO-51). */
  venueRefusesHost: boolean
  /** Rooms à venir encore ouvertes ou complètes, organisées par l'hôte. */
  hostOpenRooms: number
}

/**
 * Création d'une room (archi §5) : message de refus affiché tel quel dans l'app, ou null.
 * Classée = TCG uniquement, avec un format ; jeux de société toujours en normale.
 */
export function createRoomRefusal(
  room: z.output<typeof createRoomSchema>,
  { game, venueOpen, hostIsMinor, venueRefusesHost, hostOpenRooms }: RoomContext,
  now = new Date(),
): string | null {
  const format = game.formats.find((f) => f.id === room.formatId)
  if (room.formatId && !format) return 'Ce format n’existe pas pour ce jeu'
  if (game.kind === 'TCG' && !room.formatId) return 'Choisis un format'
  if (game.kind === 'TCG' && room.boardGameCategory)
    return 'La catégorie ne concerne que les jeux de société'
  if (room.mode === 'RANKED' && game.kind !== 'TCG')
    return 'Les jeux de société se jouent en room normale'
  // Une room peut réunir plus de joueurs qu'une partie (4 joueurs qui enchaînent des duels) : seul le minimum compte
  const { minPlayers } = format ?? game
  if (room.capacity < minPlayers) return `Il faut au moins ${minPlayers} places pour ce format`
  if (room.bracket && !format?.hasBrackets) return 'Le bracket ne concerne que Commander'
  if (room.startsAt <= now) return 'Choisis une date et une heure à venir'
  if (room.startsAt.getTime() > now.getTime() + ROOM_MAX_DAYS_AHEAD * DAY_MS)
    return `Une room se crée au plus ${ROOM_MAX_DAYS_AHEAD} jours à l’avance`
  if (venueOpen === false) return 'Le lieu est fermé à cette heure-là'
  // Garde-fous domicile (LKO-72) : adultes seulement, chaque joueur accepté par l'hôte
  if (room.home && hostIsMinor) return 'Les rooms à domicile sont réservées aux adultes'
  if (room.home && room.autoAccept)
    return 'Chez toi, tu acceptes chaque joueur : l’inscription automatique n’est pas possible'
  // Un mineur ne pourrait pas jouer dans sa propre room 18+
  if (hostIsMinor && !room.minorsAllowed) return 'Ta room doit être ouverte aux mineurs'
  if (venueRefusesHost) return 'Ce lieu n’accueille pas les moins de 16 ans sans adulte'
  if (hostOpenRooms >= MAX_OPEN_ROOMS_PER_HOST)
    return `Tu as déjà ${MAX_OPEN_ROOMS_PER_HOST} rooms à venir : attends qu’une soit passée`
  return null
}

export type JoinableRoom = {
  hostId: string
  status: RoomStatus
  startsAt: Date
  capacity: number
  autoAccept: boolean
}

export const ACTIVE: ParticipantStatus[] = ['PENDING', 'ACCEPTED', 'WAITLISTED']

/**
 * Demande à rejoindre (LKO-56) : complète → liste d'attente ; sinon acceptée d'office si l'inscription
 * est automatique, en attente de l'hôte sinon. Sans effet si le joueur a déjà une place ou une demande.
 * `accepted` compte les joueurs acceptés, hôte compris.
 */
export function joinOutcome(
  room: JoinableRoom,
  accepted: number,
  userId: string,
  current: ParticipantStatus | null,
  now = new Date(),
): { status: ParticipantStatus } | { refused: string } {
  if (room.hostId === userId) return { refused: 'Tu organises cette room' }
  if (room.status !== 'OPEN' && room.status !== 'FULL')
    return { refused: 'Cette room n’accepte plus de joueurs' }
  if (room.startsAt <= now) return { refused: 'Cette room a déjà commencé' }
  if (current && ACTIVE.includes(current)) return { status: current }
  if (current === 'DECLINED') return { refused: 'L’hôte a refusé ta demande pour cette room' }
  if (accepted >= room.capacity) return { status: 'WAITLISTED' }
  return { status: room.autoAccept ? 'ACCEPTED' : 'PENDING' }
}

/** L'hôte accepte une demande : seulement en attente ou en liste d'attente, et s'il reste une place. */
export function acceptRefusal(
  candidate: ParticipantStatus | null,
  accepted: number,
  capacity: number,
) {
  if (candidate !== 'PENDING' && candidate !== 'WAITLISTED') return 'Pas de demande en attente'
  if (accepted >= capacity) return 'La room est complète : retire d’abord un joueur'
  return null
}

/** Place libérée : le premier de la liste d'attente est accepté (inscription automatique) ou repasse en attente de l'hôte. */
export const promotedStatus = (autoAccept: boolean): ParticipantStatus =>
  autoAccept ? 'ACCEPTED' : 'PENDING'

/** Statut ouverte / complète d'après les joueurs acceptés. */
export const fillStatus = (accepted: number, capacity: number): RoomStatus =>
  accepted >= capacity ? 'FULL' : 'OPEN'

/** Durée supposée d'une partie : passé ce délai après le début, la room est terminée. */
// ponytail: pas encore de durée saisie ni de clôture planifiée (LKO-97), statut déduit de l'heure
export const ROOM_PLAY_MS = 3 * 60 * 60 * 1000

/** Statut affiché : en cours puis terminée d'après l'heure, sauf room annulée. */
export function lifecycleStatus(
  room: { status: RoomStatus; startsAt: Date },
  now = new Date(),
): RoomStatus {
  if (room.status === 'CANCELLED' || room.status === 'FINISHED') return room.status
  if (now.getTime() >= room.startsAt.getTime() + ROOM_PLAY_MS) return 'FINISHED'
  if (now >= room.startsAt) return 'IN_PROGRESS'
  return room.status
}

/**
 * Action de l'hôte (LKO-57) : motif de refus, ou null. Possible jusqu'au début de la partie.
 * `participant` : place du joueur visé (retirer, transférer).
 */
export function hostActionRefusal(
  room: { hostId: string; status: RoomStatus; startsAt: Date },
  action: HostAction,
  participant: ParticipantStatus | null,
  now = new Date(),
): string | null {
  const status = lifecycleStatus(room, now)
  if (status === 'CANCELLED') return 'Cette room est annulée'
  if (status === 'IN_PROGRESS' || status === 'FINISHED') return 'La partie a déjà commencé'
  switch (action.type) {
    case 'remove':
    case 'transfer':
      if (action.userId === room.hostId) return 'Tu es déjà l’hôte de cette room'
      return participant === 'ACCEPTED' ? null : 'Ce joueur ne fait pas partie de la room'
    case 'close':
      return status === 'OPEN' || status === 'FULL' ? null : 'Les inscriptions sont déjà fermées'
    case 'reopen':
      return status === 'CONFIRMED' ? null : 'Les inscriptions sont déjà ouvertes'
    case 'cancel':
      return null
  }
}

export type ReminderKind = 'eve' | 'soon'

const SOON_MS = 2 * 60 * 60 * 1000

/**
 * Rappels d'une room (LKO-59) : la veille à 18 h (heure de Paris) et 2 h avant.
 * Ceux déjà passés à la création de la room sont sautés.
 */
export function reminderTimes(startsAt: Date, now = new Date()): [ReminderKind, Date][] {
  const eve = fromLocalDateTime(addDays(localDateTime(startsAt).date, -1), 18 * 60)
  const soon = new Date(startsAt.getTime() - SOON_MS)
  return (
    [
      ['eve', eve],
      ['soon', soon],
    ] as [ReminderKind, Date][]
  ).filter(([, at]) => at > now)
}

/** Texte du rappel : jeu, heure, lieu ; pour une room à domicile, où trouver l'adresse. */
export function reminderContent(
  kind: ReminderKind,
  room: {
    startsAt: Date
    game: { name: string }
    venue: { name: string } | null
    homeAreaLabel: string | null
    addressVisible: boolean | null
  },
) {
  const time = formatTime(room.startsAt)
  const place = room.venue?.name ?? `À domicile · ${room.homeAreaLabel ?? 'zone dans la room'}`
  const address =
    room.addressVisible === null
      ? ''
      : room.addressVisible
        ? ' L’adresse est visible dans la room.'
        : ' L’adresse sera visible dans la room 24 h avant.'
  return {
    title: kind === 'eve' ? `Demain : ${room.game.name} à ${time}` : `${room.game.name} dans 2 h`,
    body: `${place} · ${time}.${address}`,
  }
}
