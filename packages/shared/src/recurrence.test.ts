import { describe, expect, it } from 'vitest'
import { fromLocalDateTime } from './opening'
import { describeRecurrence, occurrenceDates, parseRrule, toRrule } from './recurrence'

// Vendredi 2 octobre 2026
const friday = '2026-10-02'

describe('toRrule / parseRrule', () => {
  it('aller-retour, jour pris sur la première date', () => {
    const weekly = toRrule({ freq: 'WEEKLY', interval: 2 }, friday)
    expect(weekly).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=FR')
    expect(parseRrule(weekly)).toEqual({ recurrence: { freq: 'WEEKLY', interval: 2 }, weekday: 5 })
    const last = toRrule({ freq: 'MONTHLY', nth: -1 }, friday)
    expect(last).toBe('FREQ=MONTHLY;BYDAY=-1FR')
    expect(parseRrule(last)).toEqual({ recurrence: { freq: 'MONTHLY', nth: -1 }, weekday: 5 })
  })

  it('refuse une règle hors du sous-ensemble', () => {
    expect(parseRrule('FREQ=DAILY')).toBeNull()
    expect(parseRrule('FREQ=MONTHLY;BYDAY=5FR')).toBeNull()
  })
})

describe('occurrenceDates', () => {
  it('chaque semaine, à partir de la première date', () => {
    expect(
      occurrenceDates('FREQ=WEEKLY;INTERVAL=1;BYDAY=FR', friday, {
        from: '2026-09-01',
        to: '2026-10-24',
      }),
    ).toEqual(['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23'])
  })

  it('une semaine sur deux, fenêtre qui commence au milieu de la série', () => {
    // Le 16 est dans la série (2 + 14), le 9 non
    expect(
      occurrenceDates('FREQ=WEEKLY;INTERVAL=2;BYDAY=FR', friday, {
        from: '2026-10-05',
        to: '2026-11-14',
      }),
    ).toEqual(['2026-10-16', '2026-10-30', '2026-11-13'])
  })

  it('1er vendredi et dernier vendredi du mois', () => {
    const window = { from: '2026-10-01', to: '2027-01-01' }
    expect(occurrenceDates('FREQ=MONTHLY;BYDAY=1FR', friday, window)).toEqual([
      '2026-10-02',
      '2026-11-06',
      '2026-12-04',
    ])
    expect(occurrenceDates('FREQ=MONTHLY;BYDAY=-1FR', friday, window)).toEqual([
      '2026-10-30',
      '2026-11-27',
      '2026-12-25',
    ])
  })

  it('s’arrête à la date de fin (incluse)', () => {
    expect(
      occurrenceDates('FREQ=WEEKLY;INTERVAL=1;BYDAY=FR', friday, {
        from: friday,
        to: '2027-01-01',
        until: '2026-10-16',
      }),
    ).toEqual(['2026-10-02', '2026-10-09', '2026-10-16'])
  })

  it('garde 20 h à Paris de part et d’autre du changement d’heure (25 octobre 2026)', () => {
    const dates = occurrenceDates('FREQ=WEEKLY;INTERVAL=1;BYDAY=FR', '2026-10-23', {
      from: '2026-10-23',
      to: '2026-10-31',
    })
    expect(dates.map((d) => fromLocalDateTime(d, 20 * 60).toISOString())).toEqual([
      '2026-10-23T18:00:00.000Z',
      '2026-10-30T19:00:00.000Z',
    ])
  })
})

describe('describeRecurrence', () => {
  it('libellés affichés au gérant et au joueur', () => {
    expect(describeRecurrence({ freq: 'WEEKLY', interval: 1 }, friday)).toBe('Chaque vendredi')
    expect(describeRecurrence({ freq: 'WEEKLY', interval: 2 }, friday)).toBe('Un vendredi sur deux')
    expect(describeRecurrence({ freq: 'MONTHLY', nth: 1 }, friday)).toBe('Le 1er vendredi du mois')
    expect(describeRecurrence({ freq: 'MONTHLY', nth: -1 }, friday)).toBe(
      'Le dernier vendredi du mois',
    )
  })
})
