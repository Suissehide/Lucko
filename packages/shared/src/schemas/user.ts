import { z } from 'zod'
import {
  AVAILABILITY_SLOT_COUNT,
  AVATAR_STATUSES,
  NOTIFICATION_TOPICS,
  PLAY_VIBES,
  RADIUS_KM,
  USER_ROLES,
  VENUE_STAFF_ROLES,
} from '../constants'
import { hasBannedWord } from '../moderation'

/** E-mail saisi par un joueur (connexion, liste d'attente) : nettoyé et mis en minuscules. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Adresse e-mail invalide' }).max(254))

/** Mot de passe à la création du compte (8 caractères minimum, comme Better Auth par défaut). */
export const PASSWORD_MIN = 8
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, { message: `Au moins ${PASSWORD_MIN} caractères` })
  .max(128, { message: '128 caractères maximum' })

/** Date de naissance envoyée à l'API (`AAAA-MM-JJ`) → date UTC. L'âge minimum se vérifie à part (ageRegime). */
export const birthDateSchema = z.iso
  .date({ message: 'Date de naissance invalide' })
  .transform((value) => new Date(value))
  .refine((date) => date <= new Date(), { message: 'Date de naissance dans le futur' })

export const setBirthDateSchema = z.object({ birthDate: birthDateSchema })
export type SetBirthDateInput = z.infer<typeof setBirthDateSchema>

export const PSEUDO_MIN = 3
export const PSEUDO_MAX = 20
/** Pseudo public, unique (sans tenir compte des majuscules). */
export const pseudoSchema = z
  .string()
  .trim()
  .min(PSEUDO_MIN, { message: `Au moins ${PSEUDO_MIN} caractères` })
  .max(PSEUDO_MAX, { message: `${PSEUDO_MAX} caractères maximum` })
  .regex(/^[\p{L}\p{N}_.-]+$/u, {
    message: 'Lettres, chiffres, « _ », « - » et « . » seulement, sans espace',
  })
  .refine((pseudo) => !hasBannedWord(pseudo), { message: 'Ce pseudo n’est pas autorisé' })

const unique = <T>(values: T[]) => [...new Set(values)]

/** PATCH /me : chaque champ est facultatif, seuls ceux envoyés changent. */
export const updateProfileSchema = z
  .object({
    pseudo: pseudoSchema,
    /** Prénom et nom : privés, jamais montrés aux autres joueurs. */
    name: z.string().trim().max(80, { message: '80 caractères maximum' }),
    city: z.string().trim().min(1).max(80).nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    searchRadiusKm: z.number().int().min(RADIUS_KM.min).max(RADIUS_KM.max),
    availability: z
      .array(
        z
          .number()
          .int()
          .min(0)
          .max(AVAILABILITY_SLOT_COUNT - 1),
      )
      .transform((slots) => unique(slots).sort((a, b) => a - b)),
    vibes: z.array(z.enum(PLAY_VIBES)).transform(unique),
    notificationsOff: z.array(z.enum(NOTIFICATION_TOPICS)).transform(unique),
  })
  .partial()
  .refine((body) => (body.latitude === undefined) === (body.longitude === undefined), {
    message: 'Latitude et longitude vont ensemble',
    path: ['latitude'],
  })

export type UpdateProfileInput = z.input<typeof updateProfileSchema>

/** LK du joueur sur un format TCG ; `rating` null tant qu'ils sont provisoires (RATING_PROVISIONAL_GAMES). */
export const rankingSchema = z.object({
  game: z.object({ slug: z.string(), name: z.string() }),
  format: z.string(),
  rating: z.number().int().nullable(),
  rankedGames: z.number().int(),
  reliabilityPct: z.number().int(),
})

export type Ranking = z.infer<typeof rankingSchema>

/** Profil du joueur connecté (GET /me). Ne jamais y ajouter de donnée d'un autre joueur. */
export const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  /** null tant que l'onboarding (LKO-45) n'est pas fait. */
  pseudo: z.string().nullable(),
  name: z.string(),
  /** false après une première connexion Apple / Google : l'app demande la date avant tout. */
  hasBirthDate: z.boolean(),
  role: z.enum(USER_ROLES),
  avatarUrl: z.string().nullable(),
  avatarStatus: z.enum(AVATAR_STATUSES).nullable(),
  city: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  searchRadiusKm: z.number().int(),
  availability: z.array(z.number().int()),
  vibes: z.array(z.enum(PLAY_VIBES)),
  /** Sujets de notifications push coupés (vide = tout activé). */
  notificationsOff: z.array(z.enum(NOTIFICATION_TOPICS)),
  xp: z.number().int(),
  /** Avertissement sécurité des rooms à domicile déjà accepté dans sa version actuelle (LKO-72). */
  homeSafetyAccepted: z.boolean(),
  /** LK du format le plus joué en classé (null sans profil TCG). */
  mainRating: z
    .object({ game: z.string(), format: z.string(), rating: z.number().int() })
    .nullable(),
  rankings: z.array(rankingSchema),
  /** Lieux où le joueur est gérant ou staff : l'app affiche l'espace lieu s'il y en a un. */
  venues: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      /** Lieu partenaire : son staff scanne les QR Lucko (LKO-77). */
      isPartner: z.boolean(),
      role: z.enum(VENUE_STAFF_ROLES),
    }),
  ),
})

export type Me = z.infer<typeof meSchema>

/** Jeton Expo Push d'un appareil (`ExponentPushToken[…]`), envoyé par l'app après la permission. */
export const pushTokenSchema = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, { message: 'Jeton push invalide' }),
})
export type PushTokenInput = z.infer<typeof pushTokenSchema>
