import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '../generated/prisma/client'
import { consentDeadline, consentKey, signConsentToken } from './consent.rules'
import { ConsentService } from './consent.service'

vi.mock('../config/env', () => ({
  loadEnv: () => ({ APP_URL: 'http://app', BETTER_AUTH_SECRET: undefined }),
}))

const year = new Date().getFullYear()
const createdAt = new Date()
const child = {
  id: 'kid',
  email: 'kid@x.fr',
  birthDate: new Date(Date.UTC(year - 13, 0, 1)),
  parentalConsentAt: null,
  createdAt,
  deletedAt: null,
} as User
const parent = { id: 'mum', birthDate: new Date(Date.UTC(year - 40, 0, 1)) } as User
const teen = { id: 'teen', birthDate: new Date(Date.UTC(year - 16, 0, 1)) } as User

const token = (id = 'c1') => signConsentToken(consentKey(), id, consentDeadline(createdAt))

function setup(consent: object | null, childSessionsFromIp = 0) {
  const prisma = {
    parentalConsent: {
      findUnique: vi.fn(async () => consent),
      update: vi.fn((args: object) => args),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    user: {
      update: vi.fn((args: object) => args),
      findMany: vi.fn(async () => [] as object[]),
      findFirst: vi.fn(async () => consent),
      delete: vi.fn(async () => ({})),
    },
    roomParticipant: { findMany: vi.fn(async () => [] as object[]) },
    eventRegistration: { findMany: vi.fn(async () => [] as object[]) },
    report: { findMany: vi.fn(async () => [] as object[]) },
    session: { count: vi.fn(async () => childSessionsFromIp) },
    $transaction: vi.fn(async (ops: unknown) => ops),
  }
  const jobs = { handle: vi.fn(), send: vi.fn() }
  const mail = { send: vi.fn() }
  const users = { deleteAccount: vi.fn(async () => {}) }
  const service = new ConsentService(prisma as never, mail as never, jobs as never, users as never)
  return { service, prisma, mail, users }
}

const pending = { id: 'c1', childId: 'kid', child, status: 'PENDING', parentId: null }
const proof = { ip: '1.2.3.4', userAgent: 'Safari' }

describe('ConsentService.grant (LKO-49)', () => {
  it('lie le parent, active le compte et garde la preuve', async () => {
    const { service, prisma } = setup(pending)
    await service.grant(token(), parent, proof)
    expect(prisma.parentalConsent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'GRANTED',
          parentId: 'mum',
          ip: '1.2.3.4',
          userAgent: 'Safari',
          policyVersion: expect.any(String),
          sameDeviceSuspected: false,
        }),
      }),
    )
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'kid' },
      data: { parentId: 'mum', parentalConsentAt: expect.any(Date) },
    })
  })

  it('signale un accord donné depuis une IP déjà vue chez l’enfant', async () => {
    const { service, prisma } = setup(pending, 1)
    await service.grant(token(), parent, proof)
    expect(prisma.parentalConsent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sameDeviceSuspected: true }) }),
    )
  })

  it('refuse un mineur et l’enfant lui-même', async () => {
    await expect(setup(pending).service.grant(token(), teen, proof)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    await expect(setup(pending).service.grant(token(), child, proof)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('jeton réutilisé : sans effet pour le même parent, refusé pour un autre', async () => {
    const granted = { ...pending, status: 'GRANTED', parentId: 'mum' }
    const same = setup(granted)
    await same.service.grant(token(), parent, proof)
    expect(same.prisma.$transaction).not.toHaveBeenCalled()
    const other = { id: 'dad', birthDate: parent.birthDate } as User
    await expect(setup(granted).service.grant(token(), other, proof)).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it('404 pour un lien faux, ou une demande remplacée', async () => {
    await expect(setup(pending).service.show('faux')).rejects.toBeInstanceOf(NotFoundException)
    await expect(setup(null).service.show(token())).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('ConsentService.request (LKO-49)', () => {
  it('refuse l’e-mail de l’enfant et un compte qui n’a pas besoin d’accord', async () => {
    const { service } = setup(null)
    await expect(service.request(child, 'kid@x.fr')).rejects.toThrow('pas le tien')
    await expect(service.request(teen, 'mum@x.fr')).rejects.toBeInstanceOf(ConflictException)
  })
})

describe('ConsentService.withdraw (LKO-49)', () => {
  it('supprime le compte de l’enfant, garde la trace du retrait et prévient les deux', async () => {
    const { service, prisma, mail, users } = setup({ ...child, parentId: 'mum' })
    await service.withdraw({ ...parent, email: 'mum@x.fr' } as User, 'kid')
    expect(users.deleteAccount).toHaveBeenCalledWith(expect.objectContaining({ id: 'kid' }))
    expect(prisma.parentalConsent.updateMany).toHaveBeenCalledWith({
      where: { childId: 'kid', status: 'GRANTED' },
      data: { status: 'WITHDRAWN', withdrawnAt: expect.any(Date) },
    })
    expect(mail.send.mock.calls.map(([m]) => m.to)).toEqual(['kid@x.fr', 'mum@x.fr'])
  })

  it('404 pour un enfant qui n’est pas le sien, 409 à partir de 15 ans', async () => {
    await expect(setup(null).service.withdraw(parent, 'kid')).rejects.toBeInstanceOf(
      NotFoundException,
    )
    const { service, users } = setup(teen)
    await expect(service.withdraw(parent, 'teen')).rejects.toBeInstanceOf(ConflictException)
    expect(users.deleteAccount).not.toHaveBeenCalled()
  })
})

describe('ConsentService.children (LKO-49)', () => {
  it('montre l’activité avant 15 ans, plus rien après', async () => {
    const { service, prisma } = setup(null)
    prisma.user.findMany.mockResolvedValueOnce([
      { ...child, parentalConsentAt: new Date() },
      { ...teen, email: 'teen@x.fr', createdAt },
    ])
    prisma.roomParticipant.findMany.mockResolvedValueOnce([
      {
        status: 'ACCEPTED',
        room: { id: 'r1', startsAt: createdAt, game: { name: 'Lorcana' }, venue: null },
      },
    ])
    const [kid, older] = await service.children(parent)
    expect(kid).toMatchObject({ autonomous: false, rooms: [{ place: 'À domicile' }] })
    expect(older).toMatchObject({ autonomous: true, rooms: [], reports: [] })
    expect(prisma.report.findMany).toHaveBeenCalledTimes(1)
  })
})
