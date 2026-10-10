import { type CalendarEntry, icsEvent } from '@lucko/shared'

/** Ajouter au calendrier sur le web (LKO-32) : téléchargement d'un .ics, ouvert par le calendrier du joueur. */
export async function addToCalendar(entry: CalendarEntry) {
  const url = URL.createObjectURL(new Blob([icsEvent(entry)], { type: 'text/calendar' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'lucko.ics'
  link.click()
  URL.revokeObjectURL(url)
}
