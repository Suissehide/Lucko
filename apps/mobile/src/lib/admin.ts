import { colors, type SidebarItem } from '@lucko/design-system'
import {
  type AdminActionItem,
  type AdminActionKind,
  type AdminDashboard,
  type AdminEvent,
  type AdminEventInput,
  type AdminGame,
  type AdminUser,
  type AdminUserDetail,
  type AdminUserFilter,
  type AdminVenue,
  formatAgo,
  formatTime,
  localDateTime,
  type ReportResolution,
  VENUE_TIME_ZONE,
} from '@lucko/shared'
import { type Href, router } from 'expo-router'
import { shortDay } from './explore'

// Back-office admin (LKO-20) : navigation et mise en forme des données pour les écrans /admin.

export type AdminSection = 'dashboard' | 'reports' | 'users' | 'avatars' | 'venues' | 'games'

const ROUTES: Record<AdminSection, Href> = {
  dashboard: '/admin',
  reports: '/admin/reports',
  users: '/admin/users',
  avatars: '/admin/avatars',
  venues: '/admin/venues',
  games: '/admin/games',
}

export const openAdmin = (section: string) => router.navigate(ROUTES[section as AdminSection])

export const openAdminUser = (id: string) =>
  router.push({ pathname: '/admin/users/[id]', params: { id } })

export const openAdminVenue = (id: string) =>
  router.push({ pathname: '/admin/venues/[id]', params: { id } })

const badge = (count?: number) => (count ? String(count) : undefined)

/** Barre latérale : une entrée par file, avec ce qui attend ; pastille rouge si un mineur est visé. */
export const adminSidebarItems = (dashboard?: AdminDashboard): SidebarItem[] => [
  { key: 'dashboard', label: 'Tableau de bord' },
  {
    key: 'reports',
    label: 'Signalements',
    group: 'Modération',
    badge: badge(dashboard?.openReports),
    alert: !!dashboard?.minorReports,
  },
  { key: 'avatars', label: 'Photos de profil', badge: badge(dashboard?.pendingAvatars) },
  { key: 'users', label: 'Joueurs', badge: badge(dashboard?.suspendedPlayers) },
  {
    key: 'venues',
    label: 'Lieux et événements',
    group: 'Catalogue',
    badge: badge(dashboard?.pendingVenues),
  },
  { key: 'games', label: 'Jeux' },
]

export const ADMIN_TITLES: Record<AdminSection, string> = {
  dashboard: 'Back-office',
  reports: 'Signalements',
  users: 'Joueurs',
  avatars: 'Photos de profil',
  venues: 'Lieux et événements',
  games: 'Jeux',
}

