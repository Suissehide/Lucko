import { describe, expect, it } from 'vitest'
import { calendarEnd, icsEvent } from './calendar'

const entry = {
  uid: 'room-abc',
  title: 'Commander à 4',
  startsAt: new Date('2026-10-10T18:00:00Z'),
  endsAt: null,
  location: 'Le Dé Bordelais, 12 rue Sainte-Catherine; Bordeaux',
  url: 'https://lucko.fr/rooms/abc',
}

describe('icsEvent', () => {
  it('événement UTC avec durée par défaut de 3 h, lignes en CRLF', () => {
    const ics = icsEvent(entry, new Date('2026-10-01T09:30:00.123Z'))
    const lines = ics.split('\r\n')
    expect(lines).toContain('UID:room-abc@lucko.fr')
    expect(lines).toContain('DTSTAMP:20261001T093000Z')
    expect(lines).toContain('DTSTART:20261010T180000Z')
    expect(lines).toContain('DTEND:20261010T210000Z')
    expect(lines).toContain('URL:https://lucko.fr/rooms/abc')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('échappe virgules, points-virgules et retours à la ligne', () => {
    const ics = icsEvent({ ...entry, title: 'Soirée\nModern, Pioneer' })
    expect(ics).toContain('SUMMARY:Soirée\\nModern\\, Pioneer')
    expect(ics).toContain('LOCATION:Le Dé Bordelais\\, 12 rue Sainte-Catherine\\; Bordeaux')
  })

  it('pas de LOCATION sans lieu ; heure de fin gardée quand elle existe', () => {
    const endsAt = new Date('2026-10-10T23:00:00Z')
    expect(icsEvent({ ...entry, location: null })).not.toContain('LOCATION')
    expect(calendarEnd({ ...entry, endsAt })).toBe(endsAt)
  })
})
