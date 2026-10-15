import { config } from 'dotenv'

// Lit apps/api/.env s'il existe, sinon le .env à la racine du monorepo
config({ path: ['.env', '../../.env'], quiet: true })

import { z } from 'zod'
import { addressKeys } from '../rooms/home.rules'

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().default(3000),
    DATABASE_URL: z.string().url(),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3010,http://localhost:8081')
      .transform((value) => value.split(',').map((origin) => origin.trim())),
    /** Dev uniquement : l'en-tête `x-dev-user-id` vaut connexion (joueurs de démo du seed, sans mot de passe). */
    DEV_AUTH_HEADER: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    /** URL publique de l'API, base des callbacks Apple / Google. */
    BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
    /** Clé de signature des sessions (32 caractères min.) ; Better Auth refuse de démarrer sans en production. */
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    /** Services ID Apple (ex. fr.lucko.app.signin) et son secret JWT signé avec la clé .p8. */
    APPLE_CLIENT_ID: z.string().optional(),
    APPLE_CLIENT_SECRET: z.string().optional(),
    /** Jeton d'accès Expo, seulement si la sécurité des push est activée sur le projet Expo. */
    EXPO_ACCESS_TOKEN: z.string().optional(),
    /** Serveur d'envoi des e-mails (Resend en SMTP en production) ; hors production, Mailpit par défaut. */
    SMTP_URL: z.string().url().optional(),
    MAIL_FROM: z.string().default('Lucko <noreply@lucko.fr>'),
    /** Adresse de l'app web (Expo), pour les liens des e-mails. */
    APP_URL: z.string().url().default('http://localhost:8081'),
    /** Stockage objet S3 (RustFS en local, voir deploy/compose.yaml) ; sans bucket, l'envoi de photo répond 503. */
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default('fr-par'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    /** Base publique des fichiers (bucket ou CDN), ex. https://lucko-prod.s3.fr-par.scw.cloud */
    S3_PUBLIC_URL: z.string().url().optional(),
    /** Analyse automatique des photos (sightengine.com) ; sans clé, chaque photo attend un admin. */
    SIGHTENGINE_API_USER: z.string().optional(),
    SIGHTENGINE_API_SECRET: z.string().optional(),
    /**
     * Suivi des erreurs (LKO-36) : DSN du projet GlitchTip (compatible Sentry). Sans DSN, rien n'est
     * envoyé. Environnement par défaut : NODE_ENV ; version : SHA du commit déployé si fourni.
     */
    SENTRY_DSN: z.url().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
    SENTRY_RELEASE: z.string().optional(),
    /**
     * Serveurs Overpass (import des lieux OSM, LKO-74), essayés dans l'ordre, séparés par des virgules :
     * le serveur public est souvent surchargé (502, 504), les miroirs (opérateurs distincts) prennent le relais.
     */
    OVERPASS_URLS: z
      .string()
      .default(
        [
          'https://overpass-api.de/api/interpreter',
          'https://overpass.private.coffee/api/interpreter',
          'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
        ].join(','),
      )
      .transform((value) => value.split(',').map((url) => url.trim()))
      .pipe(z.array(z.url()).min(1)),
    /**
     * Clés AES-256 des adresses de rooms à domicile, « 1:<base64> » (`openssl rand -base64 32`),
     * la clé active en tête (rotation : voir `addressKeys`). Obligatoire en production ; ailleurs,
     * une clé de développement fixe.
     */
    HOME_ADDRESS_KEYS: z
      .string()
      .refine(
        (value) => {
          try {
            addressKeys(value)
            return true
          } catch {
            return false
          }
        },
        {
          message: '« version:clé » attendu, clé de 32 octets en base64, séparées par des virgules',
        },
      )
      .optional(),
  })
  .refine((env) => !(env.NODE_ENV === 'production' && env.DEV_AUTH_HEADER), {
    message: 'DEV_AUTH_HEADER est interdit en production',
    path: ['DEV_AUTH_HEADER'],
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.HOME_ADDRESS_KEYS, {
    message: 'HOME_ADDRESS_KEYS est obligatoire en production',
    path: ['HOME_ADDRESS_KEYS'],
  })

export type Env = z.infer<typeof envSchema>

/** Valide les variables d'environnement au démarrage : l'API refuse de démarrer si une variable manque. */
export function loadEnv(): Env {
  // Variable vide (`S3_ENDPOINT=` dans Dokploy) = absente : valeur par défaut, pas d'URL invalide
  const parsed = envSchema.safeParse(
    Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== '')),
  )
  if (!parsed.success) {
    console.error('Variables d’environnement invalides :', z.treeifyError(parsed.error))
    process.exit(1)
  }
  return parsed.data
}
