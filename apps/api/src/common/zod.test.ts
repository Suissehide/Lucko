import { createRoomSchema, meSchema } from '@lucko/shared'
import { BadRequestException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { toOpenApi, ZodValidationPipe } from './zod'

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(createRoomSchema)

  it('renvoie les données validées (valeurs par défaut comprises)', () => {
    const room = pipe.transform({
      gameId: 'mtg',
      mode: 'CASUAL',
      venueId: 'v1',
      startsAt: '2026-10-10T20:00:00Z',
      capacity: 4,
    }) as z.output<typeof createRoomSchema>
    expect(room.autoAccept).toBe(false)
    expect(room.startsAt).toBeInstanceOf(Date)
  })

  it('refuse avec 400 et le chemin du champ en erreur', () => {
    try {
      pipe.transform({ gameId: 'mtg', mode: 'CASUAL', startsAt: 'x', capacity: 1 })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException)
      const body = (error as BadRequestException).getResponse() as { issues: { path: string }[] }
      expect(body.issues.map((i) => i.path)).toEqual(
        expect.arrayContaining(['startsAt', 'capacity']),
      )
    }
  })
})

describe('schémas de réponse', () => {
  it('retirent les champs non déclarés (rien ne fuit vers l’app)', () => {
    const user = {
      id: 'u1',
      email: 'a@b.fr',
      pseudo: 'lea',
      name: 'Léa Martin',
      hasBirthDate: true,
      parentalConsentPending: false,
      childCount: 0,
      role: 'PLAYER',
      avatarUrl: null,
      avatarStatus: null,
      city: null,
      latitude: null,
      longitude: null,
      searchRadiusKm: 10,
      availability: [],
      vibes: [],
      notificationsOff: [],
      xp: 0,
      homeSafetyAccepted: false,
      mainRating: null,
      rankings: [],
      venues: [],
      birthDate: new Date('2010-01-01'),
    }
    expect(meSchema.parse(user)).not.toHaveProperty('birthDate')
  })

  it('se convertissent en JSON Schema OpenAPI 3.0', () => {
    const schema = toOpenApi(z.object({ city: z.string().nullable() }), 'output')
    expect(schema).toMatchObject({ type: 'object', properties: { city: { nullable: true } } })
  })
})
