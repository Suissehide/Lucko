import { type ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { describe, expect, it } from 'vitest'
import type { User } from '../generated/prisma/client'
import { AllowPendingConsent, Public, Roles, VenueRoles } from './auth.decorators'
import { AuthGuard } from './auth.guard'
import type { AuthRequest, AuthService } from './auth.service'

const player = { id: 'u1', role: 'PLAYER' } as User
const admin = { id: 'u2', role: 'ADMIN' } as User
const manager = { id: 'u3', role: 'PLAYER' } as User
const staff = { id: 'u4', role: 'PLAYER' } as User
/** 13 ans, sans accord parental (LKO-49). */
const pendingChild = {
  id: 'u5',
  role: 'PLAYER',
  birthDate: new Date(Date.UTC(new Date().getFullYear() - 13, 0, 1)),
  parentalConsentAt: null,
} as User

/** VenueStaff de test : u3 gérant et u4 staff du lieu v1, personne dans v2. */
const venueStaff: Record<string, string> = { 'u3/v1': 'MANAGER', 'u4/v1': 'STAFF' }

class Routes {
  @Public()
  open() {}
  any() {}
  @Roles('ADMIN')
  adminOnly() {}
  @VenueRoles('MANAGER')
  billing() {}
  @VenueRoles('MANAGER', 'STAFF')
  scan() {}
  @AllowPendingConsent()
  askParent() {}
}

function setup(user: User | null, handler: keyof Routes, venueId = 'v1', method = 'POST') {
  const request = { method, params: { venueId } } as unknown as AuthRequest
  const auth = {
    resolveUser: async () => user,
    venueRole: async (userId: string, venue: string) => venueStaff[`${userId}/${venue}`] ?? null,
  } as unknown as AuthService
  const context = {
    getHandler: () => Routes.prototype[handler],
    getClass: () => Routes,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
  return { guard: new AuthGuard(new Reflector(), auth), context, request }
}

describe('AuthGuard', () => {
  it('laisse les messages WebSocket à la passerelle temps réel', async () => {
    const { guard, context } = setup(null, 'any')
    const ws = { ...context, getType: () => 'ws' } as ExecutionContext
    await expect(guard.canActivate(ws)).resolves.toBe(true)
  })

  it('laisse passer une route @Public sans utilisateur', async () => {
    const { guard, context } = setup(null, 'open')
    await expect(guard.canActivate(context)).resolves.toBe(true)
  })

  it("pose l'utilisateur connecté sur une route @Public", async () => {
    const { guard, context, request } = setup(player, 'open')
    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(request.user).toBe(player)
  })

  it('refuse par défaut une route sans utilisateur connecté (401)', async () => {
    const { guard, context } = setup(null, 'any')
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("pose l'utilisateur sur la requête", async () => {
    const { guard, context, request } = setup(player, 'any')
    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(request.user).toBe(player)
  })

  it('13-14 ans sans accord parental : lecture seule, sauf @AllowPendingConsent (LKO-49)', async () => {
    const write = setup(pendingChild, 'any')
    await expect(write.guard.canActivate(write.context)).rejects.toMatchObject({
      response: { code: 'PARENTAL_CONSENT_REQUIRED' },
    })
    const read = setup(pendingChild, 'any', 'v1', 'GET')
    await expect(read.guard.canActivate(read.context)).resolves.toBe(true)
    const ask = setup(pendingChild, 'askParent')
    await expect(ask.guard.canActivate(ask.context)).resolves.toBe(true)
    const granted = setup({ ...pendingChild, parentalConsentAt: new Date() }, 'any')
    await expect(granted.guard.canActivate(granted.context)).resolves.toBe(true)
  })

  it('applique @Roles : 403 pour un joueur, accès pour un admin', async () => {
    const asPlayer = setup(player, 'adminOnly')
    await expect(asPlayer.guard.canActivate(asPlayer.context)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    const asAdmin = setup(admin, 'adminOnly')
    await expect(asAdmin.guard.canActivate(asAdmin.context)).resolves.toBe(true)
  })

  it('applique @VenueRoles selon le rôle dans le lieu de la route', async () => {
    const allowed = async (user: User, handler: keyof Routes, venueId?: string) => {
      const { guard, context } = setup(user, handler, venueId)
      return guard.canActivate(context).then(
        () => true,
        (error) => {
          expect(error).toBeInstanceOf(ForbiddenException)
          return false
        },
      )
    }
    expect(await allowed(manager, 'billing')).toBe(true)
    expect(await allowed(staff, 'billing')).toBe(false)
    expect(await allowed(staff, 'scan')).toBe(true)
    expect(await allowed(player, 'scan')).toBe(false)
    // Rôle dans un lieu, pas dans un autre
    expect(await allowed(manager, 'scan', 'v2')).toBe(false)
    expect(await allowed(admin, 'billing', 'v2')).toBe(true)
  })
})
