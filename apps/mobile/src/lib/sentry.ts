import * as Sentry from '@sentry/react-native'

/**
 * Suivi des erreurs de l'app (LKO-36), web et natif : plantages et erreurs JS envoyés à GlitchTip
 * (compatible Sentry). Sans EXPO_PUBLIC_SENTRY_DSN (dev, Expo Go), rien n'est envoyé.
 */
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment:
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? (__DEV__ ? 'development' : 'production'),
  // RGPD : ni IP ni données de l'appareil liées au joueur ; pas de suivi des performances (GlitchTip)
  sendDefaultPii: false,
  tracesSampleRate: 0,
})

export { Sentry }
