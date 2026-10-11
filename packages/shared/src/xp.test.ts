import { describe, expect, it } from 'vitest'
import { presenceXp, XP_LEVEL_NAMES, XP_PARTNER_BONUS, XP_PER_PRESENCE, xpLevel } from './xp'

describe('niveaux d’XP', () => {
  it('progression dans le niveau', () => {
    expect(xpLevel(0)).toEqual({ level: 1, name: 'Recrue', current: 0, max: 500 })
    expect(xpLevel(1840)).toMatchObject({ level: 4, current: 340 })
    expect(xpLevel(500)).toMatchObject({ level: 2, current: 0 })
  })

  it('le dernier palier se répète au-delà', () => {
    expect(xpLevel(100_000).name).toBe(XP_LEVEL_NAMES.at(-1))
  })
})

describe('XP de participation', () => {
  it('la même pour tous, bonus seulement dans un lieu partenaire', () => {
    expect(presenceXp({ partnerVisit: false })).toEqual({ amount: XP_PER_PRESENCE, bonuses: [] })
    expect(presenceXp({ partnerVisit: true })).toEqual({
      amount: XP_PER_PRESENCE + XP_PARTNER_BONUS,
      bonuses: ['PARTNER'],
    })
  })
})
