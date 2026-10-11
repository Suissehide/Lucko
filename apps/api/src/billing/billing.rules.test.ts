import { describe, expect, it } from 'vitest'
import { disputeRefusal, monthRange, visitBilling } from './billing.rules'

describe('visitBilling', () => {
  const partner = { isPartner: true, pricePerVisitCents: 150 }

  it('lieu partenaire : facturable au forfait du moment', () => {
    expect(visitBilling(partner, false)).toEqual({ billable: true, priceCents: 150 })
  })

  it('lieu non partenaire ou staff du lieu : pas facturé', () => {
    expect(visitBilling({ ...partner, isPartner: false }, false)).toEqual({
      billable: false,
      priceCents: null,
    })
    expect(visitBilling(partner, true).billable).toBe(false)
  })
})

describe('disputeRefusal', () => {
  const visit = { billable: true, status: 'VALID', businessDate: '2026-10-01' }

  it('contestable 14 jours après la soirée', () => {
    expect(disputeRefusal(visit, '2026-10-15')).toBeNull()
    expect(disputeRefusal(visit, '2026-10-16')).toMatch(/14 jours/)
  })

  it('une seule contestation, rien sur une venue annulée ou gratuite', () => {
    expect(disputeRefusal({ ...visit, status: 'DISPUTED' }, '2026-10-02')).toMatch(/déjà/)
    expect(disputeRefusal({ ...visit, status: 'CANCELLED' }, '2026-10-02')).toMatch(/annulée/)
    expect(disputeRefusal({ ...visit, billable: false }, '2026-10-02')).toMatch(/pas facturée/)
  })
})

describe('monthRange', () => {
  it('du 1er au 1er du mois suivant, décembre compris', () => {
    expect(monthRange('2026-12')).toEqual({
      gte: new Date('2026-12-01T00:00:00Z'),
      lt: new Date('2027-01-01T00:00:00Z'),
    })
  })
})
