import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchOverpass } from './osm-import'

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
const urls = ['https://public.test/api', 'https://mirror.test/api']

describe('fetchOverpass', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('passe au miroir quand le serveur public est surchargé ou renvoie une erreur', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('<html>502</html>', { status: 502 }))
      .mockResolvedValueOnce(json({ elements: [{ type: 'node', id: 1, tags: {} }] }))
    vi.stubGlobal('fetch', fetch)
    expect(await fetchOverpass('q', urls)).toHaveLength(1)
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(urls)
  })

  it('échoue en citant chaque serveur quand aucun ne répond', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ elements: [], remark: 'runtime error: timeout' }))
        .mockRejectedValueOnce(new Error('ECONNRESET')),
    )
    await expect(fetchOverpass('q', urls)).rejects.toThrow(
      'Overpass indisponible (public.test : runtime error: timeout ; mirror.test : ECONNRESET)',
    )
  })
})
