import { describe, expect, it } from 'vitest'
import { capacityRefusal, freePlaces } from './event-capacity'

describe('capacité d’un événement (LKO-152)', () => {
  it('jamais sous le nombre d’inscrits', () => {
    expect(capacityRefusal(2, 5)).toMatch(/5 joueurs/)
    expect(capacityRefusal(5, 5)).toBeNull()
    expect(capacityRefusal(null, 5)).toBeNull()
  })

  it('places libres : aucune au-delà de la capacité', () => {
    expect(freePlaces(2, 4)).toBe(0)
    expect(freePlaces(12, 4)).toBe(8)
    expect(freePlaces(null, 4)).toBeNull()
  })
})
