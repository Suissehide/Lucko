import { describe, expect, it } from 'vitest'
import { attendanceClosed, presenceLocked } from './attendance.rules'

const startsAt = new Date('2026-10-10T18:00:00Z')
const room = { status: 'CONFIRMED' as const, startsAt }
const at = (hours: number) => new Date(startsAt.getTime() + hours * 3600_000)

describe('attendanceClosed', () => {
  it('ouvre au début de la partie', () => {
    expect(attendanceClosed(room, 'HOST', at(-1))).toBe('Le pointage ouvre au début de la partie')
    expect(attendanceClosed(room, 'HOST', at(0))).toBeNull()
  })

  it('l’hôte pointe jusqu’à 12 h après le début, le lieu corrige ensuite', () => {
    expect(attendanceClosed(room, 'HOST', at(12))).toBeNull()
    expect(attendanceClosed(room, 'HOST', at(12.1))).toMatch(/clos/)
    expect(attendanceClosed(room, 'VENUE', at(48))).toBeNull()
  })

  it('room annulée : pas de pointage', () => {
    expect(attendanceClosed({ ...room, status: 'CANCELLED' }, 'VENUE', at(1))).toMatch(/annulée/)
  })
})

describe('presenceLocked', () => {
  const player = { userId: 'p1', source: null, scanned: false }

  it('le scan du QR vaut présence, pour tout le monde', () => {
    expect(presenceLocked({ ...player, scanned: true }, 'VENUE', 'h')).toMatch(/scan/)
    expect(presenceLocked({ ...player, scanned: true }, 'HOST', 'h')).toMatch(/scan/)
  })

  it('le lieu fait foi sur l’hôte, pas l’inverse', () => {
    expect(presenceLocked({ ...player, source: 'VENUE' }, 'HOST', 'h')).toMatch(/lieu/)
    expect(presenceLocked({ ...player, source: 'HOST' }, 'VENUE', 'h')).toBeNull()
    expect(presenceLocked({ ...player, source: 'HOST' }, 'HOST', 'h')).toBeNull()
  })

  it('l’hôte ne se pointe pas lui-même, le lieu peut', () => {
    expect(presenceLocked({ ...player, userId: 'h' }, 'HOST', 'h')).not.toBeNull()
    expect(presenceLocked({ ...player, userId: 'h' }, 'VENUE', 'h')).toBeNull()
  })
})
