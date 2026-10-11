import { describe, expect, it } from 'vitest'
import { parseTicketCents } from './attendance'

describe('parseTicketCents', () => {
  it('euros avec virgule ou point, en centimes', () => {
    expect(parseTicketCents('12,50')).toBe(1250)
    expect(parseTicketCents(' 8.5 ')).toBe(850)
    expect(parseTicketCents('0')).toBe(0)
    expect(parseTicketCents('500')).toBe(50_000)
  })

  it('vide efface le montant', () => {
    expect(parseTicketCents('  ')).toBeNull()
  })

  it('refuse le reste : plus de 500 €, négatif, trois décimales, texte', () => {
    for (const text of ['500,01', '-3', '1,234', 'douze', '1e3'])
      expect(parseTicketCents(text)).toBeUndefined()
  })
})
