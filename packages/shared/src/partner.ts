/**
 * Lieu proposé par défaut à la création d'une room (LKO-92) : le partenaire le plus proche, ouvert au
 * créneau choisi (ou sans horaires) et dans le rayon du joueur. Le joueur garde le choix du lieu.
 */
// ponytail: pas de filtre par jeu, les lieux ne déclarent pas encore leurs jeux ; à ajouter avec eux
export function suggestedVenue<
  V extends { id: string; isPartner: boolean; openNow: boolean | null; distanceMeters: number },
>(venues: V[], radiusKm: number): V | undefined {
  return venues
    .filter((v) => v.isPartner && v.openNow !== false && v.distanceMeters <= radiusKm * 1000)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0]
}