export const ADMIN_KICKERS: Record<AdminSection, string> = {
  dashboard: '',
  reports: 'Modération',
  avatars: 'Modération',
  users: 'Modération',
  venues: 'Catalogue',
  games: 'Catalogue',
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`

/** « Mardi 6 octobre » */
export const longToday = () => {
  const day = new Intl.DateTimeFormat('fr-FR', {
    timeZone: VENUE_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
  return day.charAt(0).toUpperCase() + day.slice(1)
}

/** « 12 sept. » */
export const dayMonth = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: VENUE_TIME_ZONE,
    day: 'numeric',
    month: 'short',
  }).format(new Date(date))

/** « Sam. 10 oct. · 19:30 » */
export const dateTime = (date: string) => `${shortDay(date)} · ${formatTime(date)}`

/** Journal : « Auj. · 14:03 », « Hier · 09:12 », « Sam. 10 oct. · 19:30 ». */
export function logWhen(date: string) {
  const day = (d: Date) => localDateTime(d).date
  const label =
    day(new Date(date)) === day(new Date())
      ? 'Auj.'
      : day(new Date(date)) === day(new Date(Date.now() - 864e5))
        ? 'Hier'
        : shortDay(date)
  return `${label} · ${formatTime(date)}`
}

// * TABLEAU DE BORD

/** Cartes « À traiter » : file, nombre, note et section à ouvrir. */
export function queueCards(d: AdminDashboard) {
  return [
    {
      key: 'reports',
      value: d.openReports,
      label: 'Signalements ouverts',
      color: colors.room,
      note: d.oldestReportAt ? `Le plus ancien : ${formatAgo(d.oldestReportAt)}` : 'File vide',
    },
    {
      key: 'avatars',
      value: d.pendingAvatars,
      label: 'Photos à valider',
      color: colors.event,
      note: d.oldestAvatarAt ? `La plus ancienne : ${formatAgo(d.oldestAvatarAt)}` : 'File vide',
    },
    {
      key: 'venues',
      value: d.pendingVenues,
      label: 'Lieux à publier',
      color: colors.venue,
      note: d.pendingVenueNames.join(', ') || 'File vide',
    },
    {
      key: 'users',
      value: d.suspendedPlayers,
      label: 'Joueurs suspendus',
      color: colors.ink,
      note: d.suspendedPlayers ? 'Suspensions en cours' : 'Aucune suspension en cours',
    },
  ] as const
}

export const minorAlert = (count: number) =>
  `${count} signalement${count > 1 ? 's concernent' : ' concerne'} un joueur mineur.`

export type JournalFilter = 'all' | 'moderation' | 'photos' | 'catalogue'

export const JOURNAL_FILTERS: { key: JournalFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'moderation', label: 'Modération' },
  { key: 'photos', label: 'Photos' },
  { key: 'catalogue', label: 'Catalogue' },
]

const ACTION_GROUP: Record<AdminActionKind, Exclude<JournalFilter, 'all'>> = {
  REPORT_DISMISS: 'moderation',
  REPORT_WARN: 'moderation',
  REPORT_SUSPEND: 'moderation',
  USER_SUSPEND: 'moderation',
  USER_UNSUSPEND: 'moderation',
  AVATAR_APPROVE: 'photos',
  AVATAR_REJECT: 'photos',
  VENUE_UPDATE: 'catalogue',
  EVENT_CREATE: 'catalogue',
  EVENT_UPDATE: 'catalogue',
  EVENT_CANCEL: 'catalogue',
  EVENT_HIDE: 'moderation',
  GAME_MERGE: 'catalogue',
}

export const inJournal = (filter: JournalFilter) => (a: AdminActionItem) =>
  filter === 'all' || ACTION_GROUP[a.action] === filter

/** Couleur d'une action : levée et approbation en vert, avertissement en jaune, sanction en rouge. */
export const ACTION_COLOR: Record<AdminActionKind, string> = {
  REPORT_DISMISS: colors.white,
  REPORT_WARN: colors.rating,
  REPORT_SUSPEND: colors.room,
  USER_SUSPEND: colors.room,
  USER_UNSUSPEND: colors.venue,
  AVATAR_APPROVE: colors.venue,
  AVATAR_REJECT: colors.room,
  VENUE_UPDATE: colors.event,
  EVENT_CREATE: colors.event,
  EVENT_UPDATE: colors.event,
  EVENT_CANCEL: colors.event,
  EVENT_HIDE: colors.room,
  GAME_MERGE: colors.muted,
}

export function openTarget(target: NonNullable<AdminActionItem['target']>) {
  if (target.type === 'user') openAdminUser(target.id)
  else if (target.type === 'venue') openAdminVenue(target.id)
  else openAdmin('games')
}

// * SIGNALEMENTS

export const reportsNote = (open: number, minors: number) =>
  `${plural(open, 'ouvert')} · ${minors} sur un mineur`

/** Compteurs du dossier : signalements ouverts, avertissements et suspensions passés. */
export function dossierStats(user: AdminUserDetail) {
  const count = (kinds: AdminActionKind[]) =>
    user.actions.filter((a) => kinds.includes(a.action)).length
  const open = user.reports.filter((r) => !r.resolvedAt).length
  return [
    { label: 'Signalements ouverts', value: open, color: open > 1 ? colors.room : undefined },
    { label: 'Avertissements', value: count(['REPORT_WARN']) },
    { label: 'Suspensions', value: count(['REPORT_SUSPEND', 'USER_SUSPEND']) },
  ]
}

export const DECISIONS: Record<
  ReportResolution,
  {
    title: string
    description: string
    color: string
    field: string
    placeholder: string
    optional?: boolean
    duration?: boolean
    consequence: string
    confirm: string
    confirmKind: 'ink' | 'rating' | 'room'
  }
> = {
  DISMISSED: {
    title: 'Classer',
    description: 'Aucune suite',
    color: colors.white,
    field: 'Motif (facultatif)',
    placeholder: 'Ex. Signalement sans fondement',
    optional: true,
    consequence: 'Aucune suite pour le joueur.',
    confirm: 'Classer le signalement',
    confirmKind: 'ink',
  },
  WARNED: {
    title: 'Avertir',
    description: 'Notification + e-mail',
    color: colors.rating,
    field: 'Message au joueur',
    placeholder: 'Ex. Merci de choisir un pseudo correct.',
    consequence: 'Il reçoit ce message tel quel, en notification et par e-mail.',
    confirm: 'Envoyer l’avertissement',
    confirmKind: 'rating',
  },
  SUSPENDED: {
    title: 'Suspendre',
    description: 'Compte bloqué',
    color: colors.room,
    field: 'Motif (envoyé au joueur)',
    placeholder: 'Ex. Insultes répétées dans le chat de la room après une défaite.',
    duration: true,
    consequence:
      'Déconnecté partout, il ne peut plus se connecter. Ses rooms à venir sont annulées et ses autres signalements ouverts sont clos.',
    confirm: 'Suspendre',
    confirmKind: 'room',
  },
}

// * JOUEURS

export const ROLE_LABELS: Record<AdminUser['role'], string> = {
  PLAYER: 'Joueur',
  VENUE_STAFF: 'Staff lieu',
  ADMIN: 'Admin',
}

export const USER_FILTERS: { key: AdminUserFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'reported', label: 'Signalés' },
  { key: 'minor', label: 'Mineurs' },
  { key: 'suspended', label: 'Suspendus' },
  { key: 'staff', label: 'Staff et admins' },
]

/** « Suspendu jusqu'au 13 oct. », « Suspendu définitivement ». */
export const suspensionLabel = (suspension: NonNullable<AdminUser['suspension']>) =>
  suspension.until ? `Suspendu jusqu’au ${shortDay(suspension.until)}` : 'Suspendu définitivement'

/** Durées proposées pour une suspension ; `null` = définitive. */
export const SUSPENSION_DURATIONS: { key: string; label: string; days: number | null }[] = [
  { key: '1', label: '1 jour', days: 1 },
  { key: '7', label: '7 jours', days: 7 },
  { key: '30', label: '30 jours', days: 30 },
  { key: 'definitive', label: 'Définitive', days: null },
]

export const suspensionDays = (key: string) =>
  SUSPENSION_DURATIONS.find((d) => d.key === key)?.days ?? null

// * LIEUX

/** Avant de publier : adresse, horaires, photos (avertissement seulement), accueil des mineurs. */
export function venueChecklist(venue: AdminVenue) {
  const days = new Set(venue.openingHours.map((h) => h.weekday)).size
  return [
    { label: 'Adresse', ok: !!venue.address, detail: 'Géolocalisée sur la carte' },
    {
      label: 'Horaires',
      ok: days > 0,
      detail: days ? `${plural(days, 'jour')} renseigné${days > 1 ? 's' : ''}` : 'À renseigner',
    },
    {
      label: 'Photos',
      ok: venue.photoCount > 0,
      detail: venue.photoCount
        ? plural(venue.photoCount, 'photo')
        : 'Aucune photo : la fiche sera publiée sans galerie',
    },
    {
      label: 'Accueil des mineurs',
      ok: true,
      detail: venue.acceptsUnaccompaniedMinors ? 'Même non accompagnés' : 'Accompagnés uniquement',
    },
  ]
}

// * JEUX

const normalized = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '')

/** Doublon probable : un autre jeu dont le nom normalisé contient celui-ci (« Lorcana », « Disney Lorcana »). */
export const duplicateOf = (game: AdminGame, games: AdminGame[]) =>
  games.find((g) => g.id !== game.id && normalized(g.name).includes(normalized(game.name)))

/** Ce que déplace la fusion de `source` dans `target` (mêmes règles que l'API : formats par slug). */
export function mergeSummary(source: AdminGame, target: AdminGame) {
  const slugs = new Set(target.formats.map((f) => f.slug))
  const fused = source.formats.filter((f) => slugs.has(f.slug)).map((f) => f.name)
  const moved = source.formats.filter((f) => !slugs.has(f.slug)).map((f) => f.name)
  return [
    `${plural(source.rooms, 'room')} et ${plural(source.events, 'événement')} passent sur « ${target.name} ».`,
    fused.length ? `Formats fondus dans le format existant : ${fused.join(', ')}.` : null,
    moved.length ? `Formats déplacés : ${moved.join(', ')}.` : null,
    source.players
      ? `${plural(source.players, 'profil')} de jeu : un joueur présent des deux côtés garde le profil le plus joué en classé.`
      : null,
  ].filter((line): line is string => line !== null)
}

// * ÉVÉNEMENTS

/** Formulaire d'événement : champs texte, convertis en nombres à l'envoi. */
export type EventFormValues = Omit<
  AdminEventInput,
  'capacity' | 'priceCents' | 'minAge' | 'repeatWeeks' | 'endTime' | 'description' | 'externalUrl'
> & {
  description: string
  endTime: string
  capacity: string
  price: string
  minAge: string
  externalUrl: string
  repeatWeeks: string
}

/** Date et heure locales (heure du lieu) d'un instant ISO, pour préremplir un formulaire. */
export const localParts = (date: string) => {
  const { date: day, minute } = localDateTime(new Date(date), VENUE_TIME_ZONE)
  const pad = (n: number) => String(n).padStart(2, '0')
  return { day, time: `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}` }
}

export function eventFormValues(event?: AdminEvent): EventFormValues {
  if (!event)
    return {
      type: 'GAME_NIGHT',
      title: '',
      description: '',
      date: localDateTime(new Date()).date,
      startTime: '19:00',
      endTime: '',
      capacity: '',
      price: '',
      minAge: '',
      registrationMode: 'IN_APP',
      externalUrl: '',
      gameIds: [],
      repeatWeeks: '0',
    }
  const start = localParts(event.startsAt)
  return {
    type: event.type,
    title: event.title,
    description: event.description ?? '',
    date: start.day,
    startTime: start.time,
    endTime: event.endsAt ? localParts(event.endsAt).time : '',
    capacity: event.capacity?.toString() ?? '',
    price: event.priceCents === null ? '' : String(event.priceCents / 100),
    minAge: event.minAge?.toString() ?? '',
    registrationMode: event.registrationMode,
    externalUrl: event.externalUrl ?? '',
    gameIds: event.gameIds,
    repeatWeeks: '0',
  }
}

const numberOrNull = (text: string) => (text.trim() ? Number(text.replace(',', '.')) : null)
const textOrNull = (text: string) => text.trim() || null

/** Corps du POST / PUT : champs vides → null, prix en centimes. */
export function eventBody({ price: priceText, ...values }: EventFormValues): AdminEventInput {
  const price = numberOrNull(priceText)
  return {
    ...values,
    description: textOrNull(values.description),
    endTime: textOrNull(values.endTime),
    externalUrl: textOrNull(values.externalUrl),
    capacity: numberOrNull(values.capacity),
    priceCents: price === null ? null : Math.round(price * 100),
    minAge: numberOrNull(values.minAge),
    repeatWeeks: Number(values.repeatWeeks) || 0,
  }
}
