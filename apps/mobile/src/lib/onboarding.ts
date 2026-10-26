import type { Game } from '@lucko/shared'

/** « Je regarde d'abord » : l'accueil ne renvoie plus vers l'onboarding jusqu'au prochain lancement. */
export const onboarding = { deferred: false }

// ponytail: ordre fixe de la maquette ; à trier par nombre de joueurs dans la ville quand l'API le donnera
// Yu-Gi-Oh! et les jeux de société d'emblée, pas derrière « Autre jeu… » (LKO-162)
const FEATURED = [
  'magic',
  'pokemon',
  'lorcana',
  'one-piece',
  'yugioh',
  'jeux-de-societe',
  'flesh-and-blood',
]

/** Les `count` jeux montrés d'emblée, puis le reste du catalogue (recherche « Autre jeu… »). */
export function splitCatalog(catalog: Game[], count = 7) {
  const rank = (g: Game) => {
    const i = FEATURED.indexOf(g.slug)
    return i === -1 ? FEATURED.length : i
  }
  const sorted = [...catalog].sort((a, b) => rank(a) - rank(b))
  return { featured: sorted.slice(0, count), others: sorted.slice(count) }
}

export const nearbyLabel = ({ venues, events }: { venues: number; events: number }) =>
  `${venues} ${venues > 1 ? 'lieux' : 'lieu'} · ${events} ${events > 1 ? 'soirées' : 'soirée'} cette semaine`
