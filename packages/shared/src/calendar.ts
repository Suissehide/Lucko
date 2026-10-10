/** Partie à ajouter au calendrier du joueur (LKO-32). */
export type CalendarEntry = {
  /** Identifiant stable : un deuxième ajout remplace le premier dans les calendriers qui le gèrent. */
  uid: string
  title: string
  startsAt: Date
  /** null : durée par défaut d'une partie. */
  endsAt: Date | null
  /** Lieu et adresse, ou zone floue d'une room à domicile : jamais l'adresse privée. */
  location: string | null
  url: string
}

/** Durée supposée d'une partie sans heure de fin (soirée, room). */
export const CALENDAR_DEFAULT_MS = 3 * 60 * 60 * 1000

export const calendarEnd = (entry: Pick<CalendarEntry, 'startsAt' | 'endsAt'>) =>
  entry.endsAt ?? new Date(entry.startsAt.getTime() + CALENDAR_DEFAULT_MS)

const icsDate = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
const icsText = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n')

/** Fichier .ics d'une partie (RFC 5545), pour le web où il n'y a pas de calendrier natif. */
// ponytail: lignes non repliées à 75 octets, les calendriers courants les acceptent
export function icsEvent(entry: CalendarEntry, now = new Date()) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lucko//Mes parties//FR',
    'BEGIN:VEVENT',
    `UID:${entry.uid}@lucko.fr`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(entry.startsAt)}`,
    `DTEND:${icsDate(calendarEnd(entry))}`,
    `SUMMARY:${icsText(entry.title)}`,
    ...(entry.location ? [`LOCATION:${icsText(entry.location)}`] : []),
    `URL:${entry.url}`,
    `DESCRIPTION:${icsText(entry.url)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
