import type { PrismaClient } from '../src/generated/prisma/client'

type SeedFormat = {
  slug: string
  name: string
  /** Joueurs par partie ; un duel par défaut. */
  players?: [number, number]
  /** Durée moyenne d'une partie, en minutes. */
  minutes: number
  brackets?: true
}

/** Catalogue (LKO-52) : jeux, formats, joueurs par partie et durée moyenne. Jeux de société : 2 à 8. */
const games: {
  slug: string
  name: string
  kind: 'TCG' | 'BOARD_GAME'
  players?: [number, number]
  formats: SeedFormat[]
}[] = [
  {
    slug: 'magic',
    name: 'Magic: The Gathering',
    kind: 'TCG',
    formats: [
      { slug: 'commander', name: 'Commander', players: [2, 5], minutes: 90, brackets: true },
      { slug: 'modern', name: 'Modern', minutes: 50 },
      { slug: 'pioneer', name: 'Pioneer', minutes: 50 },
      { slug: 'standard', name: 'Standard', minutes: 50 },
      { slug: 'pauper', name: 'Pauper', minutes: 45 },
      { slug: 'legacy', name: 'Legacy', minutes: 50 },
      { slug: 'draft', name: 'Draft', players: [6, 8], minutes: 180 },
    ],
  },
  {
    slug: 'pokemon',
    name: 'Pokémon JCC',
    kind: 'TCG',
    formats: [
      { slug: 'standard', name: 'Standard', minutes: 40 },
      { slug: 'expanded', name: 'Étendu', minutes: 40 },
    ],
  },
  {
    slug: 'one-piece',
    name: 'One Piece Card Game',
    kind: 'TCG',
    formats: [{ slug: 'standard', name: 'Standard', minutes: 40 }],
  },
  {
    slug: 'lorcana',
    name: 'Disney Lorcana',
    kind: 'TCG',
    formats: [
      { slug: 'core', name: 'Core', minutes: 40 },
      { slug: 'infinity', name: 'Infinity', minutes: 40 },
    ],
  },
  {
    slug: 'yugioh',
    name: 'Yu-Gi-Oh!',
    kind: 'TCG',
    formats: [{ slug: 'advanced', name: 'Advanced', minutes: 45 }],
  },
  {
    slug: 'riftbound',
    name: 'Riftbound',
    kind: 'TCG',
    formats: [{ slug: 'standard', name: 'Standard', minutes: 45 }],
  },
  {
    slug: 'flesh-and-blood',
    name: 'Flesh and Blood',
    kind: 'TCG',
    formats: [
      { slug: 'classic-constructed', name: 'Classic Constructed', minutes: 50 },
      { slug: 'blitz', name: 'Blitz', minutes: 30 },
    ],
  },
  {
    slug: 'star-wars-unlimited',
    name: 'Star Wars: Unlimited',
    kind: 'TCG',
    formats: [{ slug: 'premier', name: 'Premier', minutes: 40 }],
  },
  {
    slug: 'altered',
    name: 'Altered',
    kind: 'TCG',
    formats: [{ slug: 'standard', name: 'Standard', minutes: 45 }],
  },
  {
    slug: 'digimon',
    name: 'Digimon Card Game',
    kind: 'TCG',
    formats: [{ slug: 'standard', name: 'Standard', minutes: 40 }],
  },
  {
    slug: 'dragon-ball-fusion-world',
    name: 'Dragon Ball Super Fusion World',
    kind: 'TCG',
    formats: [{ slug: 'standard', name: 'Standard', minutes: 35 }],
  },
  {
    slug: 'gundam',
    name: 'Gundam Card Game',
    kind: 'TCG',
    formats: [{ slug: 'standard', name: 'Standard', minutes: 35 }],
  },
  {
    slug: 'jeux-de-societe',
    name: 'Jeux de société',
    kind: 'BOARD_GAME',
    players: [2, 8],
    formats: [],
  },
]

/** Idempotent : met à jour les jeux et formats existants par slug, sans rien supprimer. */
export async function seedGames(prisma: PrismaClient) {
  for (const { formats, players, ...game } of games) {
    const data = { ...game, ...(players && { minPlayers: players[0], maxPlayers: players[1] }) }
    const saved = await prisma.game.upsert({
      where: { slug: game.slug },
      update: data,
      create: data,
    })
    for (const { slug, name, players: [min, max] = [2, 2], minutes, brackets } of formats) {
      const format = {
        name,
        minPlayers: min,
        maxPlayers: max,
        durationMinutes: minutes,
        hasBrackets: !!brackets,
      }
      await prisma.gameFormat.upsert({
        where: { gameId_slug: { gameId: saved.id, slug } },
        update: format,
        create: { slug, gameId: saved.id, ...format },
      })
    }
  }
}
