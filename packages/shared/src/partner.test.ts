import { describe, expect, it } from 'vitest'
import { suggestedVenue } from './partner'

const venue = (
  id: string,
  isPartner: boolean,
  distanceMeters: number,
  openNow: boolean | null = true,
) => ({
  id,
  isPartner,
  distanceMeters,
  openNow,
})

describe('suggestedVenue (LKO-92)', () => {
  it('propose le partenaire ouvert le plus proche, même derrière un lieu non partenaire', () => {
    const venues = [venue('bar', false, 200), venue('loin', true, 3000), venue('pres', true, 900)]
    expect(suggestedVenue(venues, 10)?.id).toBe('pres')
  })

  it('ignore un partenaire fermé au créneau, accepte un lieu sans horaires', () => {
    expect(
      suggestedVenue([venue('ferme', true, 100, false), venue('sans', true, 500, null)], 10)?.id,
    ).toBe('sans')
  })

  it('ne propose rien hors du rayon du joueur ou sans partenaire', () => {
    expect(suggestedVenue([venue('loin', true, 12_000)], 10)).toBeUndefined()
    expect(suggestedVenue([venue('bar', false, 100)], 10)).toBeUndefined()
  })
})
