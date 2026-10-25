import { mailHtml } from '../mail/mail.layout'

/** Durée de validité du lien de réinitialisation du mot de passe (LKO-138). */
export const RESET_PASSWORD_EXPIRES_SEC = 60 * 60

/** Lien pour choisir un nouveau mot de passe, demandé depuis l'écran de connexion (LKO-138). */
export function resetPasswordMail(link: string) {
  return {
    subject: 'Choisis un nouveau mot de passe Lucko',
    html: mailHtml({
      preheader: 'Le lien est valable une heure.',
      tone: 'warning',
      verdict: 'Mot de passe',
      headline: 'Mot de passe oublié ?',
      greeting: 'Bonjour,',
      paragraphs: [
        'Tu as demandé à changer le mot de passe de ton compte Lucko. Le lien ci-dessous est valable une heure.',
        'Une fois le nouveau mot de passe choisi, tes autres appareils sont déconnectés.',
      ],
      action: { label: 'Choisir un nouveau mot de passe', href: link },
      closing:
        'Ce n’est pas toi ? Ignore cet e-mail : ton mot de passe ne change pas tant que le lien n’est pas utilisé.',
    }),
  }
}
