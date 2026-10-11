import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { businessDate } from '../checkin/qr.rules'
import type { Prisma, VisitStatus } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { disputeRefusal, monthRange, visitBilling } from './billing.rules'

type Db = Prisma.TransactionClient | PrismaService

const isoDate = (date: Date) => date.toISOString().slice(0, 10)

/**
 * Venues facturables (LKO-79). Créées uniquement côté serveur, par le scan du QR (LKO-77) ou le pointage
 * (LKO-78) : `visitFields` donne leurs champs de facturation ; la contrainte unique (joueur, lieu, soirée)
 * garantit un seul forfait même si le joueur est scanné puis pointé.
 */
// ponytail: pas de table de contrats ni de factures : le prix est figé sur la venue, l'agrégation mensuelle
// se fait sur ces lignes ; alertes anti-fraude (volumes anormaux) à ajouter avec les premiers lieux payants
@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async visitFields(db: Db, venueId: string, userId: string) {
    const [venue, staff] = await Promise.all([
      db.venue.findUniqueOrThrow({
        where: { id: venueId },
        select: { isPartner: true, pricePerVisitCents: true },
      }),
      db.venueStaff.findUnique({ where: { userId_venueId: { userId, venueId } } }),
    ])
    return visitBilling(venue, staff !== null)
  }

  /** Back-office lieu : venues facturables du mois et total prévisionnel (venues valides). */
  async venueVisits(venueId: string, month = businessDate().slice(0, 7)) {
    const today = businessDate()
    const [venue, visits] = await Promise.all([
      this.prisma.venue.findUnique({
        where: { id: venueId },
        select: { pricePerVisitCents: true },
      }),
      this.prisma.visit.findMany({
        where: { venueId, billable: true, businessDate: monthRange(month) },
        orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
        include: { user: { select: { pseudo: true } } },
      }),
    ])
    if (!venue) throw new NotFoundException('Lieu introuvable')
    const valid = visits.filter((v) => v.status === 'VALID')
    return {
      month,
      pricePerVisitCents: venue.pricePerVisitCents,
      visits: visits.map((v) => {
        const date = isoDate(v.businessDate)
        return {
          id: v.id,
          businessDate: date,
          pseudo: v.user.pseudo,
          source: v.source,
          priceCents: v.priceCents,
          status: v.status,
          disputeReason: v.disputeReason,
          disputeRefused: disputeRefusal({ ...v, businessDate: date }, today),
        }
      }),
      validCount: valid.length,
      disputedCount: visits.filter((v) => v.status === 'DISPUTED').length,
      totalCents: valid.reduce((sum, v) => sum + (v.priceCents ?? 0), 0),
    }
  }

  /** Le lieu conteste une venue, avec un motif ; un admin tranche ensuite. */
  async dispute(venueId: string, visitId: string, reason: string) {
    const visit = await this.prisma.visit.findFirst({ where: { id: visitId, venueId } })
    if (!visit) throw new NotFoundException('Venue introuvable')
    const refused = disputeRefusal(
      { ...visit, businessDate: isoDate(visit.businessDate) },
      businessDate(),
    )
    if (refused) throw new ConflictException(refused)
    await this.prisma.visit.update({
      where: { id: visitId },
      data: { status: 'DISPUTED', disputeReason: reason, disputedAt: new Date() },
    })
  }

  /** Admin : garder (VALID) ou annuler une venue, contestée ou non. */
  async decide(visitId: string, status: Extract<VisitStatus, 'VALID' | 'CANCELLED'>) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } })
    if (!visit) throw new NotFoundException('Venue introuvable')
    if (!visit.billable) throw new ConflictException('Cette venue n’est pas facturée')
    await this.prisma.visit.update({ where: { id: visitId }, data: { status } })
  }
}
