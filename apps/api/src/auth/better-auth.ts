import { expo } from '@better-auth/expo'
import { ageRegime, birthDateSchema, MIN_AGE, PASSWORD_MIN } from '@lucko/shared'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError } from 'better-auth/api'
import { isSuspended, suspensionMessage } from '../admin/admin.rules'
import type { Env } from '../config/env'
import type { PrismaClient } from '../generated/prisma/client'
import { RESET_PASSWORD_EXPIRES_SEC, resetPasswordMail } from './auth.mails'

/** Fournisseur actif seulement si ses deux variables sont renseignées (le dev tourne sans identifiants Apple / Google). */
function provider(clientId?: string, clientSecret?: string) {
  return clientId && clientSecret ? { clientId, clientSecret } : undefined
}

/**
 * Better Auth (LKO-9) : e-mail + mot de passe, Apple, Google ; sessions en cookie, stockées dans Postgres.
 * Routes servies sous /api/auth/* (montées dans main.ts, avant le body parser de Nest).
 * `sendMail` : envoi par MailService (Mailpit en dev), pour le lien de mot de passe oublié (LKO-138).
 */
export function createAuth(
  prisma: PrismaClient,
  env: Env,
  sendMail: (mail: { to: string; subject: string; html: string }) => Promise<unknown>,
) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    // ponytail: pas de vérification d'e-mail (LKO-22)
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      // Mot de passe oublié : lien par e-mail, valable une heure ; les autres sessions sont fermées
      sendResetPassword: async ({ user, url }) => {
        await sendMail({ to: user.email, ...resetPasswordMail(url) })
      },
      resetPasswordTokenExpiresIn: RESET_PASSWORD_EXPIRES_SEC,
      revokeSessionsOnPasswordReset: true,
    },
    socialProviders: {
      google: provider(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
      apple: provider(env.APPLE_CLIENT_ID, env.APPLE_CLIENT_SECRET),
    },
    // Le site, l'app web Expo, le schéma de l'app native (retour après Apple / Google, `exp://` dans Expo Go en dev)
    // et le POST de retour d'Apple
    trustedOrigins: [
      ...env.CORS_ORIGINS,
      'lucko://',
      ...(env.NODE_ENV === 'production' ? [] : ['exp://']),
      'https://appleid.apple.com',
    ],
    user: {
      additionalFields: {
        // Obligatoire à l'inscription par e-mail (âge vérifié ici), posée par POST /me/birth-date après Apple / Google
        birthDate: {
          type: 'date',
          required: false,
          validator: {
            input: birthDateSchema.refine((date) => ageRegime(date) !== 'too-young', {
              message: `Lucko est ouvert dès ${MIN_AGE} ans`,
            }),
          },
        },
      },
    },
    databaseHooks: {
      user: {
        // La date de naissance règle les droits du compte : jamais modifiable via /api/auth/update-user
        update: { before: async (data) => ('birthDate' in data ? false : undefined) },
      },
      session: {
        // Compte suspendu (LKO-20) : connexion refusée, quel que soit le moyen (e-mail, Apple, Google)
        create: {
          before: async (session) => {
            const user = await prisma.user.findUnique({
              where: { id: session.userId },
              select: { suspendedAt: true, suspendedUntil: true },
            })
            if (user && isSuspended(user))
              throw new APIError('FORBIDDEN', { message: suspensionMessage(user) })
          },
        },
      },
    },
    plugins: [expo()],
  })
}

export type Auth = ReturnType<typeof createAuth>
