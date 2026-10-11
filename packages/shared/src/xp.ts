export const XP_PER_LEVEL = 500

// ponytail: paliers provisoires (un nom par niveau, le dernier se répète), à valider avec l'équipe
export const XP_LEVEL_NAMES = [
  'Recrue',
  'Visage connu',
  'Régulier',
  'Pilier de table',
  'Figure du coin',
  'Légende',
] as const

/**
 * Barème de participation (LKO-89, archi §14) : la même XP pour un jeu de société, une room TCG normale
 * ou classée, et rien de plus pour le vainqueur. Seule une présence vérifiée (scan ou pointage) compte.
 */
export const XP_PER_PRESENCE = 50
/** Room dans un lieu partenaire où le joueur a sa venue du soir. */
export const XP_PARTNER_BONUS = 25
/** Anti-farm : au plus 3 rooms rapportent de l'XP par soirée. */
export const XP_ROOMS_PER_EVENING = 3

export const XP_BONUSES = ['PARTNER'] as const
export type XpBonus = (typeof XP_BONUSES)[number]
export const XP_BONUS_LABELS: Record<XpBonus, string> = { PARTNER: 'Lieu partenaire' }

// ponytail: bonus soirs creux à ajouter avec les créneaux des lieux (« Remplir ce soir », LKO-93)
export function presenceXp({ partnerVisit }: { partnerVisit: boolean }) {
  const bonuses: XpBonus[] = partnerVisit ? ['PARTNER'] : []
  return { amount: XP_PER_PRESENCE + (partnerVisit ? XP_PARTNER_BONUS : 0), bonuses }
}

export function xpLevel(xp: number) {
  const level = Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1
  return {
    level,
    name: XP_LEVEL_NAMES[Math.min(level, XP_LEVEL_NAMES.length) - 1] ?? XP_LEVEL_NAMES[0],
    current: Math.max(0, xp) % XP_PER_LEVEL,
    max: XP_PER_LEVEL,
  }
}
