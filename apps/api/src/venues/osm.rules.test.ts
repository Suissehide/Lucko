import { describe, expect, it } from 'vitest'
import { isSamePlace, parseOpeningHours, slugify, toVenue } from './osm.rules'

describe('parseOpeningHours', () => {
  it('lit jours, plages multiples et passage de minuit', () => {
    expect(parseOpeningHours('Mo-We 12:00-14:00,19:00-02:00; Su off')).toEqual([
      { weekday: 1, opensAtMinute: 720, closesAtMinute: 840 },
      { weekday: 1, opensAtMinute: 1140, closesAtMinute: 120 },
      { weekday: 2, opensAtMinute: 720, closesAtMinute: 840 },
      { weekday: 2, opensAtMinute: 1140, closesAtMinute: 120 },
      { weekday: 3, opensAtMinute: 720, closesAtMinute: 840 },
      { weekday: 3, opensAtMinute: 1140, closesAtMinute: 120 },
    ])
  })

  it('toute la semaine, plage de jours qui boucle et règle qui en remplace une autre', () => {
    expect(parseOpeningHours('Mo-Su 08:00-24:00')).toHaveLength(7)
    expect(parseOpeningHours('Fr 20:00-24:00')[0]?.closesAtMinute).toBe(0)
    expect(parseOpeningHours('Sa-Mo 10:00-18:00').map((r) => r.weekday)).toEqual([6, 7, 1])
    expect(parseOpeningHours('Mo-Fr 09:00-18:00; Fr 09:00-23:00').at(-1)).toEqual({
      weekday: 5,
      opensAtMinute: 540,
      closesAtMinute: 1380,
    })
    expect(parseOpeningHours('24/7')).toHaveLength(7)
  })

  it('renonce aux formes non gérées plutôt que de deviner', () => {
    expect(parseOpeningHours('May-Sep Th-Sa 19:00-01:30')).toEqual([])
    expect(parseOpeningHours('Mo-Fr 08:00-17:00; PH off')).toEqual([])
    expect(parseOpeningHours(undefined)).toEqual([])
  })
})

describe('toVenue', () => {
  it('bar quelconque : type OTHER, mineurs seuls refusés, adresse et contacts', () => {
    const v = toVenue({
      type: 'node',
      id: 1,
      lat: 44.84,
      lon: -0.57,
      tags: {
        amenity: 'bar',
        name: 'Le Comptoir',
        'addr:housenumber': '3',
        'addr:street': 'Rue Sainte-Catherine',
        'addr:city': 'Bordeaux',
        'contact:phone': '+33 5 56 00 00 00',
      },
    })
    expect(v?.venue).toMatchObject({
      type: 'OTHER',
      address: '3 Rue Sainte-Catherine',
      city: 'Bordeaux',
      phone: '+33 5 56 00 00 00',
      acceptsUnaccompaniedMinors: false,
    })
  })

  it('bar à jeux et boutique reconnus ; un way prend son centre', () => {
    const bar = toVenue({
      type: 'node',
      id: 2,
      lat: 1,
      lon: 2,
      tags: { amenity: 'bar', name: 'Bar à Jeux - Gagnant' },
    })
    expect(bar?.venue.type).toBe('GAME_BAR')
    const shop = toVenue({
      type: 'way',
      id: 3,
      center: { lat: 1, lon: 2 },
      tags: { shop: 'games', name: 'Jeux Descartes' },
    })
    expect(shop?.venue).toMatchObject({
      type: 'TCG_SHOP',
      latitude: 1,
      acceptsUnaccompaniedMinors: true,
    })
    expect(
      toVenue({ type: 'way', id: 4, tags: { amenity: 'cafe', name: 'Sans position' } }),
    ).toBeNull()
  })

  it('sans addr:city, la ville de la zone importée', () => {
    const v = toVenue(
      { type: 'node', id: 6, lat: 48.85, lon: 2.35, tags: { amenity: 'pub', name: 'Le Pub' } },
      'Grand Paris',
    )
    expect(v?.venue.city).toBe('Grand Paris')
  })

  it('ludothèque ouverte aux mineurs, site sans protocole complété', () => {
    const v = toVenue({
      type: 'node',
      id: 5,
      lat: 1,
      lon: 2,
      tags: { amenity: 'toy_library', name: 'Ludothèque Interlude', website: 'interlude.fr' },
    })
    expect(v?.venue).toMatchObject({
      type: 'LUDOTHEQUE',
      acceptsUnaccompaniedMinors: true,
      website: 'https://interlude.fr',
    })
  })
})

describe('isSamePlace', () => {
  const seeded = { name: "L'Œuf Café", latitude: 44.8378, longitude: -0.5792 }
  it('même nom normalisé à moins de 100 m', () => {
    expect(isSamePlace(seeded, { name: "L'Œuf café", latitude: 44.8381, longitude: -0.5792 })).toBe(
      true,
    )
    expect(isSamePlace(seeded, { name: "L'Œuf Café", latitude: 44.85, longitude: -0.5792 })).toBe(
      false,
    )
  })
  it('slug sans accents ni ponctuation', () => {
    expect(slugify("Le Café d'Été !")).toBe('le-cafe-d-ete')
  })
})
