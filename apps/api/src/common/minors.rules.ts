import { ageOn, ageRegime, MIN_AGE } from '@lucko/shared'

/** Joueur qui consulte une liste ; null = pas connecté (site public). */
export type Viewer = { id: string; birthDate: Date | null; parentId: string | null } | null

const ADULT_AGE = 18
/** Art. L3342-3 CSP : pas de moins de 16 ans non accompagnés dans un débit de boissons. */
const UNACCOMPANIED_AGE = 16

/**
 * Âge retenu pour les règles mineurs (archi §3). Sans date de naissance (première connexion
 * Apple / Google pas terminée), on prend l'âge minimum : le régime le plus protecteur.
 */
export function viewerAge(viewer: NonNullable<Viewer>, now = new Date()) {
  return viewer.birthDate ? ageOn(viewer.birthDate, now) : MIN_AGE
}

export const isMinor = (viewer: Viewer, now = new Date()) =>
  viewer !== null && viewerAge(viewer, now) < ADULT_AGE

/** Lieu qui refuse le joueur s'il vient seul : moins de 16 ans dans un lieu sans « mineurs non accompagnés ». */
export const venueRefuses = (
  venue: { acceptsUnaccompaniedMinors: boolean } | null,
  viewer: Viewer,
  now = new Date(),
) =>
  viewer !== null &&
  venue?.acceptsUnaccompaniedMinors === false &&
  viewerAge(viewer, now) < UNACCOMPANIED_AGE

/** Code d'erreur d'une candidature refusée par les règles mineurs, pour que l'app la distingue. */
export const MINOR_REFUSED = 'MINOR_REFUSED'

/**
 * Motif pour lequel un mineur ne peut pas voir ni rejoindre la room, ou null : seulement « ouverte aux
 * mineurs », jamais à domicile, ni dans un lieu qui refuse les moins de 16 ans seuls (LKO-51), sauf si
 * son parent lié organise la room (décision du 25/09) ou y est accepté (LKO-72).
 */
export function minorRefusal(
  room: {
    minorsAllowed: boolean
    atHome: boolean
    hostId: string
    venue: { acceptsUnaccompaniedMinors: boolean } | null
    /** Joueurs acceptés, hôte compris (fiche et candidature) ; absent dans les listes. */
    acceptedUserIds?: string[]
  },
  viewer: Viewer,
  now = new Date(),
): string | null {
  if (!isMinor(viewer, now)) return null
  // Son parent est de la partie : il vient accompagné
  const parentId = viewer?.parentId
  const withParent =
    parentId != null && (room.hostId === parentId || !!room.acceptedUserIds?.includes(parentId))
  if (room.atHome) return withParent ? null : 'Les rooms à domicile sont réservées aux adultes'
  if (!withParent && venueRefuses(room.venue, viewer, now))
    return 'Ce lieu n’accueille pas les moins de 16 ans sans adulte'
  return room.minorsAllowed ? null : 'Cette room est réservée aux adultes'
}

export const roomVisibleTo = (...args: Parameters<typeof minorRefusal>) =>
  minorRefusal(...args) === null

/** Événement visible : pas d'âge minimum, ou le joueur l'a (soirées 18+ jamais montrées aux mineurs). */
export function eventVisibleTo(event: { minAge: number | null }, viewer: Viewer, now = new Date()) {
  return viewer === null || event.minAge === null || viewerAge(viewer, now) >= event.minAge
}

/** 13-14 ans sans accord d'un parent (LKO-49) : compte en lecture seule. */
export const needsParentalConsent = (
  user: { birthDate: Date | null; parentalConsentAt: Date | null },
  now = new Date(),
) =>
  user.birthDate !== null &&
  user.parentalConsentAt === null &&
  ageRegime(user.birthDate, now) === 'parental-consent'
