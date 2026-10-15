import { venuePerkSchema } from '@lucko/shared'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { CheckinService } from './checkin.service'

vi.mock('../config/env', () => ({ loadEnv: () => ({}) }))

function setup(venue: { isPartner: boolean; luckoPerk: string | null } | null) {
  const prisma = {
    venue: {
      findUnique: vi.fn(async () => venue),
      update: vi.fn(async ({ data }: { data: { luckoPerk: string | null } }) => data),
    },
  }
  return { service: new CheckinService(prisma as never, {} as never, {} as never), prisma }
}

describe('avantage Lucko du gérant (LKO-92)', () => {
  it('lit et change l’avantage d’un lieu partenaire', async () => {
    const { service, prisma } = setup({ isPartner: true, luckoPerk: 'Café offert' })
    await expect(service.perk('v1')).resolves.toEqual({ luckoPerk: 'Café offert' })
    await expect(service.setPerk('v1', '')).resolves.toEqual({ luckoPerk: null })
    expect(prisma.venue.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'v1' }, data: { luckoPerk: null } }),
    )
  })

  it('encode la réponse (schéma sans transformation à sens unique)', () => {
    expect(venuePerkSchema.encode({ luckoPerk: null })).toEqual({ luckoPerk: null })
  })

  it('refuse un lieu non partenaire (ou désactivé) et un lieu inconnu', async () => {
    const off = setup({ isPartner: false, luckoPerk: 'Ancien avantage' })
    await expect(off.service.perk('v1')).rejects.toBeInstanceOf(ForbiddenException)
    await expect(off.service.setPerk('v1', 'x')).rejects.toBeInstanceOf(ForbiddenException)
    expect(off.prisma.venue.update).not.toHaveBeenCalled()
    await expect(setup(null).service.perk('v1')).rejects.toBeInstanceOf(NotFoundException)
  })
})
