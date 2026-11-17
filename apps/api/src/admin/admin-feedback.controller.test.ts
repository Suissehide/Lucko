import { adminFeedbackListSchema, adminFeedbackSchema } from '@lucko/shared'
import { NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { AdminFeedbackController } from './admin-feedback.controller'

const at = new Date('2026-11-17T10:00:00Z')
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'f1',
  userId: 'u1',
  category: 'BUG',
  message: 'La carte ne charge pas',
  screen: '/explore',
  appVersion: '1.0.0',
  platform: 'ANDROID',
  status: 'NEW',
  adminNote: '',
  createdAt: at,
  updatedAt: at,
  user: { id: 'u1', pseudo: 'Leo', email: 'leo@exemple.fr', deletedAt: null },
  ...overrides,
})

function setup(rows = [row()]) {
  const prisma = {
    feedback: {
      findMany: vi.fn(async () => rows),
      count: vi.fn(async () => rows.length),
      groupBy: vi.fn(async () => [{ status: 'NEW', _count: { _all: rows.length } }]),
      findUnique: vi.fn(async () => (rows[0] ? { id: rows[0].id } : null)),
      update: vi.fn(async ({ data }: { data: object }) => ({ ...rows[0], ...data })),
    },
  }
  return { controller: new AdminFeedbackController(prisma as never), prisma }
}

describe('GET /admin/feedback (LKO-166)', () => {
  it('renvoie les retours avec leur auteur et le nombre par statut', async () => {
    const { controller } = setup()
    const list = await controller.list({ q: '', status: undefined, category: undefined })
    expect(list.counts).toEqual({ NEW: 1, IN_PROGRESS: 0, DONE: 0, ARCHIVED: 0 })
    expect(list.items[0]?.author).toEqual({
      id: 'u1',
      pseudo: 'Leo',
      email: 'leo@exemple.fr',
      deleted: false,
    })
    expect(list.items[0]).not.toHaveProperty('userId')
    expect(() => adminFeedbackListSchema.encode(list as never)).not.toThrow()
  })

  it('cache les archivés sans filtre de statut, et cherche dans le message et l’auteur', async () => {
    const { controller, prisma } = setup()
    await controller.list({ q: 'carte', status: undefined, category: 'BUG' })
    const where = (prisma.feedback.findMany.mock.calls[0] as unknown as [{ where: object }])[0]
      .where
    expect(where).toMatchObject({ status: { not: 'ARCHIVED' }, category: 'BUG' })
    expect(where).toHaveProperty('OR')
    await controller.list({ q: '', status: 'ARCHIVED', category: undefined })
    expect(prisma.feedback.findMany.mock.calls[1]).toMatchObject([
      { where: { status: 'ARCHIVED' } },
    ])
  })

  it("n'expose ni pseudo ni e-mail d'un compte supprimé", async () => {
    const deleted = row({
      user: { id: 'u1', pseudo: null, email: 'u1@supprime.invalid', deletedAt: at },
    })
    const list = await setup([deleted]).controller.list({
      q: '',
      status: undefined,
      category: undefined,
    })
    expect(list.items[0]?.author).toEqual({ id: 'u1', pseudo: null, email: null, deleted: true })
  })
})

describe('PATCH /admin/feedback/:id (LKO-166)', () => {
  it('change le statut et la note interne', async () => {
    const { controller, prisma } = setup()
    const updated = await controller.update('f1', { status: 'DONE', adminNote: 'Corrigé' })
    expect(prisma.feedback.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'f1' },
        data: { status: 'DONE', adminNote: 'Corrigé' },
      }),
    )
    expect(updated.status).toBe('DONE')
    expect(() => adminFeedbackSchema.encode(updated as never)).not.toThrow()
  })

  it('404 pour un retour inconnu', async () => {
    const { controller, prisma } = setup([])
    await expect(controller.update('nope', { status: 'DONE' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(prisma.feedback.update).not.toHaveBeenCalled()
  })
})
