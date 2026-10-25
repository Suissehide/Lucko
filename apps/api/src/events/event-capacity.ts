import { ConflictException } from '@nestjs/common'
import type { Prisma } from '../generated/prisma/client'

/** Places libres d'un événement (null : sans limite). */
export const freePlaces = (capacity: number | null, registered: number) =>
  capacity === null ? null : Math.max(0, capacity - registered)

/** Le gérant ne peut pas descendre sous le nombre d'inscrits (LKO-152) : motif, ou null. */
export const capacityRefusal = (capacity: number | null, registered: number) =>
  capacity !== null && capacity < registered
    ? `${registered} joueurs sont déjà inscrits : garde au moins ${registered} places`
    : null

/**
 * Remplit les places libres depuis la liste d'attente, dans l'ordre d'arrivée, sans jamais dépasser la
 * capacité (LKO-152). Après une désinscription, ou une capacité augmentée. Renvoie les joueurs promus.
 */
export async function promoteWaitlist(tx: Prisma.TransactionClient, eventId: string) {
  const event = await tx.event.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      capacity: true,
      _count: { select: { registrations: { where: { status: 'REGISTERED' } } } },
    },
  })
  const free = freePlaces(event.capacity, event._count.registrations)
  if (free === 0) return []
  const next = await tx.eventRegistration.findMany({
    where: { eventId, status: 'WAITLISTED' },
    orderBy: { createdAt: 'asc' },
    ...(free === null ? {} : { take: free }),
  })
  await tx.eventRegistration.updateMany({
    where: { eventId, userId: { in: next.map((r) => r.userId) } },
    data: { status: 'REGISTERED' },
  })
  return next.map((r) => r.userId)
}

/** 409 si la nouvelle capacité est sous le nombre d'inscrits d'un des événements. */
export async function assertCapacity(
  tx: Prisma.TransactionClient,
  where: Prisma.EventWhereInput,
  capacity: number | null,
) {
  if (capacity === null) return
  const counts = await tx.eventRegistration.groupBy({
    by: ['eventId'],
    where: { status: 'REGISTERED', event: where },
    _count: true,
  })
  const most = Math.max(0, ...counts.map((c) => c._count))
  const refusal = capacityRefusal(capacity, most)
  if (refusal) throw new ConflictException(refusal)
}
