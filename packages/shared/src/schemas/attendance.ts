import { z } from 'zod'
import { ROOM_STATUSES } from '../constants'
import { isoDateTime } from './common'

/** Pointage (LKO-78) : l'hôte pointe jusqu'à 12 h après le début ; le lieu peut corriger ensuite. */
export const ATTENDANCE_WINDOW_MS = 12 * 60 * 60 * 1000

/** Montant du ticket de caisse saisi par le lieu, en centimes (0 à 500 €). */
export const TICKET_MAX_CENTS = 50_000

/** Saisie du ticket en euros : « 12,50 » → 1250 ; vide → null ; invalide ou plus de 500 € → undefined. */
export function parseTicketCents(text: string): number | null | undefined {
  const value = text.trim().replace(',', '.')
  if (!value) return null
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return undefined
  const cents = Math.round(Number(value) * 100)
  return cents <= TICKET_MAX_CENTS ? cents : undefined
}

export const ATTENDANCE_SOURCES = ['HOST', 'VENUE', 'SCAN'] as const

export const attendanceEntrySchema = z.object({
  userId: z.string().min(1),
  present: z.boolean(),
  /** Lieu seulement, facultatif ; null efface le montant. */
  ticketCents: z
    .number()
    .int()
    .min(0)
    .max(TICKET_MAX_CENTS, { message: '500 € maximum' })
    .nullable()
    .optional(),
})

export const markAttendanceSchema = z.object({
  entries: z.array(attendanceEntrySchema).min(1).max(100),
})

/** Feuille de pointage d'une room, vue par l'hôte (HOST) ou le staff du lieu (VENUE). */
export const attendanceSheetSchema = z.object({
  roomId: z.string(),
  title: z.string(),
  startsAt: isoDateTime,
  status: z.enum(ROOM_STATUSES),
  role: z.enum(['HOST', 'VENUE']),
  /** Motif si le pointage n'est pas possible pour ce rôle (pas commencé, clos, annulée). */
  closed: z.string().nullable(),
  players: z.array(
    z.object({
      userId: z.string(),
      pseudo: z.string().nullable(),
      isHost: z.boolean(),
      present: z.boolean().nullable(),
      source: z.enum(ATTENDANCE_SOURCES).nullable(),
      /** Montant du ticket, visible du lieu seulement. */
      ticketCents: z.number().int().nullable(),
      /** Motif si ce joueur ne peut pas être pointé par ce rôle (scan, lieu qui fait foi…). */
      locked: z.string().nullable(),
    }),
  ),
})

export const venueAttendanceQuerySchema = z.object({
  /** Soirée (date locale) ; par défaut celle en cours. */
  date: z.iso.date().optional(),
})

export type AttendanceEntry = z.input<typeof attendanceEntrySchema>
export type AttendanceSheet = z.input<typeof attendanceSheetSchema>
