/** Âge minimum pour créer un compte (décision du 25/09/2026). */
export const MIN_AGE = 13

/** Âge de la majorité numérique RGPD en France : consentement parental en dessous. */
export const DIGITAL_MAJORITY_AGE = 15

/** Délai de révélation de l'adresse d'une room à domicile, en heures. */
export const HOME_ADDRESS_REVEAL_HOURS = 24

export const GAME_KINDS = ['TCG', 'BOARD_GAME'] as const
export type GameKind = (typeof GAME_KINDS)[number]

/** Classée : TCG uniquement, les LK bougent. Normale : aucun effet sur les LK, XP seulement. */
export const ROOM_MODES = ['RANKED', 'CASUAL'] as const
export type RoomMode = (typeof ROOM_MODES)[number]

/** Brackets officiels Commander (Wizards) : puissance du deck, à côté du niveau du joueur (archi §13). */
export const COMMANDER_BRACKETS = {
  1: 'Exhibition',
  2: 'Core',
  3: 'Upgraded',
  4: 'Optimized',
  5: 'cEDH',
} as const
export type CommanderBracket = keyof typeof COMMANDER_BRACKETS

/** Statut d'une room (identique à l'enum Prisma RoomStatus). */
export const ROOM_STATUSES = [
  'OPEN',
  'FULL',
  'CONFIRMED',
  'IN_PROGRESS',
  'FINISHED',
  'CANCELLED',
] as const
export type RoomStatus = (typeof ROOM_STATUSES)[number]

/** Place d'un joueur dans une room (identique à l'enum Prisma ParticipantStatus). */
export const PARTICIPANT_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'WAITLISTED',
  'DECLINED',
  'LEFT',
] as const
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number]

/** Rôle global d'un compte (identique à l'enum Prisma UserRole). Les rôles par lieu sont dans VenueStaff. */
export const USER_ROLES = ['PLAYER', 'VENUE_STAFF', 'ADMIN'] as const
export type UserRole = (typeof USER_ROLES)[number]

/** Rôle dans un lieu (enum Prisma VenueStaffRole) : le gérant voit la facture, le staff scanne et pointe. */
export const VENUE_STAFF_ROLES = ['MANAGER', 'STAFF'] as const
export type VenueStaffRole = (typeof VENUE_STAFF_ROLES)[number]

/** Sujets de notifications push (enum Prisma NotificationTopic), que le joueur peut couper un par un. */
export const NOTIFICATION_TOPICS = ['ROOMS', 'MESSAGES', 'VENUES', 'GAMES'] as const
export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number]

export const NOTIFICATION_TOPIC_LABELS: Record<NotificationTopic, string> = {
  ROOMS: 'Mes rooms',
  MESSAGES: 'Messages',
  VENUES: 'Lieux suivis',
  GAMES: 'Rooms de mes jeux',
}

/** Ce que couvre chaque sujet : `long` sur le web, `short` sur téléphone. */
export const NOTIFICATION_TOPIC_DESCRIPTIONS: Record<
  NotificationTopic,
  { long: string; short: string }
> = {
  ROOMS: {
    long: 'Candidatures, rappels avant la partie, annulations.',
    short: 'Candidatures, rappels, annulations',
  },
  MESSAGES: { long: 'Nouveaux messages dans tes rooms.', short: 'Nouveaux messages' },
  VENUES: { long: 'Nouveaux événements des lieux que tu suis.', short: 'Nouveaux événements' },
  GAMES: {
    long: "Une room s'ouvre près de toi pour un jeu de « Je veux jouer à… ».",
    short: 'Rooms des jeux que tu attends',
  },
}

/** « Je veux jouer à… » (LKO-17) : soir, week-end ou peu importe. */
export const PLAY_WHEN = ['EVENING', 'WEEKEND', 'ANY'] as const
export type PlayWhen = (typeof PLAY_WHEN)[number]

export const PLAY_WHEN_LABELS: Record<PlayWhen, string> = {
  EVENING: 'Soir',
  WEEKEND: 'Week-end',
  ANY: 'Peu importe',
}

/** Une envie de jeu dure 7 jours, renouvelée à chaque enregistrement. */
export const PLAY_INTENT_DAYS = 7
/** En dessous, le nombre de joueurs qui attendent un jeu n'est pas affiché (on reconnaîtrait quelqu'un). */
export const PLAY_INTENT_MIN_COUNT = 3
/** Au plus une notification par joueur et par jeu sur cette durée. */
export const PLAY_INTENT_COOLDOWN_HOURS = 12

export const VENUE_TYPES = ['GAME_BAR', 'TCG_SHOP', 'LUDOTHEQUE', 'ASSOCIATION', 'OTHER'] as const
export type VenueType = (typeof VENUE_TYPES)[number]

