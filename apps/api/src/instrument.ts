import * as Sentry from '@sentry/nestjs'
import { loadEnv } from './config/env'

// Suivi des erreurs (LKO-36), chargé avant tout le reste pour instrumenter Nest, HTTP et Prisma.
// GlitchTip auto-hébergé (compatible Sentry) ; sans SENTRY_DSN, le SDK ne fait rien.
const env = loadEnv()

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
  release: env.SENTRY_RELEASE,
  // RGPD : ni utilisateur, ni cookies, ni corps (messages, adresses), ni paramètres d'URL (positions)
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: { allow: ['user-agent', 'content-type'] }, response: false },
    httpBodies: [],
    urlQueryParams: false,
  },
  // GlitchTip : erreurs seules, pas de suivi des performances
  tracesSampleRate: 0,
})
