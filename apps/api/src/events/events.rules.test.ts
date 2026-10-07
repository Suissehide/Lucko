import { describe, expect, it } from 'vitest'
import {
  durationOf,
  eventChangeMessages,
  isEditable,
  minuteOf,
  occurrenceTimes,
  type RegistrableEvent,
  registrationOutcome,
  seriesView,
  timesChanged,
  withUtm,
} from './events.rules'

const now = new Date('2026-10-04T12:00:00Z')
const adult = new Date('1990-05-01')
const event: RegistrableEvent = {
  registrationMode: 'IN_APP',
  startsAt: new Date('2026-10-04T18:00:00Z'),
  status: 'PUBLISHED',
  minAge: null,
  capacity: 2,
}

describe('registrationOutcome', () => {
  it('inscrit tant qu’il reste des places, puis met en liste d’attente', () => {
    expect(registrationOutcome(event, 1, adult, now)).toEqual({ status: 'REGISTERED' })
    expect(registrationOutcome(event, 2, adult, now)).toEqual({ status: 'WAITLISTED' })
    expect(registrationOutcome({ ...event, capacity: null }, 99, adult, now)).toEqual({
      status: 'REGISTERED',
    })
  })

  it('refuse hors inscription dans l’app, non publié ou déjà commencé', () => {
    for (const refused of [
      { ...event, registrationMode: 'NONE' as const },
      { ...event, registrationMode: 'EXTERNAL' as const },
      { ...event, status: 'CANCELLED' as const },
      { ...event, status: 'DRAFT' as const },
      { ...event, status: 'HIDDEN' as const },
      { ...event, startsAt: now },
    ]) {
      expect(registrationOutcome(refused, 0, adult, now)).toHaveProperty('refused')
    }
  })

  it('applique l’âge minimum au jour de l’inscription', () => {
    const tournament = { ...event, minAge: 16 }
    expect(registrationOutcome(tournament, 0, new Date('2010-10-05'), now)).toEqual({
      refused: 'Réservé aux 16 ans et plus',
    })
    expect(registrationOutcome(tournament, 0, new Date('2010-10-04'), now)).toEqual({
      status: 'REGISTERED',
    })
  })

  it('refuse un compte sans date de naissance (âge invérifiable)', () => {
    expect(registrationOutcome(event, 0, null, now)).toEqual({
      refused: 'Renseigne ta date de naissance pour t’inscrire',
    })
  })
})

describe('horaires', () => {
  it('durée : une fin avant le début tombe le lendemain', () => {
    expect(minuteOf('20:30')).toBe(1230)
    expect(durationOf('19:00', '23:00')).toBe(240)
    expect(durationOf('19:00', '01:00')).toBe(360)
    expect(durationOf('19:00', null)).toBeNull()
  })

  it("heure de Paris, changement d'heure compris (25 octobre 2026 à 3 h)", () => {
    // 19 h - 1 h le samedi : encore à l'heure d'été ; la semaine suivante, à l'heure d'hiver
    expect(occurrenceTimes('2026-10-24', minuteOf('19:00'), 360)).toEqual({
      startsAt: new Date('2026-10-24T17:00:00Z'),
      endsAt: new Date('2026-10-24T23:00:00Z'),
    })
    expect(occurrenceTimes('2026-10-31', minuteOf('19:00'), null)).toEqual({
      startsAt: new Date('2026-10-31T18:00:00Z'),
      endsAt: null,
    })
  })

  it('changement d’horaire : début ou fin', () => {
    const a = { startsAt: new Date('2026-10-24T17:00:00Z'), endsAt: null }
    expect(timesChanged(a, { ...a })).toBe(false)
    expect(timesChanged(a, { ...a, endsAt: new Date('2026-10-24T22:00:00Z') })).toBe(true)
    expect(timesChanged(a, { ...a, startsAt: new Date('2026-10-24T18:00:00Z') })).toBe(true)
  })

  it('modifiable : à venir, brouillon ou publié', () => {
    const later = new Date('2026-10-05T18:00:00Z')
    expect(isEditable({ status: 'PUBLISHED', startsAt: later }, now)).toBe(true)
    expect(isEditable({ status: 'DRAFT', startsAt: later }, now)).toBe(true)
    expect(isEditable({ status: 'CANCELLED', startsAt: later }, now)).toBe(false)
    expect(isEditable({ status: 'PUBLISHED', startsAt: now }, now)).toBe(false)
  })
})

describe('seriesView', () => {
  it('décode la règle et donne le libellé', () => {
    expect(
      seriesView({ rrule: 'FREQ=MONTHLY;BYDAY=1FR', startDate: new Date('2026-10-02T00:00:00Z') }),
    ).toEqual({
      recurrence: { freq: 'MONTHLY', nth: 1 },
      label: 'Le 1er vendredi du mois',
      startDate: '2026-10-02',
    })
    expect(seriesView({ rrule: 'FREQ=DAILY', startDate: now })).toBeNull()
  })
})

describe('withUtm', () => {
  it('ajoute utm_source=lucko sans écraser celui de l’organisateur', () => {
    expect(withUtm('https://www.helloasso.com/e/tournoi?x=1')).toBe(
      'https://www.helloasso.com/e/tournoi?x=1&utm_source=lucko',
    )
    expect(withUtm('https://eventlink.com/e?utm_source=insta')).toBe(
      'https://eventlink.com/e?utm_source=insta',
    )
    expect(withUtm(null)).toBeNull()
  })
})

describe('eventChangeMessages', () => {
  const info = {
    id: 'e1',
    title: 'Tournoi Pioneer',
    startsAt: new Date('2026-10-24T17:00:00Z'),
    venueName: 'Le Dé Pipé',
  }

  it('annulation : push vers la fiche et e-mail', () => {
    const { push, mail } = eventChangeMessages('cancelled', info)
    expect(push).toEqual({
      title: 'Événement annulé',
      body: '« Tournoi Pioneer » chez Le Dé Pipé est annulé.',
      url: '/events/e1',
    })
    expect(mail('Léa').subject).toBe('Annulé : Tournoi Pioneer')
    expect(mail('Léa').html).toContain('Bonjour Léa,')
  })

  it('nouvel horaire : la nouvelle date à l’heure de Paris', () => {
    const { push } = eventChangeMessages('moved', info)
    expect(push.body).toContain('19:00')
  })
})