export const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  GAME_BAR: 'Bar à jeux',
  TCG_SHOP: 'Boutique TCG',
  LUDOTHEQUE: 'Ludothèque',
  ASSOCIATION: 'Association',
  OTHER: 'Lieu',
}

export const EVENT_TYPES = [
  'GAME_NIGHT',
  'INITIATION',
  'TOURNAMENT',
  'PRERELEASE',
  'THEMED',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  GAME_NIGHT: 'Soirée jeux',
  INITIATION: 'Initiation',
  TOURNAMENT: 'Tournoi',
  PRERELEASE: 'Avant-première',
  THEMED: 'Soirée à thème',
}

/** Entrée libre, inscription dans l'app, ou sur un site externe (identique à l'enum Prisma). */
export const REGISTRATION_MODES = ['NONE', 'IN_APP', 'EXTERNAL'] as const
export type RegistrationMode = (typeof REGISTRATION_MODES)[number]

/** Inscription active à un événement (l'enum Prisma a aussi CANCELLED, jamais renvoyé à l'app). */
export const REGISTRATION_STATUSES = ['REGISTERED', 'WAITLISTED'] as const
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]

/** Accessibilité d'un lieu : oui, non, ou simple information (niveau sonore…). */
export const ACCESSIBILITY_STATUSES = ['YES', 'NO', 'INFO'] as const

/** Fermeture du lieu, ou horaires modifiés ces jours-là (identique à l'enum Prisma ClosureKind). */
export const CLOSURE_KINDS = ['CLOSED', 'SPECIAL_HOURS'] as const

/** Agenda de la fiche lieu : mois en cours et les deux suivants. */
export const VENUE_AGENDA_MONTHS = 3

/** Fuseau de référence des lieux (Bordeaux au lancement). */
export const VENUE_TIME_ZONE = 'Europe/Paris'

/** Centre par défaut quand la position du joueur est inconnue ou refusée. */
export const DEFAULT_CITY = { name: 'Bordeaux', lat: 44.8378, lng: -0.5792 } as const

/**
 * Tri honnête des lieux : à distance « égale » (même tranche de 250 m), les partenaires passent devant ;
 * au-delà, la distance l'emporte toujours. Valeur à affiner avec l'équipe (question ouverte n° 2).
 */
export const PARTNER_TIE_METERS = 250

/** Rayon de recherche autour de la ville du joueur, en km. */
export const RADIUS_KM = { min: 1, max: 50, default: 10 } as const

/** Ambiance recherchée (identique à l'enum Prisma PlayVibe). */
export const PLAY_VIBES = [
  'CHILL',
  'COMPETITIVE',
  'TEACHER',
  'BEGINNER',
  'HOMEBREW',
  'SOCIAL',
] as const
export type PlayVibe = (typeof PLAY_VIBES)[number]

// ponytail: noms et descriptions de la maquette, à valider côté produit
export const PLAY_VIBE_LABELS: Record<PlayVibe, { label: string; description: string }> = {
  CHILL: { label: 'Détente', description: 'On joue pour le plaisir, sans pression.' },
  COMPETITIVE: { label: 'Compétitif', description: 'Parties classées, on joue pour gagner.' },
  TEACHER: { label: 'Pédagogue', description: 'J’aime expliquer les règles aux nouveaux.' },
  BEGINNER: { label: 'Débutant', description: 'J’apprends, soyez patients.' },
  HOMEBREW: { label: 'Deck maison', description: 'Je teste mes propres decks.' },
  SOCIAL: { label: 'Convivial', description: 'On discute et on boit un verre entre deux parties.' },
}

/** Ambiance d'une room, choisie par l'hôte (identique à l'enum Prisma RoomVibe). */
export const ROOM_VIBES = [
  'CHILL',
  'COMPETITIVE',
  'BEGINNERS_WELCOME',
  'LENDS_DECKS',
  'ENGLISH_OK',
] as const
export type RoomVibe = (typeof ROOM_VIBES)[number]

export const ROOM_VIBE_LABELS: Record<RoomVibe, string> = {
  CHILL: 'Détendu',
  COMPETITIVE: 'Compétitif',
  BEGINNERS_WELCOME: 'Débutants bienvenus',
  LENDS_DECKS: 'Je prête des decks',
  ENGLISH_OK: 'Anglais OK',
}

/** Catégorie d'une room jeux de société (identique à l'enum Prisma BoardGameCategory). */
export const BOARD_GAME_CATEGORIES = [
  'STRATEGY',
  'AMBIANCE',
  'COOPERATIVE',
  'FAMILY',
  'INVESTIGATION',
  'ROLE_PLAYING',
  'WARGAME',
  'PARTY',
] as const
export type BoardGameCategory = (typeof BOARD_GAME_CATEGORIES)[number]

