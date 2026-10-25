import { describe, expect, it } from 'vitest'
import {
  addMonths,
  agendaRangeDays,
  type ClosureRange,
  fromLocalDateTime,
  localDateTime,
  monthGrid,
  openingStatus,
  openWithEvents,
  rangesOn,
} from './opening'

// Bar : mardi → samedi 17 h - 1 h ; boutique : dimanche 14 h - 20 h
const bar = [2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  opensAtMinute: 17 * 60,
  closesAtMinute: 60,
}))
const sunday = [{ weekday: 7, opensAtMinute: 14 * 60, closesAtMinute: 20 * 60 }]

describe('localDateTime', () => {
  it("donne la date, le jour et l'heure de Paris, pas ceux du serveur", () => {
    // mardi 6 octobre 2026, 23 h 30 UTC = mercredi 7 à 1 h 30 à Paris
    expect(localDateTime(new Date('2026-10-06T23:30:00Z'))).toEqual({
      date: '2026-10-07',
      weekday: 3,
      minute: 90,
    })
  })
})

describe('openingStatus', () => {
  it('ouvert le soir, avec fermeture après minuit', () => {
    // mardi 6 octobre 2026, 21 h à Paris
    expect(openingStatus(bar, [], new Date('2026-10-06T19:00:00Z'))).toEqual({
      openNow: true,
      closesAtMinute: 60,
      nextOpening: null,
    })
  })

  it('toujours ouvert après minuit grâce à la plage de la veille', () => {
    // mercredi 0 h 30 à Paris (plage du mardi)
    expect(openingStatus(bar, [], new Date('2026-10-06T22:30:00Z')).openNow).toBe(true)
  })

  it('fermé après la fermeture et le lundi, avec la prochaine ouverture', () => {
    // mercredi 2 h à Paris : rouvre le jour même à 17 h
    expect(openingStatus(bar, [], new Date('2026-10-07T00:00:00Z'))).toEqual({
      openNow: false,
      closesAtMinute: null,
      nextOpening: { date: '2026-10-07', minute: 17 * 60 },
    })
    // lundi 21 h à Paris (dimanche soir ne déborde pas) : rouvre mardi
    expect(openingStatus(bar, [], new Date('2026-10-05T19:00:00Z')).nextOpening).toEqual({
      date: '2026-10-06',
      minute: 17 * 60,
    })
  })

  it('plage simple et horaires absents', () => {
    expect(openingStatus(sunday, [], new Date('2026-10-04T13:00:00Z')).openNow).toBe(true) // dim. 15 h
    expect(openingStatus(sunday, [], new Date('2026-10-04T19:00:00Z')).openNow).toBe(false) // dim. 21 h
    expect(openingStatus([], [], new Date())).toEqual({
      openNow: null,
      closesAtMinute: null,
      nextOpening: null,
    })
  })

  it('une fermeture exceptionnelle ferme le lieu et repousse la prochaine ouverture', () => {
    const holidays: ClosureRange[] = [
      {
        startsOn: '2026-10-06',
        endsOn: '2026-10-07',
        kind: 'CLOSED',
        opensAtMinute: null,
        closesAtMinute: null,
      },
    ]
    // mardi 21 h, normalement ouvert
    expect(openingStatus(bar, holidays, new Date('2026-10-06T19:00:00Z'))).toEqual({
      openNow: false,
      closesAtMinute: null,
      nextOpening: { date: '2026-10-08', minute: 17 * 60 },
    })
  })

  it('des horaires modifiés remplacent ceux de la semaine', () => {
    const special: ClosureRange[] = [
      {
        startsOn: '2026-11-11',
        endsOn: '2026-11-11',
        kind: 'SPECIAL_HOURS',
        opensAtMinute: 14 * 60,
        closesAtMinute: 2 * 60,
      },
    ]
    expect(rangesOn('2026-11-11', bar, special)).toEqual([
      { opensAtMinute: 14 * 60, closesAtMinute: 2 * 60 },
    ])
    // mercredi 11 novembre, 15 h à Paris (heure d'hiver)
    expect(openingStatus(bar, special, new Date('2026-11-11T14:00:00Z')).openNow).toBe(true)
  })
})

describe('monthGrid', () => {
  it('commence un lundi et complète la dernière semaine', () => {
    // 1er octobre 2026 : un jeudi
    const october = monthGrid('2026-10')
    expect(october).toHaveLength(35)
    expect(october.slice(0, 4)).toEqual([null, null, null, '2026-10-01'])
    expect(october[33]).toBe('2026-10-31')
    expect(october[34]).toBeNull()
    expect(addMonths('2026-11', 2)).toBe('2027-01')
  })
})

describe('fromLocalDateTime', () => {
  it("garde l'heure de Paris de part et d'autre du passage à l'heure d'hiver", () => {
    expect(fromLocalDateTime('2026-10-24', 19 * 60).toISOString()).toBe('2026-10-24T17:00:00.000Z')
    expect(fromLocalDateTime('2026-10-31', 19 * 60).toISOString()).toBe('2026-10-31T18:00:00.000Z')
  })
})

describe('agendaRangeDays', () => {
  // Mercredi 7 octobre 2026, 23 h 30 à Paris (21 h 30 UTC)
  const wednesday = new Date('2026-10-07T21:30:00Z')

  it('ce soir et demain suivent la date de Paris, pas celle UTC', () => {
    expect(agendaRangeDays('tonight', new Date('2026-10-07T22:30:00Z'))).toEqual(['2026-10-08'])
    expect(agendaRangeDays('tomorrow', wednesday)).toEqual(['2026-10-08'])
  })

  it('ce week-end : samedi et dimanche à venir, ou ce qu’il en reste', () => {
    expect(agendaRangeDays('weekend', wednesday)).toEqual(['2026-10-10', '2026-10-11'])
    expect(agendaRangeDays('weekend', new Date('2026-10-10T10:00:00Z'))).toEqual([
      '2026-10-10',
      '2026-10-11',
    ])
    expect(agendaRangeDays('weekend', new Date('2026-10-11T10:00:00Z'))).toEqual(['2026-10-11'])
  })

  it('7 jours à partir d’aujourd’hui', () => {
    const days = agendaRangeDays('week', wednesday)
    expect(days).toHaveLength(7)
    expect([days[0], days[6]]).toEqual(['2026-10-07', '2026-10-13'])
  })
})

describe('openWithEvents (LKO-136)', () => {
  const at = new Date('2026-10-25T19:30:00Z')
  const event = (start: string, end: string | null = null) => ({
    startsAt: new Date(start),
    endsAt: end ? new Date(end) : null,
  })

  it('une soirée en cours ouvre le lieu, même fermé d’après ses horaires', () => {
    expect(openWithEvents(false, [event('2026-10-25T18:30:00Z')], at)).toBe(true)
    expect(openWithEvents(null, [event('2026-10-25T18:30:00Z', '2026-10-25T21:00:00Z')], at)).toBe(
      true,
    )
  })

  it('sans fin, la soirée dure 3 h ; avant ou après, les horaires décident', () => {
    expect(openWithEvents(false, [event('2026-10-25T16:00:00Z')], at)).toBe(false)
    expect(openWithEvents(false, [event('2026-10-25T20:00:00Z')], at)).toBe(false)
    expect(openWithEvents(null, [], at)).toBeNull()
    expect(openWithEvents(true, [], at)).toBe(true)
  })
})
