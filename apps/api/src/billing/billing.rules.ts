import { addDays, DISPUTE_DAYS } from '@lucko/shared'

/**
 * Venue facturable (LKO-79, archi §11) : 1 forfait par joueur, par lieu et par soirée (unicité en base),
 * seulement dans un lieu partenaire et jamais pour le staff du lieu. Prix figé au tarif du moment.
 * Les rooms à domicile n'ont pas de lieu : elles ne créent jamais de venue.
 */
export function visitBilling(
  venue: { isPartner: boolean; pricePerVisitCents: number | null },
  playerIsStaff: boolean,
) {
  const billable = venue.isPartner && !playerIsStaff
  return { billable, priceCents: billable ? venue.pricePerVisitCents : null }
}

/** Le lieu conteste une venue : motif de refus, ou null. `today` = soirée en cours (date locale). */
export function disputeRefusal(
  visit: { billable: boolean; status: string; businessDate: string },
  today: string,
): string | null {
  if (!visit.billable) return 'Cette venue n’est pas facturée'
  if (visit.status === 'DISPUTED') return 'Venue déjà contestée : Lucko va trancher'
  if (visit.status === 'CANCELLED') return 'Venue annulée'
  if (today > addDays(visit.businessDate, DISPUTE_DAYS))
    return `Contestation possible jusqu’à ${DISPUTE_DAYS} jours après la soirée`
  return null
}

/** Bornes d'un mois « 2026-10 » pour une colonne date : [1er du mois, 1er du mois suivant[. */
export function monthRange(month: string) {
  const [year = 0, m = 1] = month.split('-').map(Number)
  return { gte: new Date(Date.UTC(year, m - 1, 1)), lt: new Date(Date.UTC(year, m, 1)) }
}
