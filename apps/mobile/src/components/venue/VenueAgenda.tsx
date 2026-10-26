import {
  AgendaEventCard,
  Button,
  ChipGroup,
  colors,
  contentColor,
  DayEventRow,
  MonthCalendar,
  Section,
  ToggleGroup,
  Typography,
} from '@lucko/design-system'
import { addMonths, localDateTime, VENUE_AGENDA_MONTHS, type VenueDetail } from '@lucko/shared'
import { ExternalLink } from 'lucide-react-native'
import { useState } from 'react'
import { Linking, View } from 'react-native'
import { localDay } from '@/lib/explore'
import { openEvent } from '@/lib/navigation'
import {
  AGENDA_LEGEND,
  type AgendaAction,
  agendaItem,
  calendarDays,
  EVENT_FILTERS,
  longDate,
  matchesFilter,
  monthTitle,
} from '@/lib/venue'

const LIST_SIZE = 6
const FILTERS = EVENT_FILTERS.map((f, i) => ({ key: i, label: f.label }))

/** Agenda d'un lieu : filtre par type, vue liste (prochaines dates) ou calendrier du mois. */
export function VenueAgenda({ venue, wide }: { venue: VenueDetail; wide: boolean }) {
  const today = localDateTime(new Date()).date
  const firstMonth = today.slice(0, 7)
  const [filter, setFilter] = useState(0)
  const [view, setView] = useState(0)
  const [month, setMonth] = useState(firstMonth)
  const [selected, setSelected] = useState(today)

  const events = venue.events.filter((e) => matchesFilter(e, filter))
  const upcoming = events.filter((e) => localDay(e.startsAt) >= today)
  const lastMonth = addMonths(firstMonth, VENUE_AGENDA_MONTHS - 1)
  const changeMonth = (n: number) => {
    const next = addMonths(month, n)
    setMonth(next)
    setSelected(next === firstMonth ? today : `${next}-01`)
  }

  const run = (id: string, action: AgendaAction) =>
    action.url ? Linking.openURL(action.url) : openEvent(id)
  const button = (id: string, action: AgendaAction) => (
    <Button
      small
      kind={action.kind}
      label={action.label}
      icon={action.url ? ExternalLink : undefined}
      onPress={() => run(id, action)}
    />
  )

  const toggle = <ToggleGroup items={['Liste', 'Calendrier']} value={view} onChange={setView} />
  const chips = <ChipGroup items={FILTERS} value={filter} onChange={setFilter} scroll={!wide} />

  const list = upcoming.length ? (
    <View style={{ gap: wide ? 14 : 16 }}>
      {upcoming.slice(0, LIST_SIZE).map((event) => {
        const item = agendaItem(event, venue.playFeeCents)
        return (
          <AgendaEventCard
            key={event.id}
            {...item}
            wide={wide}
            action={button(event.id, item.action)}
            onPress={() => openEvent(event.id)}
          />
        )
      })}
      {upcoming.length > LIST_SIZE ? (
        <Typography variant="number" color={colors.muted} style={{ fontSize: 12 }}>
          + {upcoming.length - LIST_SIZE} autres dates
        </Typography>
      ) : null}
    </View>
  ) : (
    <Typography variant="small">Aucune date à venir pour l'instant.</Typography>
  )

  const days = calendarDays(month, venue, events)
  const selectedDay = days.find((d) => d.key === selected)
  const dayEvents = events.filter((e) => localDay(e.startsAt) === selected)
  const calendar = (
    <MonthCalendar
      title={monthTitle(month)}
      days={days}
      selected={selected}
      onSelect={setSelected}
      onPrev={month > firstMonth ? () => changeMonth(-1) : undefined}
      onNext={month < lastMonth ? () => changeMonth(1) : undefined}
      compact={!wide}
      dayTitle={longDate(selected)}
      legend={AGENDA_LEGEND}
      emptyText={
        dayEvents.length
          ? null
          : selectedDay?.closed
            ? 'Le lieu est fermé ce jour-là.'
            : "Pas d'événement ce jour-là. Tu peux créer une room."
      }
    >
      {dayEvents.map((event) => {
        const item = agendaItem(event, venue.playFeeCents)
        return (
          <DayEventRow
            key={event.id}
            color={contentColor[item.kind]}
            label={`${item.hour} · ${wide ? item.label : item.games}`}
            title={item.title}
            meta={[item.price, item.places].filter(Boolean).join(' · ')}
            metaAlert={item.placesAlert}
            action={wide ? button(event.id, item.action) : undefined}
            onPress={() => openEvent(event.id)}
          />
        )
      })}
    </MonthCalendar>
  )

  return wide ? (
    <Section title="Événements et tournois">
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {toggle}
        {chips}
      </View>
      {view === 0 ? list : calendar}
    </Section>
  ) : (
    <Section title="Événements" aside={toggle}>
      {chips}
      {view === 0 ? list : calendar}
    </Section>
  )
}
