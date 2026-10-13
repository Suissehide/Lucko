import { Injectable, Logger, Module, type OnModuleInit } from '@nestjs/common'
import { JobsService } from '../jobs/jobs.service'
import { PrismaService } from '../prisma/prisma.service'
import { importOsmVenues } from './osm-import'

const OSM_IMPORT_JOB = 'venues-osm-import'

/** Resynchronisation mensuelle des lieux OpenStreetMap (LKO-74), le 1er à 3 h. */
@Injectable()
export class OsmImportJob implements OnModuleInit {
  private readonly logger = new Logger('OsmImport')

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  async onModuleInit() {
    await this.jobs.handle(
      OSM_IMPORT_JOB,
      async () => this.logger.log(JSON.stringify(await importOsmVenues(this.prisma))),
      { cron: '0 3 1 * *' },
    )
  }
}

@Module({ providers: [OsmImportJob] })
export class VenuesModule {}
