import { PrismaPg } from '@prisma/adapter-pg'
import { loadEnv } from '../config/env'
import { PrismaClient } from '../generated/prisma/client'
import { importOsmVenues } from './osm-import'

/**
 * Premier import (ou resynchronisation à la demande) des lieux OSM, sans attendre la tâche mensuelle.
 * Dev : `pnpm --filter @lucko/api venues:import-osm` ; conteneur : `node dist/venues/import-osm-venues.js`.
 */
async function main() {
  const env = loadEnv()
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) })
  try {
    const { created, updated, duplicates, hidden } = await importOsmVenues(prisma)
    console.log(
      `${created} lieu(x) créé(s), ${updated} mis à jour, ${duplicates} doublon(s) d'un lieu saisi à la main ignoré(s), ${hidden} masqué(s).`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

void main()
