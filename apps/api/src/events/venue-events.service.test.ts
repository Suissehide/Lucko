import { ForbiddenException, HttpException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { VENUE_ROLES } from '../auth/auth.decorators'
import type { AuthService } from '../auth/auth.service'
import type { User } from '../generated/prisma/client'
import type { PrismaService } from '../prisma/prisma.service'
import { VenueEventsController } from './venue-events.controller'
import { VenueEventsService } from './venue-events.service'

const player = { id: 'u1', role: 'PLAYER' } as User
const admin = { id: 'u2', role: 'ADMIN' } as User
const manager = { id: 'u3', role: 'PLAYER' } as User
const staff = { id: 'u4', role: 'PLAYER' } as User

/** u3 gérant et u4 staff du lieu v1. */
const venueStaff: Record<string, string> = { 'u3/v1': 'MANAGER', 'u4/v1': 'STAFF' }
const auth = {
  venueRole: async (userId: string, venueId: string) => venueStaff[`${userId}/${venueId}`] ?? null,
} as unknown as AuthService

function service(prisma: object) {
  const none = {} as never
  return new VenueEventsService(prisma as PrismaService, auth, none, none, none, none)
}

describe('droits d’accès', () => {
  it('création et liste : gérants du lieu seulement (guard @VenueRoles)', () => {
    expect(Reflect.getMetadata(VENUE_ROLES, VenueEventsController)).toEqual(['MANAGER'])
  })

  it('modifier ou annuler une date : gérant du lieu ou admin', async () => {
    const event = { id: 'e1', venueId: 'v1', venue: { name: 'Le Dé Pipé' } }
    const events = service({ event: { findUnique: async () => event } })
    await expect(events.manageable('e1', manager)).resolves.toBe(event)
    await expect(events.manageable('e1', admin)).resolves.toBe(event)
    await expect(events.manageable('e1', staff)).rejects.toBeInstanceOf(ForbiddenException)
    await expect(events.manageable('e1', player)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('404 pour un événement inconnu', async () => {
    const events = service({ event: { findUnique: async () => null } })
    await expect(events.manageable('x', admin)).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('limite de création', () => {
  const create = (single: number, series: number) =>
    service({
      venue: { findUnique: async () => ({ id: 'v1' }) },
      event: { count: async () => single },
      eventSeries: { count: async () => series },
    }).create(
      'v1',
      {
        type: 'GAME_NIGHT',
        title: 'Soirée',
        description: null,
        gameIds: [],
        startTime: '20:00',
        endTime: null,
        capacity: null,
        priceCents: null,
        minAge: null,
        registrationMode: 'NONE',
        externalUrl: null,
        status: 'PUBLISHED',
        date: '2099-01-01',
        recurrence: null,
        untilDate: null,
      },
      manager,
    )

  it('429 au-delà de 20 créations par lieu en 24 h (une série compte pour une)', async () => {
    const error = await create(15, 5).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getStatus()).toBe(429)
  })
})

describe('signalement', () => {
  const reports: unknown[] = []
  const events = (event: object | null) =>
    service({
      event: { findUnique: async () => event },
      report: {
        findFirst: async () => null,
        create: async ({ data }: { data: unknown }) => reports.push(data),
      },
    })
  const published = {
    status: 'PUBLISHED',
    createdById: null,
    series: { createdById: null },
    venue: { staff: [{ userId: 'u3' }] },
  }

  it('cible l’auteur, sinon celui de la série, sinon le gérant', async () => {
    await events({ ...published, createdById: 'u9' }).report('e1', player, {
      reason: 'OTHER',
      details: '',
    })
    await events(published).report('e1', player, { reason: 'INAPPROPRIATE_CONTENT', details: 'x' })
    expect(reports).toEqual([
      { reporterId: 'u1', targetId: 'u9', eventId: 'e1', reason: 'OTHER', details: '' },
      {
        reporterId: 'u1',
        targetId: 'u3',
        eventId: 'e1',
        reason: 'INAPPROPRIATE_CONTENT',
        details: 'x',
      },
    ])
  })

  it('brouillon ou masqué : introuvable pour un joueur', async () => {
    for (const status of ['DRAFT', 'HIDDEN'])
      await expect(
        events({ ...published, status }).report('e1', player, { reason: 'OTHER', details: '' }),
      ).rejects.toBeInstanceOf(NotFoundException)
  })
})
