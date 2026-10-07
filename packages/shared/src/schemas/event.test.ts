import { describe, expect, it } from 'vitest'
import { eventCreateSchema, eventUpdateSchema } from './event'

// Vendredi 1er octobre 2027 : toujours dans le futur pour ces tests
const valid = {
  type: 'TOURNAMENT',
  title: 'Tournoi Pioneer',
  date: '2027-10-01',
  startTime: '19:00',
  endTime: '01:00',
} as const

const errors = (input: object) => {
  const result = eventCreateSchema.safeParse({ ...valid, ...input })
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'))
}

describe('eventCreateSchema', () => {
  it('valeurs par défaut : publié, inscription dans l’app, ponctuel', () => {
    expect(eventCreateSchema.parse(valid)).toMatchObject({
      status: 'PUBLISHED',
      registrationMode: 'IN_APP',
      recurrence: null,
      untilDate: null,
      gameIds: [],
    })
  })

  it('âge minimum : 13 ans au moins', () => {
    expect(errors({ minAge: 12 })).toEqual(['minAge'])
    expect(errors({ minAge: 16 })).toEqual([])
  })

  it('inscription externe : lien https obligatoire', () => {
    expect(errors({ registrationMode: 'EXTERNAL' })).toEqual(['externalUrl'])
    expect(errors({ registrationMode: 'EXTERNAL', externalUrl: 'http://helloasso.com/x' })).toEqual(
      ['externalUrl'],
    )
    expect(
      errors({ registrationMode: 'EXTERNAL', externalUrl: 'https://helloasso.com/x' }),
    ).toEqual([])
  })

  it('pas de date passée, fin de série après la première date', () => {
    expect(errors({ date: '2020-01-03' })).toEqual(['date'])
    expect(
      errors({ recurrence: { freq: 'WEEKLY', interval: 1 }, untilDate: '2027-09-01' }),
    ).toEqual(['untilDate'])
  })

  it('mensuel : la première date doit être le n-ième jour annoncé', () => {
    // Le 1er octobre 2027 est le 1er vendredi, pas le 2e
    expect(errors({ recurrence: { freq: 'MONTHLY', nth: 1 } })).toEqual([])
    expect(errors({ recurrence: { freq: 'MONTHLY', nth: 2 } })).toEqual(['recurrence'])
    expect(errors({ recurrence: { freq: 'WEEKLY', interval: 3 } })).toEqual(['recurrence.interval'])
  })
})

describe('eventUpdateSchema', () => {
  it('une date (avec sa date) ou la série (avec sa date de fin)', () => {
    expect(eventUpdateSchema.parse({ ...valid, scope: 'occurrence' })).toMatchObject({
      scope: 'occurrence',
      date: '2027-10-01',
    })
    const { date: _date, ...series } = valid
    expect(eventUpdateSchema.parse({ ...series, scope: 'series' })).toMatchObject({
      scope: 'series',
      untilDate: null,
    })
  })
})
