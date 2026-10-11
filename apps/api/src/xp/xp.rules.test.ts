import { XP_ROOMS_PER_EVENING } from '@lucko/shared'
import { describe, expect, it } from 'vitest'
import { xpChange } from './xp.rules'

const base = {
  present: null,
  scanned: false,
  cancelled: false,
  players: 4,
  awarded: false,
  awardedTonight: 0,
}

describe('xpChange', () => {
  it('présence vérifiée par le pointage ou le scan', () => {
    expect(xpChange({ ...base, present: true })).toBe('award')
    expect(xpChange({ ...base, scanned: true })).toBe('award')
    expect(xpChange(base)).toBe('keep')
  })

  it('une seule fois par room (idempotent)', () => {
    expect(xpChange({ ...base, present: true, awarded: true })).toBe('keep')
  })

  it('retirée si la présence est corrigée, sauf si le joueur a été scanné', () => {
    expect(xpChange({ ...base, present: false, awarded: true })).toBe('revoke')
    expect(xpChange({ ...base, present: false, scanned: true, awarded: true })).toBe('keep')
  })

  it('anti-farm : plafond par soirée, room à un seul joueur ou annulée exclue', () => {
    expect(xpChange({ ...base, present: true, awardedTonight: XP_ROOMS_PER_EVENING })).toBe('keep')
    expect(xpChange({ ...base, present: true, players: 1 })).toBe('keep')
    expect(xpChange({ ...base, present: true, cancelled: true, awarded: true })).toBe('revoke')
  })
})
