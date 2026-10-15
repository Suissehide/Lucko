import { describe, expect, it } from 'vitest'
import {
  consentDeadline,
  consentKey,
  consentMail,
  reminderTimes,
  signConsentToken,
  verifyConsentToken,
} from './consent.rules'

const key = consentKey('secret-de-test-assez-long-pour-better-auth')
const now = new Date('2026-10-13T10:00:00Z')
const later = new Date('2026-10-27T10:00:00Z')

describe('jeton du lien parent (LKO-49)', () => {
  it('rend la demande d’un jeton authentique', () => {
    expect(verifyConsentToken(key, signConsentToken(key, 'c1', later), now)).toBe('c1')
  })

  it('refuse un jeton expiré', () => {
    const token = signConsentToken(key, 'c1', later)
    expect(verifyConsentToken(key, token, new Date('2026-10-28T00:00:00Z'))).toBeNull()
  })

  it('refuse un jeton modifié ou signé avec une autre clé', () => {
    const [v, , s] = signConsentToken(key, 'c1', later).split('.')
    const forged = Buffer.from(JSON.stringify({ c: 'c2', e: later.getTime() })).toString(
      'base64url',
    )
    expect(verifyConsentToken(key, `${v}.${forged}.${s}`, now)).toBeNull()
    expect(
      verifyConsentToken(consentKey('autre'), signConsentToken(key, 'c1', later), now),
    ).toBeNull()
    expect(verifyConsentToken(key, 'nimporte-quoi', now)).toBeNull()
  })
})

describe('délais (LKO-49)', () => {
  it('supprime le compte 14 jours après sa création', () => {
    expect(consentDeadline(now)).toEqual(later)
  })

  it('relance à J+2 et J+5, pas après l’échéance', () => {
    expect(reminderTimes(now, later)).toEqual([
      new Date('2026-10-15T10:00:00Z'),
      new Date('2026-10-18T10:00:00Z'),
    ])
    expect(reminderTimes(now, new Date('2026-10-16T10:00:00Z'))).toHaveLength(1)
  })
})

describe('consentMail', () => {
  it('échappe l’e-mail de l’enfant et donne le lien et la date de suppression', () => {
    const mail = consentMail('<b>@x.fr', 'http://app/consent/t', later)
    expect(mail.html).toContain('&lt;b&gt;@x.fr')
    expect(mail.html).toContain('http://app/consent/t')
    expect(mail.html).toContain('27 octobre')
    expect(consentMail('a@x.fr', 'l', later, true).subject).toMatch(/^Rappel/)
  })
})
