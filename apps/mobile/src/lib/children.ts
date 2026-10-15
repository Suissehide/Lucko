import type { StatusTone } from '@lucko/design-system'
import {
  type ChildActivity,
  formatDayMonth,
  formatLongDay,
  formatTime,
  type ParticipantStatus,
  REPORT_REASON_LABELS,
} from '@lucko/shared'

type Row = { title: string; subtitle: string; status?: { label: string; tone: StatusTone } }

/** « 20 oct. 19:30 » : en tête de ligne, pour que le lieu soit coupé avant la date sur téléphone. */
const when = (date: string) => {
  const { day, month } = formatDayMonth(date)
  return `${Number(day)} ${month.toLowerCase()}. ${formatTime(date)}`
}

const ROOM_STATUS: Record<ParticipantStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: 'Candidature', tone: 'warn' },
  ACCEPTED: { label: 'Inscrit·e', tone: 'ok' },
  WAITLISTED: { label: 'Liste d’attente', tone: 'warn' },
  DECLINED: { label: 'Refusé·e', tone: 'neutral' },
  LEFT: { label: 'Partie quittée', tone: 'neutral' },
}

export const childName = (child: ChildActivity) => child.pseudo ?? child.email

export const childSummary = (child: ChildActivity) =>
  `${child.age} ans · accord donné le ${formatLongDay(child.consentAt)}`

export const childRoomRow = (room: ChildActivity['rooms'][number]): Row => ({
  title: room.game,
  subtitle: `${when(room.startsAt)} · ${room.place}`,
  status: ROOM_STATUS[room.status],
})

export const childEventRow = (event: ChildActivity['events'][number]): Row => ({
  title: event.title,
  subtitle: `${when(event.startsAt)} · ${event.venue}`,
})

export const childReportRow = (report: ChildActivity['reports'][number]): Row => ({
  title: REPORT_REASON_LABELS[report.reason],
  subtitle: `${report.direction === 'MADE' ? 'Fait par ton enfant' : 'Le ou la vise'} · ${formatLongDay(report.createdAt)}`,
  status: report.handled
    ? { label: 'Traité', tone: 'neutral' }
    : { label: 'À l’étude', tone: 'info' },
})
