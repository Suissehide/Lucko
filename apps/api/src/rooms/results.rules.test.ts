import { describe, expect, it } from 'vitest'
import {
  majorityReached,
  placementsRefusal,
  resultDeadline,
  submitRefusal,
  voteRefusal,
} from './results.rules'

const H = 60 * 60 * 1000
const startsAt = new Date('2026-10-10T18:00:00Z')
const ranked = { mode: 'RANKED', kind: 'TCG', status: 'CONFIRMED', startsAt } as const
const afterEnd = new Date(startsAt.getTime() + 4 * H)
const present = ['a', 'b', 'c']

describe('saisie du résultat', () => {
  it('ouverte à un présent, à la fin d’une room TCG classée', () => {
    expect(submitRefusal(ranked, present, 'a', afterEnd)).toBeNull()
  })

  it('aucun résultat pour une room normale ou de jeu de société', () => {
    expect(submitRefusal({ ...ranked, mode: 'CASUAL' }, present, 'a', afterEnd)).toMatch(/normale/)
    expect(submitRefusal({ ...ranked, kind: 'BOARD_GAME' }, present, 'a', afterEnd)).toMatch(
      /normale/,
    )
  })

  it('refuse un joueur absent, une partie pas finie ou le délai de 48 h dépassé', () => {
    expect(submitRefusal(ranked, present, 'z', afterEnd)).toMatch(/présents/)
    expect(submitRefusal(ranked, present, 'a', new Date(startsAt.getTime() + H))).toMatch(/fin/)
    const late = new Date(resultDeadline(startsAt).getTime() + 1)
    expect(submitRefusal(ranked, present, 'a', late)).toMatch(/Délai/)
    expect(submitRefusal({ ...ranked, status: 'CANCELLED' }, present, 'a', afterEnd)).toMatch(
      /annulée/,
    )
  })

  it('le classement compte tous les présents, et le score d’un duel le respecte', () => {
    const duel = [
      { userId: 'a', place: 1 },
      { userId: 'b', place: 2 },
    ]
    expect(placementsRefusal(duel, ['a', 'b'], '2-1')).toBeNull()
    expect(placementsRefusal(duel, ['a', 'b'], '1-2')).toMatch(/score/)
    expect(placementsRefusal(duel, present)).toMatch(/tous/)
    expect(placementsRefusal([...duel, { userId: 'c', place: 3 }], present, '2-0')).toMatch(/duel/)
  })
})

describe('confirmation', () => {
  it('majorité atteinte, non atteinte, égalité', () => {
    expect(majorityReached(2, 3)).toBe(true)
    expect(majorityReached(1, 3)).toBe(false)
    expect(majorityReached(2, 4)).toBe(false)
  })

  it('en duel il faut l’accord de l’adversaire', () => {
    expect(majorityReached(1, 2)).toBe(false)
    expect(majorityReached(2, 2)).toBe(true)
  })

  it('un absent ne vote pas, ni deux fois ; on peut s’ajouter à une contestation', () => {
    expect(voteRefusal('PENDING', false, false, false)).toMatch(/présents/)
    expect(voteRefusal('PENDING', true, true, false)).toMatch(/déjà/)
    expect(voteRefusal('DISPUTED', true, false, true)).toBeNull()
    expect(voteRefusal('DISPUTED', true, false, false)).toMatch(/trancher/)
    expect(voteRefusal('CONFIRMED', true, false, true)).toMatch(/plus/)
  })
})
