import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { fromPrisma, PgBoss, type SendOptions, type UpdateQueueOptions } from 'pg-boss'
import { loadEnv } from '../config/env'
import type { Prisma } from '../generated/prisma/client'

/** Tâches épuisées : gardées 14 jours (rétention pg-boss) pour comprendre et relancer. */
export const DEAD_LETTER_QUEUE = 'jobs.failed'

/** 5 nouveaux essais espacés de 30 s, 1 min, 2 min… (avec un peu d'aléa), puis la file des échecs. */
export const QUEUE_DEFAULTS = {
  retryLimit: 5,
  retryDelay: 30,
  retryBackoff: true,
  deadLetter: DEAD_LETTER_QUEUE,
} satisfies UpdateQueueOptions

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
    this.started ??= (async () => {
      this.boss.on('error', (error) => this.logger.error(error))
      await this.boss.start()
      await this.boss.createQueue(DEAD_LETTER_QUEUE)
      return this.boss
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
    // Et non via createQueue, qui laisse telle quelle une file déjà créée par un déploiement précédent
    await boss.updateQueue(name, QUEUE_DEFAULTS)
    await boss.work<T>(name, async (jobs) => {
      for (const job of jobs) {
        const startedAt = Date.now()
        try {
          await handler(job.data)
        } catch (error) {
          this.logger.error(
            `${name} ${job.id} en échec`,
            error instanceof Error ? error.stack : error,
          )
          throw error
        }
        this.logger.debug(`${name} ${job.id} traitée en ${Date.now() - startedAt} ms`)
      }
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