/** Libellé et nombre de joueurs proposé à la création de la room. */
export const BOARD_GAME_CATEGORY_LABELS: Record<
  BoardGameCategory,
  { label: string; players: number }
> = {
  STRATEGY: { label: 'Stratégie', players: 4 },
  AMBIANCE: { label: 'Ambiance', players: 6 },
  COOPERATIVE: { label: 'Coopératif', players: 4 },
  FAMILY: { label: 'Familial', players: 4 },
  INVESTIGATION: { label: 'Enquête', players: 4 },
  ROLE_PLAYING: { label: 'Jeu de rôle', players: 5 },
  WARGAME: { label: 'Wargame', players: 2 },
  PARTY: { label: 'Party game', players: 8 },
}

/** Disponibilités : créneau = jour × 3 + moment (jour 0 = lundi ; moment 0 matin, 1 après-midi, 2 soir). */
export const AVAILABILITY_SLOT_COUNT = 21

/** Modération de la photo de profil (identique à l'enum Prisma AvatarStatus). */
export const AVATAR_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type AvatarStatus = (typeof AVATAR_STATUSES)[number]

/** Motif d'un signalement de joueur (identique à l'enum Prisma ReportReason). */
export const REPORT_REASONS = [
  'HARASSMENT',
  'INAPPROPRIATE_CONTENT',
  'CHEATING',
  'NO_SHOW',
  'MINOR_SAFETY',
  'SAFETY',
  'OTHER',
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  HARASSMENT: 'Harcèlement ou insultes',
  INAPPROPRIATE_CONTENT: 'Pseudo ou photo inappropriés',
  CHEATING: 'Triche ou résultat faussé',
  NO_SHOW: 'Absences répétées',
  MINOR_SAFETY: 'Comportement suspect envers un mineur',
  SAFETY: 'Comportement inapproprié ou problème de sécurité',
  OTHER: 'Autre',
}

/** Issue d'un signalement traité par un admin (identique à l'enum Prisma ReportResolution). */
export const REPORT_RESOLUTIONS = ['DISMISSED', 'WARNED', 'SUSPENDED'] as const
export type ReportResolution = (typeof REPORT_RESOLUTIONS)[number]

export const REPORT_RESOLUTION_LABELS: Record<ReportResolution, string> = {
  DISMISSED: 'Classé',
  WARNED: 'Averti',
  SUSPENDED: 'Suspendu',
}

/** Lieu proposé ou importé, puis publié par un admin (identique à l'enum Prisma VenueStatus). */
export const VENUE_STATUSES = ['PENDING', 'PUBLISHED'] as const
export type VenueStatus = (typeof VENUE_STATUSES)[number]

/** Action tracée dans le journal d'audit du back-office (identique à l'enum Prisma AdminActionKind). */
export const ADMIN_ACTION_KINDS = [
  'REPORT_DISMISS',
  'REPORT_WARN',
  'REPORT_SUSPEND',
  'USER_SUSPEND',
  'USER_UNSUSPEND',
  'AVATAR_APPROVE',
  'AVATAR_REJECT',
  'VENUE_UPDATE',
  'EVENT_CREATE',
  'EVENT_UPDATE',
  'EVENT_CANCEL',
  'EVENT_HIDE',
  'GAME_MERGE',
] as const
export type AdminActionKind = (typeof ADMIN_ACTION_KINDS)[number]

export const ADMIN_ACTION_LABELS: Record<AdminActionKind, string> = {
  REPORT_DISMISS: 'Signalement classé',
  REPORT_WARN: 'Joueur averti',
  REPORT_SUSPEND: 'Suspendu après un signalement',
  USER_SUSPEND: 'Joueur suspendu',
  USER_UNSUSPEND: 'Suspension levée',
  AVATAR_APPROVE: 'Photo approuvée',
  AVATAR_REJECT: 'Photo refusée',
  VENUE_UPDATE: 'Lieu modifié',
  EVENT_CREATE: 'Événement créé',
  EVENT_UPDATE: 'Événement modifié',
  EVENT_CANCEL: 'Événement annulé',
  EVENT_HIDE: 'Événement masqué',
  GAME_MERGE: 'Jeux fusionnés',
}

/** Suspension : 1 jour à 1 an, ou définitive. */
export const SUSPENSION_MAX_DAYS = 365

/** Événement récurrent créé depuis le back-office : 26 semaines de plus au maximum. */
export const EVENT_REPEAT_MAX_WEEKS = 26
