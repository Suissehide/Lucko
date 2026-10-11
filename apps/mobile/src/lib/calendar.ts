import { type CalendarEntry, calendarEnd } from '@lucko/shared'
import { createEventInCalendarAsync } from 'expo-calendar/legacy'

/**
 * Ajouter au calendrier (LKO-32) : ouvre l'écran de création d'événement du téléphone, prérempli.
 * Pas de permission à demander, le joueur valide lui-même ; la version web télécharge un .ics.
 */
// ponytail: l'événement n'est pas mis à jour si la partie est annulée, stocker son id si les joueurs le demandent
export async function addToCalendar(entry: CalendarEntry) {
  await createEventInCalendarAsync({
    title: entry.title,
    startDate: entry.startsAt,
    endDate: calendarEnd(entry),
    location: entry.location ?? undefined,
    url: entry.url,
    notes: entry.url,
  })
}
