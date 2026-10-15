import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Public } from '../auth/auth.decorators'
import { ZodResponse } from '../common/zod'
import { JobsService } from '../jobs/jobs.service'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'

const healthSchema = z.object({
  /** `degraded` : l'API répond, mais la file de tâches ou le stockage ne répond pas. */
  status: z.enum(['ok', 'degraded']),
  database: z.literal('up'),
  jobs: z.union([
    z.object({ status: z.literal('up'), ready: z.number().int(), failed: z.number().int() }),
    z.object({ status: z.literal('down') }),
  ]),
  storage: z.enum(['up', 'down', 'disabled']),
})

/**
 * État de l'API (LKO-36). 503 seulement si la base ne répond pas : c'est aussi la sonde du conteneur,
 * qu'une panne S3 ne doit pas faire redémarrer. La surveillance externe lit `status` (ok / degraded).
 */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @ZodResponse(healthSchema)
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' })
    }
    const [jobs, storage] = await Promise.all([
      this.jobs
        .stats()
        .then((stats) => ({ status: 'up' as const, ...stats }))
        .catch(() => ({ status: 'down' as const })),
      this.storage
        .reachable()
        .then((up) => (up ? ('up' as const) : ('disabled' as const)))
        .catch(() => 'down' as const),
    ])
    const healthy = jobs.status === 'up' && storage !== 'down'
    return {
      status: healthy ? ('ok' as const) : ('degraded' as const),
      database: 'up' as const,
      jobs,
      storage,
    }
  }
}
