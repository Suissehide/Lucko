import { describe, expect, it, vi } from 'vitest'
import { DEAD_LETTER_QUEUE, JobsService, QUEUE_DEFAULTS } from './jobs.service'

const boss = vi.hoisted(() => ({
  on: vi.fn(),
  start: vi.fn(async () => {}),
  createQueue: vi.fn(async () => {}),
  updateQueue: vi.fn(async () => {}),
  work: vi.fn(async (_name: string, _handler: (jobs: object[]) => Promise<void>) => {}),
  schedule: vi.fn(async () => {}),
}))

vi.mock('../config/env', () => ({ loadEnv: () => ({}) }))
vi.mock('pg-boss', () => ({
  PgBoss: class {
    constructor() {
      Object.assign(this, boss)
    }
  },
  fromPrisma: vi.fn(),
}))

describe('JobsService.handle (LKO-97)', () => {
  it('crée la file des échecs puis règle les nouveaux essais de chaque file, même existante', async () => {
    await new JobsService().handle('rooms.reminder', async () => {})
    expect(boss.createQueue).toHaveBeenCalledWith(DEAD_LETTER_QUEUE)
    expect(boss.updateQueue).toHaveBeenCalledWith('rooms.reminder', QUEUE_DEFAULTS)
    expect(QUEUE_DEFAULTS).toMatchObject({ retryBackoff: true, deadLetter: DEAD_LETTER_QUEUE })
  })

  it("relance l'erreur du traitement pour que pg-boss réessaie", async () => {
    await new JobsService().handle('mail', async () => {
      throw new Error('SMTP indisponible')
    })
    const worker = boss.work.mock.lastCall?.[1]
    await expect(worker?.([{ id: '1', data: {} }])).rejects.toThrow('SMTP indisponible')
  })

  it('planifie les crons à l’heure de Paris', async () => {
    await new JobsService().handle('rooms.home-purge', async () => {}, { cron: '0 * * * *' })
    expect(boss.schedule).toHaveBeenCalledWith('rooms.home-purge', '0 * * * *', null, {
      tz: 'Europe/Paris',
    })
  })
})
