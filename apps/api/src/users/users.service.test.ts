import { describe, expect, it, vi } from 'vitest'
import type { User } from '../generated/prisma/client'
import { UsersService } from './users.service'

const year = new Date().getFullYear()
const parent = { id: 'mum', email: 'mum@x.fr', avatarUrl: null } as User
const kid = { id: 'kid', email: 'kid@x.fr', birthDate: new Date(Date.UTC(year - 14, 0, 1)) } as User
const teen = {
  id: 'teen',
  email: 'teen@x.fr',
  birthDate: new Date(Date.UTC(year - 16, 0, 1)),
} as User

function setup(children: User[]) {
  const model = () => ({ deleteMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() })
  const prisma = {
    user: {
      ...model(),
      findMany: vi.fn(async ({ where }: { where: { parentId: string } }) =>
        where.parentId === parent.id ? children : [],
      ),
    },
    parentalConsent: model(),
    playerGameProfile: model(),
    venueStaff: model(),
    pushToken: model(),
    playIntent: model(),
    block: model(),
    session: model(),
    account: model(),
    eventRegistration: model(),
    roomParticipant: model(),
    room: model(),
    $transaction: vi.fn(async () => []),
  }
  const mail = { send: vi.fn() }
  const storage = { remove: vi.fn() }
  return {
    service: new UsersService(prisma as never, storage as never, mail as never),
    prisma,
    mail,
  }
}

describe('UsersService.deleteAccount : parent (LKO-148)', () => {
  it('supprime aussi l’enfant de moins de 15 ans, retire l’accord et le prévient', async () => {
    const { service, prisma, mail } = setup([kid])
    await service.deleteAccount(parent)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'kid' } }),
    )
    expect(prisma.parentalConsent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { childId: 'kid', status: 'GRANTED' } }),
    )
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'kid@x.fr' }))
  })

  it('détache seulement un enfant de 15 ans ou plus', async () => {
    const { service, prisma, mail } = setup([teen])
    await service.deleteAccount(parent)
    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'teen' } }),
    )
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { parentId: 'mum' },
      data: { parentId: null },
    })
    expect(mail.send).not.toHaveBeenCalled()
  })
})
