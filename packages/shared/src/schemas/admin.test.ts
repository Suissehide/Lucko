import { describe, expect, it } from 'vitest'
import { createVenueSchema, osmVenuePreviewSchema } from './admin'

const venue = {
  name: 'Jeux Descartes',
  type: 'TCG_SHOP',
  address: '69 B Rue des Trois Conils',
  city: '',
  latitude: 44.84,
  longitude: -0.57,
  phone: null,
  website: null,
  acceptsUnaccompaniedMinors: false,
  osmId: 'node/2238448183',
  openingHours: [],
} as const

describe('lieu pré-rempli depuis OSM (LKO-145)', () => {
  it('aperçu : ville absente d’OSM acceptée', () => {
    expect(osmVenuePreviewSchema.safeParse({ ...venue, duplicate: null }).success).toBe(true)
  })

  it('création : ville toujours exigée', () => {
    expect(createVenueSchema.safeParse(venue).success).toBe(false)
    expect(createVenueSchema.safeParse({ ...venue, city: 'Bordeaux' }).success).toBe(true)
  })
})
