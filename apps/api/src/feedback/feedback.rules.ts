import { FEEDBACK_RATE_LIMIT, type FeedbackStatus } from '@lucko/shared'

const MINUTE = 60 * 1000

/** Début de la fenêtre où l'on compte les retours déjà envoyés par le joueur. */
export const rateWindowStart = (now: Date) =>
  new Date(now.getTime() - FEEDBACK_RATE_LIMIT.windowMinutes * MINUTE)

/** Le joueur a déjà envoyé le maximum de retours sur la fenêtre. */
export const feedbackRateLimited = (recent: number) => recent >= FEEDBACK_RATE_LIMIT.max

/** Nombre de retours par statut, à zéro pour les statuts absents. */
export function statusCounts(
  statuses: readonly FeedbackStatus[],
  rows: { status: FeedbackStatus; count: number }[],
) {
  const counts = Object.fromEntries(statuses.map((s) => [s, 0])) as Record<FeedbackStatus, number>
  for (const { status, count } of rows) counts[status] = count
  return counts
}
