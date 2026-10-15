import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { fromPrisma, PgBoss, type SendOptions } from 'pg-boss'
import { loadEnv } from '../config/env'
import type { Prisma } from '../generated/prisma/client'

/**
 * File de tâches pg-boss (LKO-106), stockée dans Postgres (schéma `pgboss`, créé au premier
 * démarrage) : rappels, adresse à domicile, relances, facturation, saisons (LKO-97).
 * Un module déclare ses tâches avec `handle()` dans son `onModuleInit` et les programme avec
 * `send()`. pg-boss ne démarre qu'à la première utilisation.
 */
@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger('Jobs')
  private readonly boss = new PgBoss(loadEnv().DATABASE_URL)
  private started?: Promise<PgBoss>

  private start() {
    this.started ??= (() => {
      this.boss.on('error', (error) => this.logger.error(error))
      return this.boss.start()
    })()
    return this.started
  }

  /**
   * Déclare une tâche et son traitement (une erreur levée = nouvel essai par pg-boss).
   * Avec `cron`, la tâche est aussi planifiée, à l'heure de Paris (ex. `'0 3 1 * *'`).
   */
  async handle<T extends object>(
    name: string,
    handler: (data: T) => Promise<void>,
    options: { cron?: string } = {},
  ) {
    const boss = await this.start()
    await boss.createQueue(name)
    await boss.work<T>(name, async (jobs) => {
      for (const job of jobs) await handler(job.data)
    })
    if (options.cron) await boss.schedule(name, options.cron, null, { tz: 'Europe/Paris' })
  }

  /**
   * Programme une tâche : `startAfter` pour plus tard, `singletonKey` pour ne pas la doubler.
   * Avec `tx`, elle est créée dans la transaction Prisma : annulée avec elle si elle échoue.
   */
  async send(name: string, data: object, options: SendOptions = {}, tx?: Prisma.TransactionClient) {
    const boss = await this.start()
    return boss.send(name, data, tx ? { ...options, db: fromPrisma(tx) } : options)
  }

  /** État des files pour GET /health : tâches prêtes en attente et échecs retenus (LKO-36). */
  async stats() {
    const queues = await (await this.start()).getQueues()
    return {
      ready: queues.reduce((sum, q) => sum + q.readyCount, 0),
      failed: queues.reduce((sum, q) => sum + q.failedCount, 0),
    }
  }

  async onModuleDestroy() {
    if (this.started) await (await this.started).stop({ graceful: true })
  }
}
