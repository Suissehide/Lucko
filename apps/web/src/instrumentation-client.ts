import * as Sentry from '@sentry/nextjs'

// Suivi des erreurs du site dans le navigateur (LKO-36) ; sans DSN, rien n'est envoyé
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  dataCollection: { userInfo: false, cookies: false, urlQueryParams: false },
  tracesSampleRate: 0,
})
