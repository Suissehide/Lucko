import type { RankPlayer } from '@lucko/design-system'
import type { Placements, RoomResult } from '@lucko/shared'
import { authorColor } from './chat'

// Résultats des rooms classées (LKO-83) : mise en forme pour l'écran Résultat et l'arbitrage.

type Player = RoomResult['players'][number]

export const rankPlayers = (players: Player[]): RankPlayer[] =>
  players.map((p) => ({
    id: p.userId,
    pseudo: p.pseudo ?? 'Joueur',
    rating: p.rating,
    color: authorColor(p.userId),
    avatarUri: p.avatarUrl,
  }))

/** Classement d'après l'ordre de RankPicker (pas d'égalité en multijoueur). */
export const orderPlacements = (order: string[]): Placements =>
  order.map((userId, i) => ({ userId, place: i + 1 }))

/** Lignes d'un classement : place, pseudo, ex aequo signalés. */
export function rankingRows(placements: Placements, players: Player[]) {
  const pseudo = (id: string) => players.find((p) => p.userId === id)?.pseudo ?? 'Joueur'
  return [...placements]
    .sort((a, b) => a.place - b.place)
    .map((p) => ({
      userId: p.userId,
      title: `${p.place}. ${pseudo(p.userId)}`,
      tie: placements.filter((o) => o.place === p.place).length > 1,
    }))
}

/** Ligne d'état du résultat pour les joueurs. */
export function resultStatusText(result: NonNullable<RoomResult['result']>, deadline: string) {
  const day = new Date(deadline).toLocaleString('fr-FR', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
  switch (result.status) {
    case 'PENDING':
      return `${result.accepted}/${result.needed} confirmations · validé d’office ${day} sans contestation`
    case 'DISPUTED':
      return 'Contesté : le lieu partenaire ou Lucko va trancher'
    case 'CONFIRMED':
      return 'Validé : les LK sont à jour'
    case 'RESOLVED':
      return `Tranché : ${result.decisionReason ?? ''}`
    case 'VOID':
      return `Sans résultat${result.decisionReason ? ` : ${result.decisionReason}` : ''}`
  }
}
