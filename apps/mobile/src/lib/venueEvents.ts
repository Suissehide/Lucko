import {
  addDays,
  describeRecurrence,
  type EventCreateInput,
  type EventType,
  type EventUpdateInput,
  fromLocalDateTime,
  type Game,
  localDateTime,
  type MonthlyNth,
  type Recurrence,
  type RegistrationMode,
  type VenueDetail,
  type VenueEvent,
} from '@lucko/shared'
import { localParts } from './admin'

// Espace gérant (LKO-61) : formulaire d'un événement publié par le lieu.

export type Repeat = 'NONE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'

/** Champs texte du formulaire, convertis à l'envoi. */
export type ManagerEventValues = {
  type: EventType
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  capacity: string
  price: string
  minAge: string
  registrationMode: RegistrationMode
  externalUrl: string
  gameIds: string[]
  draft: boolean
  repeat: Repeat
  untilDate: string
}

/** Ce que le gérant modifie : nouvel événement, copie, une date, ou toute la série. */
export type EditMode =
  | { kind: 'create' }
  | { kind: 'duplicate'; event: VenueEvent }
  | { kind: 'edit'; event: VenueEvent; scope: 'occurrence' | 'series' }

/** « 1er jeudi » : rang du jour dans son mois ; le 5e devient « le dernier ». */
export function monthlyNth(date: string): MonthlyNth {
  const rank = Math.ceil(Number(date.slice(8, 10)) / 7)
  return rank > 4 ? -1 : (rank as MonthlyNth)
}

export function recurrenceOf(repeat: Repeat, date: string): Recurrence | null {
  if (repeat === 'WEEKLY') return { freq: 'WEEKLY', interval: 1 }
  if (repeat === 'BIWEEKLY') return { freq: 'WEEKLY', interval: 2 }
  if (repeat === 'MONTHLY') return { freq: 'MONTHLY', nth: monthlyNth(date) }
  return null
}

const repeatOf = (recurrence: Recurrence): Repeat =>
  recurrence.freq === 'MONTHLY' ? 'MONTHLY' : recurrence.interval === 2 ? 'BIWEEKLY' : 'WEEKLY'

/** Options de récurrence, libellées d'après la date choisie (« Le 2e jeudi du mois »). */
export function repeatOptions(date: string): { key: Repeat; label: string }[] {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date)
  return (['NONE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const).map((key) => {
    const recurrence = valid ? recurrenceOf(key, date) : null
    return {
      key,
      label: recurrence
        ? describeRecurrence(recurrence, date)
        : {
            NONE: 'Une seule fois',
            WEEKLY: 'Chaque semaine',
            BIWEEKLY: 'Une semaine sur deux',
            MONTHLY: 'Chaque mois',
          }[key],
    }
  })
}

const today = () => localDateTime(new Date()).date

/** Prochaine date au même jour de la semaine, à partir de demain : pour dupliquer un événement. */
function nextSameWeekday(date: string) {
  let next = addDays(date, 7)
  while (next <= today()) next = addDays(next, 7)
  return next
}

export function managerFormValues(mode: EditMode): ManagerEventValues {
  if (mode.kind === 'create')
    return {
      type: 'GAME_NIGHT',
      title: '',
      description: '',
      date: addDays(today(), 1),
      startTime: '19:00',
      endTime: '',
      capacity: '',
      price: '',
      minAge: '',
      registrationMode: 'IN_APP',
      externalUrl: '',
      gameIds: [],
      draft: false,
      repeat: 'NONE',
      untilDate: '',
    }
  const { event } = mode
  const start = localParts(event.startsAt)
  return {
    type: event.type,
    title: event.title,
    description: event.description ?? '',
    date: mode.kind === 'duplicate' ? nextSameWeekday(start.day) : start.day,
    startTime: start.time,
    endTime: event.endsAt ? localParts(event.endsAt).time : '',
    capacity: event.capacity?.toString() ?? '',
    price: event.priceCents === null ? '' : String(event.priceCents / 100),
    minAge: event.minAge?.toString() ?? '',
    registrationMode: event.registrationMode,
    externalUrl: event.externalUrl ?? '',
    gameIds: event.gameIds,
    draft: event.status === 'DRAFT',
    repeat: event.series && mode.kind !== 'duplicate' ? repeatOf(event.series.recurrence) : 'NONE',
    untilDate: (mode.kind === 'edit' && event.series?.untilDate) || '',
  }
}

const numberOrNull = (text: string) => (text.trim() ? Number(text.replace(',', '.')) : null)
const textOrNull = (text: string) => text.trim() || null

function fields(values: ManagerEventValues) {
  const price = numberOrNull(values.price)
  return {
    type: values.type,
    title: values.title,
    description: textOrNull(values.description),
    gameIds: values.gameIds,
    startTime: values.startTime,
    endTime: textOrNull(values.endTime),
    capacity: numberOrNull(values.capacity),
    priceCents: price === null ? null : Math.round(price * 100),
    minAge: numberOrNull(values.minAge),
    registrationMode: values.registrationMode,
    externalUrl: values.registrationMode === 'EXTERNAL' ? textOrNull(values.externalUrl) : null,
    status: values.draft ? ('DRAFT' as const) : ('PUBLISHED' as const),
  }
}

/** Corps du POST (création, copie) : champs vides → null, prix en centimes. */
export function createBody(values: ManagerEventValues): EventCreateInput {
  return {
    ...fields(values),
    date: values.date,
    recurrence: recurrenceOf(values.repeat, values.date),
    untilDate: values.repeat === 'NONE' ? null : textOrNull(values.untilDate),
  }
}

/** Corps du PATCH : cette date, ou la série (sa date de fin, pas sa règle). */
export function updateBody(
  values: ManagerEventValues,
  scope: 'occurrence' | 'series',
): EventUpdateInput {
  return scope === 'occurrence'
    ? { scope, ...fields(values), date: values.date }
    : { scope, ...fields(values), untilDate: textOrNull(values.untilDate) }
}

type AgendaEvent = VenueDetail['events'][number]

/** Aperçu : l'événement tel qu'il apparaîtra dans l'agenda du lieu. */
export function previewEvent(values: ManagerEventValues, games: Game[]): AgendaEvent | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || !/^\d{2}:\d{2}$/.test(values.startTime))
    return null
  const body = fields(values)
  const recurrence = recurrenceOf(values.repeat, values.date)
  const [h = 0, m = 0] = values.startTime.split(':').map(Number)
  return {
    id: 'apercu',
    type: body.type,
    title: body.title || 'Titre de l’événement',
    startsAt: fromLocalDateTime(values.date, h * 60 + m).toISOString(),
    capacity: body.capacity,
    priceCents: body.priceCents,
    minAge: body.minAge,
    registrationMode: body.registrationMode,
    externalUrl: body.externalUrl,
    registeredCount: 0,
    myRegistration: null,
    games: games
      .filter((g) => body.gameIds.includes(g.id))
      .map((g) => ({ slug: g.slug, name: g.name })),
    seriesId: recurrence ? 'apercu' : null,
    recurrenceLabel: recurrence ? describeRecurrence(recurrence, values.date) : null,
  }
}
