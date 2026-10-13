import { describe, expect, it } from 'vitest'
import { duelPlacements, placementsSchema, resultMajority } from './results'

describe('résultats des rooms classées', () => {
  it('majorité : plus de la moitié des présents', () => {
    expect(resultMajority(2)).toBe(2)
    expect(resultMajority(3)).toBe(2)
    expect(resultMajority(4)).toBe(3)
  })

  it('duel : le score donne le classement', () => {
    expect(duelPlacements(['a', 'b'], '2-1')).toEqual([
      { userId: 'a', place: 1 },
      { userId: 'b', place: 2 },
    ])
    expect(duelPlacements(['a', 'b'], '0-1')).toEqual([
      { userId: 'a', place: 2 },
      { userId: 'b', place: 1 },
    ])
    expect(duelPlacements(['a', 'b'], 'Nul').map((p) => p.place)).toEqual([1, 1])
  })

  it('refuse un joueur classé deux fois ou un classement sans premier', () => {
    const twice = [
      { userId: 'a', place: 1 },
      { userId: 'a', place: 2 },
    ]
    expect(placementsSchema.safeParse(twice).success).toBe(false)
    const noWinner = [
      { userId: 'a', place: 2 },
      { userId: 'b', place: 3 },
    ]
    expect(placementsSchema.safeParse(noWinner).success).toBe(false)
  })
})
