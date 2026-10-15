import { ServiceUnavailableException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import type { JobsService } from '../jobs/jobs.service'
import type { PrismaService } from '../prisma/prisma.service'
import type { StorageService } from '../storage/storage.service'
import { HealthController } from './health.controller'

const controller = ({ db = true, jobs = true, storage = true as boolean | null } = {}) =>
  new HealthController(
    {
      $queryRaw: () => (db ? Promise.resolve([]) : Promise.reject(new Error('db'))),
    } as never as PrismaService,
    {
      stats: () =>
        jobs ? Promise.resolve({ ready: 2, failed: 1 }) : Promise.reject(new Error('pg-boss')),
    } as never as JobsService,
    {
      reachable: () =>
        storage === false ? Promise.reject(new Error('s3')) : Promise.resolve(storage),
    } as never as StorageService,
  )

describe('GET /health', () => {
  it('tout répond : ok, avec les compteurs de la file de tâches', async () => {
    expect(await controller().check()).toEqual({
      status: 'ok',
      database: 'up',
      jobs: { status: 'up', ready: 2, failed: 1 },
      storage: 'up',
    })
  })

  it('stockage absent hors configuration : ok ; file ou S3 en panne : degraded (mais 200)', async () => {
    expect((await controller({ storage: null }).check()).status).toBe('ok')
    expect(await controller({ jobs: false, storage: false }).check()).toMatchObject({
      status: 'degraded',
      jobs: { status: 'down' },
      storage: 'down',
    })
  })

  it('base injoignable : 503', async () => {
    await expect(controller({ db: false }).check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
  })
})
