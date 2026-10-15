import * as Sentry from '@sentry/nextjs'

// Suivi des erreurs du site côté serveur (LKO-36) : GlitchTip, compatible Sentry ; sans DSN, rien n'est envoyé
export function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // RGPD : ni utilisateur, ni cookies, ni corps, ni paramètres d'URL
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0,
  })
}

// Erreurs de rendu des pages et des Server Components
export const onRequestError = Sentry.captureRequestError
