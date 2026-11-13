import { describe, expect, it } from 'vitest'
import { groupCities, periodStart } from './waitlist.rules'

describe('groupCities', () => {
  it('fusionne les villes sans tenir compte des majuscules ni des espaces', () => {
    expect(
      groupCities([
        { city: 'Bordeaux', count: 3 },
        { city: 'bordeaux ', count: 1 },
        { city: 'Lyon', count: 2 },
      ]),
    ).toEqual([
      { city: 'Bordeaux', count: 4 },
      { city: 'Lyon', count: 2 },
    ])
  })

  it("garde l'orthographe la plus fréquente", () => {
    expect(
      groupCities([
        { city: 'LILLE', count: 1 },
        { city: 'Lille', count: 2 },
      ]),
    ).toEqual([{ city: 'Lille', count: 3 }])
  })

  it('regroupe les inscrits sans ville en dernier à égalité', () => {
    expect(
      groupCities([
        { city: null, count: 2 },
        { city: '  ', count: 1 },
        { city: 'Pau', count: 3 },
      ]),
    ).toEqual([
      { city: 'Pau', count: 3 },
      { city: null, count: 3 },
    ])
  })
})

describe('periodStart', () => {
  const now = new Date('2026-11-13T10:00:00Z')

  it('remonte de 7 ou 30 jours, ou ne limite pas', () => {
    expect(periodStart('7d', now)?.toISOString()).toBe('2026-11-06T10:00:00.000Z')
    expect(periodStart('30d', now)?.toISOString()).toBe('2026-10-14T10:00:00.000Z')
    expect(periodStart('all', now)).toBeNull()
  })
})
