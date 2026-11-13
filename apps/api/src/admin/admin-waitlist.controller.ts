import { adminWaitlistQuerySchema, adminWaitlistSchema, WAITLIST_NO_CITY } from '@lucko/shared'
import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { z } from 'zod'
import { ZodQuery, ZodResponse } from '../common/zod'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { Admin } from './admin.decorators'
import { groupCities, periodStart } from './waitlist.rules'

// ponytail: 500 inscrits affichés au plus, paginer si la liste grossit
const LIST_LIMIT = 500

function cityFilter(city: string): Prisma.WaitlistEntryWhereInput {
  if (!city) return {}
  if (city === WAITLIST_NO_CITY) return { OR: [{ city: null }, { city: '' }] }
  return { city: { equals: city, mode: 'insensitive' } }
}

/** Liste d'attente de la landing (lucko.fr) : inscrits, filtres par e-mail, ville et période. */
@ApiTags('admin')
@Controller('admin')
export class AdminWaitlistController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('waitlist')
  @Admin()
  @ZodResponse(adminWaitlistSchema)
  async waitlist(
    @ZodQuery(adminWaitlistQuerySchema) {
      q,
      city,
      period,
    }: z.output<typeof adminWaitlistQuerySchema>,
  ) {
    const since = periodStart(period, new Date())
    const search: Prisma.WaitlistEntryWhereInput = {
      ...(q ? { email: { contains: q, mode: 'insensitive' } } : {}),
      ...(since ? { createdAt: { gte: since } } : {}),
    }
    const where = { AND: [search, cityFilter(city)] }
    const [entries, matching, total, cities] = await Promise.all([
      this.prisma.waitlistEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: LIST_LIMIT,
        select: { id: true, email: true, city: true, createdAt: true },
      }),
      this.prisma.waitlistEntry.count({ where }),
      this.prisma.waitlistEntry.count(),
      this.prisma.waitlistEntry.groupBy({ by: ['city'], where: search, _count: { _all: true } }),
    ])
    return {
      entries,
      matching,
      total,
      cities: groupCities(cities.map((c) => ({ city: c.city, count: c._count._all }))),
    }
  }
}
