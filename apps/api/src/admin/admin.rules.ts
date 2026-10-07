import type { AdminActionKind } from '@lucko/shared'
import { mailHtml } from '../mail/mail.layout'

const DAY_MS = 24 * 60 * 60 * 1000

type Suspendable = { suspendedAt: Date | null; suspendedUntil: Date | null }

/** Suspension en cours : posée, et définitive ou pas encore échue. */
export const isSuspended = (user: Suspendable, now = new Date()) =>
  user.suspendedAt !== null && (user.suspendedUntil === null || user.suspendedUntil > now)

/** Fin d'une suspension de `days` jours ; null = définitive. */
export const suspensionEnd = (days: number | null, now = new Date()) =>
  days === null ? null : new Date(now.getTime() + days * DAY_MS)

/** Message montré au joueur suspendu qui tente de se connecter. */
export function suspensionMessage(user: Suspendable) {
  if (!user.suspendedUntil) return 'Ton compte est suspendu.'
  const until = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
  }).format(user.suspendedUntil)
  return `Ton compte est suspendu jusqu’au ${until}.`
}

// Même adresse que CONTACT_EMAIL du design system (pied de page, Réglages)
const SUPPORT_EMAIL = 'contact@lucko.fr'

const greeting = (pseudo: string | null) => (pseudo ? `Bonjour ${pseudo},` : 'Bonjour,')

const longDay = (date: Date) =>
  new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'long',
  }).format(date)

/** E-mail au joueur suspendu : durée, motif, contact pour contester. */
export function suspensionMail(user: Suspendable & { pseudo: string | null }, reason: string) {
  const until = user.suspendedUntil
    ? `Jusqu’au ${longDay(user.suspendedUntil)}`
    : 'Suspension définitive'
  return {
    subject: 'Ton compte Lucko est suspendu',
    html: mailHtml({
      preheader: `${until}. Motif : ${reason}`,
      tone: 'danger',
      verdict: 'Compte suspendu',
      headline: until,
      greeting: greeting(user.pseudo),
      paragraphs: [
        `L’équipe de modération a suspendu ton compte. Tu ne peux plus te connecter à Lucko${user.suspendedUntil ? ' jusqu’à cette date' : ''}, tes rooms à venir ont été annulées.`,
      ],
      quote: { label: 'Le motif', text: reason },
      action: { label: 'Contester la décision', href: `mailto:${SUPPORT_EMAIL}` },
      closing: `Explique ta version dans ton message : un membre de l’équipe relira ton dossier. Adresse du support : ${SUPPORT_EMAIL}.`,
    }),
  }
}

/** E-mail d'avertissement de la modération (envoyé aussi en notification). */
export function warningMail(pseudo: string | null, reason: string) {
  return {
    subject: 'Avertissement de la modération Lucko',
    html: mailHtml({
      preheader: reason,
      tone: 'warning',
      verdict: 'Avertissement',
      headline: 'Un signalement te concerne',
      greeting: greeting(pseudo),
      paragraphs: [
        'L’équipe de modération a examiné un signalement à ton sujet. Ton compte reste actif, mais voici ce qui doit changer :',
      ],
      quote: { label: 'Le message de l’équipe', text: reason },
      closing: `Si cela se reproduit, ton compte pourra être suspendu. Une question ? Écris-nous à ${SUPPORT_EMAIL}.`,
    }),
  }
}

type Format = { id: string; slug: string }

/**
 * Fusion de deux jeux, côté formats : un format du doublon qui existe aussi (même slug) dans le jeu
 * cible y est fondu (`remap`), les autres sont simplement déplacés vers le jeu cible (`move`).
 */
export function planFormatMerge(source: Format[], target: Format[]) {
  const bySlug = new Map(target.map((f) => [f.slug, f.id]))
  const remap = new Map<string, string>()
  const move: string[] = []
  for (const format of source) {
    const into = bySlug.get(format.slug)
    if (into) remap.set(format.id, into)
    else move.push(format.id)
  }
  return { remap, move }
}

type Profile = { id: string; userId: string; rankedGames: number }

/**
 * Profils de jeu (LK) d'un format fondu dans un autre : un joueur présent des deux côtés garde
 * le profil le plus joué en classé, l'autre est supprimé. Les autres profils sont déplacés.
 */
export function planProfileMerge(source: Profile[], target: Profile[]) {
  const targetByUser = new Map(target.map((p) => [p.userId, p]))
  const move: string[] = []
  const remove: string[] = []
  for (const profile of source) {
    const existing = targetByUser.get(profile.userId)
    if (!existing) move.push(profile.id)
    else if (profile.rankedGames > existing.rankedGames) {
      move.push(profile.id)
      remove.push(existing.id)
    } else remove.push(profile.id)
  }
  return { move, remove }
}

/**
 * Ce que désigne le `targetId` d'une action du journal : la création d'un événement vise le lieu
 * (route /venues/:id/events), la fusion vise le doublon supprimé (on montre le jeu gardé).
 */
export const ACTION_TARGET: Record<
  AdminActionKind,
  'report' | 'user' | 'venue' | 'event' | 'merge'
> = {
  REPORT_DISMISS: 'report',
  REPORT_WARN: 'report',
  REPORT_SUSPEND: 'report',
  USER_SUSPEND: 'user',
  USER_UNSUSPEND: 'user',
  AVATAR_APPROVE: 'user',
  AVATAR_REJECT: 'user',
  VENUE_UPDATE: 'venue',
  EVENT_CREATE: 'venue',
  EVENT_UPDATE: 'event',
  EVENT_CANCEL: 'event',
  EVENT_HIDE: 'event',
  GAME_MERGE: 'merge',
}
