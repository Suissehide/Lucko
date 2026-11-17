import { FEEDBACK_RATE_LIMIT } from '@lucko/shared'
import { HttpException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '../generated/prisma/client'
import { FeedbackController } from './feedback.controller'
import { feedbackRateLimited, rateWindowStart, statusCounts } from './feedback.rules'

const user = { id: 'u1' } as User
const body = {
  category: 'BUG',
  message: "L'agenda reste vide",
  screen: '/agenda',
  appVersion: '1.0.0',
  platform: 'IOS',
} as const

function setup(recent: number) {
  const prisma = { feedback: { count: vi.fn(async () => recent), create: vi.fn(async () => ({})) } }
  return { controller: new FeedbackController(prisma as never), prisma }
}

describe('POST /feedback (LKO-166)', () => {
  it("enregistre le retour au nom du joueur connecté, avec le contexte envoyé par l'app", async () => {
    const { controller, prisma } = setup(0)
    await controller.send(user, body)
    expect(prisma.feedback.create).toHaveBeenCalledWith({ data: { ...body, userId: 'u1' } })
    expect(prisma.feedback.count).toHaveBeenCalledWith({
      where: { userId: 'u1', createdAt: { gte: expect.any(Date) } },
    })
  })

  it('429 au-delà de la limite, sans rien enregistrer', async () => {
    const { controller, prisma } = setup(FEEDBACK_RATE_LIMIT.max)
    const error = await controller.send(user, body).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getStatus()).toBe(429)
    expect(prisma.feedback.create).not.toHaveBeenCalled()
  })
})

describe('règles des retours', () => {
  it('compte les retours des 10 dernières minutes, 5 au plus', () => {
    const now = new Date('2026-11-17T12:00:00Z')
    expect(rateWindowStart(now)).toEqual(new Date('2026-11-17T11:50:00Z'))
    expect(feedbackRateLimited(4)).toBe(false)
    expect(feedbackRateLimited(5)).toBe(true)
  })

  it('met à zéro les statuts sans retour', () => {
    expect(
      statusCounts(['NEW', 'IN_PROGRESS', 'DONE', 'ARCHIVED'], [{ status: 'DONE', count: 3 }]),
    ).toEqual({ NEW: 0, IN_PROGRESS: 0, DONE: 3, ARCHIVED: 0 })
  })
})
