import { describe, expect, it } from 'vitest'
import {
  isSuspended,
  planFormatMerge,
  planProfileMerge,
  suspensionEnd,
  suspensionMail,
  warningMail,
} from './admin.rules'

const now = new Date('2026-10-06T12:00:00Z')

describe('isSuspended', () => {
  it('suspension définitive, temporaire en cours, échue ou absente', () => {
    expect(isSuspended({ suspendedAt: now, suspendedUntil: null }, now)).toBe(true)
    expect(isSuspended({ suspendedAt: now, suspendedUntil: suspensionEnd(7, now) }, now)).toBe(true)
    const later = new Date('2026-10-14T12:00:00Z')
    expect(isSuspended({ suspendedAt: now, suspendedUntil: suspensionEnd(7, now) }, later)).toBe(
      false,
    )
    expect(isSuspended({ suspendedAt: null, suspendedUntil: null }, now)).toBe(false)
  })
})

describe('fusion de jeux', () => {
  it('fond les formats de même slug et déplace les autres', () => {
    const { remap, move } = planFormatMerge(
      [
        { id: 's-cmd', slug: 'commander' },
        { id: 's-pauper', slug: 'pauper' },
      ],
      [{ id: 't-cmd', slug: 'commander' }],
    )
    expect([...remap]).toEqual([['s-cmd', 't-cmd']])
    expect(move).toEqual(['s-pauper'])
  })

  it('ne perd aucun joueur : chacun garde un seul profil, le plus joué', () => {
    const source = [
      { id: 's1', userId: 'alice', rankedGames: 12 },
      { id: 's2', userId: 'bob', rankedGames: 1 },
      { id: 's3', userId: 'chloe', rankedGames: 4 },
    ]
    const target = [
      { id: 't1', userId: 'alice', rankedGames: 3 },
      { id: 't2', userId: 'bob', rankedGames: 9 },
      { id: 't3', userId: 'dan', rankedGames: 0 },
    ]
    const { move, remove } = planProfileMerge(source, target)
    expect(move).toEqual(['s1', 's3'])
    expect(remove).toEqual(['t1', 's2'])
    const kept = [...source, ...target].filter((p) => !remove.includes(p.id))
    expect(kept.map((p) => p.userId).sort()).toEqual(['alice', 'bob', 'chloe', 'dan'])
  })
})

describe('e-mails de la modération', () => {
  it('suspension : durée, motif et contact', () => {
    const until = new Date('2026-10-13T12:00:00Z')
    const { subject, html } = suspensionMail(
      { pseudo: 'Tom_16', suspendedAt: now, suspendedUntil: until },
      'Insultes répétées',
    )
    expect(subject).toBe('Ton compte Lucko est suspendu')
    expect(html).toContain('Bonjour Tom_16,')
    expect(html).toContain('Jusqu’au 13 octobre')
    expect(html).toContain('Insultes répétées')
    expect(html).toContain('mailto:contact@lucko.fr')
  })

  it('échappe le texte saisi : pas de HTML injecté par un motif ou un pseudo', () => {
    const { html } = warningMail('<b>x</b>', '<script>alert(1)</script> & "co"')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;co&quot;')
    expect(html).toContain('Bonjour &lt;b&gt;x&lt;/b&gt;,')
  })
})
