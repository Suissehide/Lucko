import { nextRatings, RATING_FLOOR, ratingReliability } from '@lucko/shared'
import type { Prisma } from '../generated/prisma/client'

export type RatingResult = {
  formatId: string
  /** Room classée d'origine ; absent pour un tournoi */
  roomId?: string
  /** RATING_TOURNAMENT_WEIGHT pour un tournoi classé */
  weight?: number
  /** Place finale de chaque joueur (1 = vainqueur, places égales = nul) */
  placements: { userId: string; place: number }[]
}

/**
 * Applique un résultat classé confirmé aux LK des joueurs (LKO-86, archi §13) : nouveaux
 * LK, parties classées, fiabilité, et une ligne d'historique par joueur. À appeler dans la
 * transaction qui confirme le résultat (rooms classées : LKO-83 ; tournois ensuite).
 */
export async function applyRatingResult(
  tx: Prisma.TransactionClient,
  { formatId, roomId, weight, placements }: RatingResult,
) {
  const userIds = placements.map((p) => p.userId)
  if (userIds.length < 2 || new Set(userIds).size !== userIds.length)
    throw new Error('Un résultat classé exige au moins deux joueurs distincts')

  // ponytail: tout l'historique est relu pour compter les adversaires distincts ; colonne dédiée si ça grossit
  const players = await Promise.all(
    placements.map(async ({ userId, place }) => ({
      place,
      // Joueur sans profil sur ce format (questionnaire non rempli) : départ à 1000
      profile: await tx.playerGameProfile.upsert({
        where: { userId_formatId: { userId, formatId } },
        create: { userId, formatId },
        update: {},
        include: { history: { select: { opponentIds: true } } },
      }),
    })),
  )
  const ratings = nextRatings(
    players.map(({ profile, place }) => ({ ...profile, place })),
    weight,
  )
  await Promise.all(
    players.map(({ profile, place }, i) => {
      const rating = ratings[i] ?? profile.rating
      const opponentIds = userIds.filter((id) => id !== profile.userId)
      const opponents = new Set([...profile.history.flatMap((h) => h.opponentIds), ...opponentIds])
      const rankedGames = profile.rankedGames + 1
      return tx.playerGameProfile.update({
        where: { id: profile.id },
        data: {
          rating,
          rankedGames,
          reliabilityPct: ratingReliability(rankedGames, opponents.size),
          history: {
            create: {
              roomId,
              ratingBefore: profile.rating,
              ratingAfter: rating,
              place,
              opponentIds,
            },
          },
        },
      })
    }),
  )
  return ratings
}

/**
 * Annule l'effet d'une room classée sur les LK (résultat annulé par un admin, LKO-83) : chaque joueur
 * reprend l'écart gagné ou perdu, une partie classée de moins, et la ligne d'historique disparaît.
 */
// ponytail: les parties jouées depuis ne sont pas recalculées ; rejouer l'historique si l'écart compte
export async function revertRatingResult(tx: Prisma.TransactionClient, roomId: string) {
  const changes = await tx.ratingChange.findMany({
    where: { roomId },
    include: { profile: { include: { history: { select: { id: true, opponentIds: true } } } } },
  })
  for (const { id, profile, ratingBefore, ratingAfter } of changes) {
    const rankedGames = Math.max(0, profile.rankedGames - 1)
    const opponents = new Set(
      profile.history.filter((h) => h.id !== id).flatMap((h) => h.opponentIds),
    )
    await tx.playerGameProfile.update({
      where: { id: profile.id },
      data: {
        rating: Math.max(RATING_FLOOR, profile.rating - (ratingAfter - ratingBefore)),
        rankedGames,
        reliabilityPct: ratingReliability(rankedGames, opponents.size),
        history: { delete: { id } },
      },
    })
  }
}
