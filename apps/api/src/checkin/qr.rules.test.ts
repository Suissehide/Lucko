import { describe, expect, it } from 'vitest'
import { businessDate, qrKey, signQrToken, verifyQrToken } from './qr.rules'

const key = qrKey('secret-de-test')
const now = new Date('2026-10-10T18:00:00Z')

describe('QR Lucko (LKO-77)', () => {
  it('jeton signé valable 60 s, nonce différent à chaque fois', () => {
    const a = signQrToken(key, 'joueur-1', now)
    const b = signQrToken(key, 'joueur-1', now)
    expect(a.expiresAt).toEqual(new Date('2026-10-10T18:01:00Z'))
    const check = verifyQrToken(key, a.token, now)
    expect(check).toMatchObject({ userId: 'joueur-1' })
    expect(check).toHaveProperty('nonce')
    expect(verifyQrToken(key, b.token, now)).not.toEqual(check)
  })

  it('refuse un jeton expiré : une capture ne marche plus quelques minutes plus tard', () => {
    const { token } = signQrToken(key, 'joueur-1', now)
    const later = new Date(now.getTime() + 60_000)
    expect(verifyQrToken(key, token, later)).toEqual({ refused: expect.stringMatching(/expiré/) })
  })

  it('refuse une signature falsifiée, une autre clé ou un texte quelconque', () => {
    const { token } = signQrToken(key, 'joueur-1', now)
    const [version, , signature] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ u: 'joueur-2', n: 'x', e: 9e15 })).toString(
      'base64url',
    )
    expect(verifyQrToken(key, `${version}.${forged}.${signature}`, now)).toHaveProperty('refused')
    expect(verifyQrToken(qrKey('autre-secret'), token, now)).toHaveProperty('refused')
    expect(verifyQrToken(key, 'https://lucko.fr', now)).toHaveProperty('refused')
    expect(verifyQrToken(key, 'lk1..', now)).toHaveProperty('refused')
  })

  it('soirée de rattachement : jusqu’à 6 h (Paris), c’est encore la veille', () => {
    expect(businessDate(new Date('2026-10-10T21:30:00Z'))).toBe('2026-10-10')
    expect(businessDate(new Date('2026-10-11T01:30:00Z'))).toBe('2026-10-10') // 3 h 30 à Paris
    expect(businessDate(new Date('2026-10-11T05:00:00Z'))).toBe('2026-10-11') // 7 h à Paris
  })
})
