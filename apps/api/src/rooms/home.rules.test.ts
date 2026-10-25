import { HOME_FUZZY_RADIUS_M } from '@lucko/shared'
import { describe, expect, it } from 'vitest'
import {
  addressKeys,
  addressRefusal,
  distanceMeters,
  fuzzyCenter,
  openAddress,
  purgeBefore,
  revealAt,
  sealAddress,
  stableDraws,
} from './home.rules'

const now = new Date('2026-10-05T12:00:00Z')
const home = { lat: 44.8378, lng: -0.5792 }

describe('stableDraws (LKO-155)', () => {
  const keys = addressKeys()
  const center = (hostId: string, at = home) =>
    fuzzyCenter(at.lat, at.lng, stableDraws(keys, hostId, at.lat, at.lng))

  it('même hôte, même adresse : même zone floue, room après room', () => {
    expect(center('h1')).toEqual(center('h1'))
    // Géocodage à quelques mètres près : même zone
    expect(center('h1', { lat: 44.83781, lng: -0.57921 })).toEqual(center('h1'))
  })

  it('un autre hôte ou une autre adresse : un autre tirage', () => {
    expect(center('h2')).not.toEqual(center('h1'))
    expect(center('h1', { lat: 44.85, lng: -0.57 })).not.toEqual(center('h1'))
  })

  it('tirages dans [0, 1)', () => {
    const draw = stableDraws(keys, 'h1', home.lat, home.lng)
    for (let i = 0; i < 20; i++) {
      const value = draw()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('fuzzyCenter', () => {
  it('le cercle de 500 m contient toujours le point réel, même au bord du tirage', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      for (const a of [0, 0.125, 0.375, 0.6, 0.875]) {
        const draws = [r, a]
        const center = fuzzyCenter(home.lat, home.lng, () => draws.shift() ?? 0)
        expect(distanceMeters(center, home)).toBeLessThan(HOME_FUZZY_RADIUS_M)
      }
    }
  })

  it('arrondi au millième : pas de coordonnées précises', () => {
    const center = fuzzyCenter(home.lat, home.lng)
    expect(center.lat * 1000).toBeCloseTo(Math.round(center.lat * 1000), 6)
    expect(center.lng * 1000).toBeCloseTo(Math.round(center.lng * 1000), 6)
  })
})

describe('addressRefusal', () => {
  const startsAt = new Date('2026-10-06T18:00:00Z')
  const room = {
    hostId: 'host',
    status: 'OPEN' as const,
    startsAt,
    participants: [
      { userId: 'host', status: 'ACCEPTED' as const },
      { userId: 'ok', status: 'ACCEPTED' as const },
      { userId: 'wait', status: 'PENDING' as const },
      { userId: 'gone', status: 'LEFT' as const },
      { userId: 'out', status: 'DECLINED' as const },
    ],
  }
  const after = new Date(revealAt(startsAt).getTime() + 1)

  it('un accepté l’obtient à partir de 24 h avant le début', () => {
    expect(revealAt(startsAt)).toEqual(new Date('2026-10-05T18:00:00Z'))
    expect(addressRefusal(room, 'ok', now)).toMatch(/24 h/)
    expect(addressRefusal(room, 'ok', after)).toBeNull()
  })

  it('jamais un non-accepté (en attente, parti, retiré, inconnu)', () => {
    for (const id of ['wait', 'gone', 'out', 'stranger'])
      expect(addressRefusal(room, id, after)).toMatch(/acceptés/)
  })

  it('l’hôte toujours ; personne après une annulation ni une fois la room finie', () => {
    expect(addressRefusal(room, 'host', now)).toBeNull()
    expect(addressRefusal({ ...room, status: 'CANCELLED' }, 'ok', after)).toMatch(/annulée/)
    const finished = new Date('2026-10-06T21:00:00Z')
    expect(addressRefusal(room, 'host', finished)).toMatch(/terminée/)
    expect(addressRefusal(room, 'ok', finished)).toMatch(/terminée/)
  })
})

describe('purgeBefore', () => {
  it('supprime les adresses des rooms finies depuis plus de 6 h', () => {
    // 3 h de partie + 6 h de marge
    expect(purgeBefore(now)).toEqual(new Date('2026-10-05T03:00:00Z'))
  })
})

describe('sealAddress / openAddress', () => {
  const k = (byte: number) => Buffer.alloc(32, byte).toString('base64')
  const keys = addressKeys()
  const address = { address: '12 rue des Faures, 33000 Bordeaux', ...home }

  it('chiffre puis déchiffre, sans l’adresse en clair dans la base', () => {
    const sealed = sealAddress(keys, address)
    expect(Buffer.from(sealed.ciphertext).toString('utf8')).not.toContain('Faures')
    expect(openAddress(keys, sealed)).toEqual(address)
  })

  it('refuse une donnée altérée ou une autre clé', () => {
    const sealed = sealAddress(keys, address)
    const tampered = Buffer.from(sealed.ciphertext)
    tampered[0] = (tampered[0] ?? 0) ^ 1
    expect(() => openAddress(keys, { ...sealed, ciphertext: tampered })).toThrow()
    expect(() => openAddress(addressKeys(`1:${k(7)}`), sealed)).toThrow()
  })

  it('rotation : la nouvelle clé chiffre, l’ancienne relit les adresses existantes', () => {
    const before = addressKeys(`1:${k(1)}`)
    const old = sealAddress(before, address)
    const after = addressKeys(`2:${k(2)},1:${k(1)}`)
    expect(sealAddress(after, address).keyVersion).toBe(2)
    expect(openAddress(after, old)).toEqual(address)
    // Ancienne clé retirée trop tôt : illisible
    expect(() => openAddress(addressKeys(`2:${k(2)}`), old)).toThrow(/version 1/)
  })

  it('HOME_ADDRESS_KEYS mal formée', () => {
    expect(() => addressKeys('1:courte')).toThrow()
    expect(() => addressKeys(k(1))).toThrow()
    expect(() => addressKeys(`1:${k(1)},1:${k(2)}`)).toThrow(/double/)
  })
})
