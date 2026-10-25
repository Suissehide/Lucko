import {
  AgendaRow,
  Banner,
  BottomSheet,
  Button,
  Carousel,
  Chip,
  ColorLegend,
  colors,
  EmptyState,
  FilterButton,
  FilterMenu,
  FilterTag,
  LinkCard,
  ListCard,
  PageTitle,
  PlayIntentsCard,
  Segmented,
  SettingsCard,
  SettingsRow,
  SkeletonCard,
  space,
  TextLink,
  Typography,
} from '@lucko/design-system'
import { AGENDA_RANGES, agendaRangeDays, RADIUS_KM } from '@lucko/shared'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowRight, CalendarX, Check } from 'lucide-react-native'
import { type ReactNode, useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { PlayerScreen } from '@/components/PlayerScreen'
import { track } from '@/lib/analytics'
import {
  AGENDA_LEGEND,
  type AgendaEntry,
  type AgendaFilters,
  agendaRowProps,
  agendaView,
  filterParams,
  parseFilters,
  RANGE_LABELS,
} from '@/lib/cityAgenda'
import { openEvent, openPlayIntents, openRoom } from '@/lib/navigation'
import { demandLine, followedLine, PLAY_INTENTS_NOTE, usePlayIntents } from '@/lib/playIntents'
import { useLocation } from '@/lib/useLocation'
import { cityAgendaQueryOptions } from '@/queries/useExplore'
import { useMeQuery } from '@/queries/useMe'

const WIDE = 1024
const STORAGE_KEY = 'lucko.agendaFilters'

const open = (e: AgendaEntry) => {
  track('agenda-open-item', { kind: e.kind })
  return e.kind === 'ROOM' ? openRoom(e.id) : openEvent(e.id)
}

/**
 * Agenda de la ville (LKO-62) : rooms et événements de la période autour du joueur, filtrables par type,
 * jeu, distance, gratuité, places et 18+. Filtres dans l'URL (partageables), derniers filtres gardés.
 */
export default function AgendaScreen() {
  const wide = useWindowDimensions().width >= WIDE
  const me = useMeQuery()
  const { place, ready } = useLocation()
  const radiusKm = me?.searchRadiusKm ?? RADIUS_KM.default
  const agenda = useQuery({ ...cityAgendaQueryOptions(place, radiusKm), enabled: ready })
  const params = useLocalSearchParams()
  const filters = parseFilters(params)
  const [sheet, setSheet] = useState(false)
  const intents = usePlayIntents()

  const set = (f: AgendaFilters) => {
    const next = filterParams(f)
    const before = filterParams(filters)
    const changed = (Object.keys(next) as (keyof typeof next)[]).find((k) => next[k] !== before[k])
    if (changed) track('agenda-filter', { filter: changed, active: !!next[changed] })
    router.setParams(next)
    const query = new URLSearchParams(
      Object.entries(next).filter((e): e is [string, string] => !!e[1]),
    ).toString()
    AsyncStorage.setItem(STORAGE_KEY, query).catch(() => {})
  }

  // Ouvert sans filtres dans l'URL : on reprend les derniers utilisés
  // biome-ignore lint/correctness/useExhaustiveDependencies: une seule fois, à l'ouverture
  useEffect(() => {
    if (Object.keys(params).length) return
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved)
          router.setParams(
            filterParams(parseFilters(Object.fromEntries(new URLSearchParams(saved)))),
          )
      })
      .catch(() => {})
  }, [])

  const days = agendaRangeDays(filters.range)
  const view = agendaView(agenda.data ?? [], days, filters, radiusKm, set)
  const total = view.results.length
  const ranges = (
    <Segmented
      items={AGENDA_RANGES.map((r) => (wide || r !== 'weekend' ? RANGE_LABELS[r] : 'Week-end'))}
      value={AGENDA_RANGES.indexOf(filters.range)}
      onChange={(i) => set({ ...filters, range: AGENDA_RANGES[i] ?? 'tonight' })}
    />
  )
  const where = `${me?.city ?? place.label} · ${radiusKm} km`
  const clearAll = <TextLink label="Tout effacer" onPress={view.clearAll} />
  const chips = view.chips.map((c) => <FilterTag key={c.label} {...c} />)

  const block = (
    key: string,
    label: string,
    aside: string | undefined,
    items: typeof view.results,
    withDay = false,
  ) => (
    <View key={key} style={{ gap: wide ? 10 : 8 }}>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 12 }}
      >
        <Typography variant="h2" style={wide ? null : { fontSize: 18, lineHeight: 19 }}>
          {label}
        </Typography>
        {aside ? <Typography variant="small">{aside}</Typography> : null}
      </View>
      {wide ? (
        <ListCard>
          {items.map((e, i) => (
            <AgendaRow
              key={e.id}
              {...agendaRowProps(e, true, withDay)}
              wide
              first={i === 0}
              onPress={() => open(e)}
              action={<RowAction entry={e} />}
            />
          ))}
        </ListCard>
      ) : (
        items.map((e) => (
          <AgendaRow key={e.id} {...agendaRowProps(e, false, withDay)} onPress={() => open(e)} />
        ))
      )}
    </View>
  )

  const list: ReactNode = !agenda.data ? (
    agenda.isError ? (
      <Banner
        tone="err"
        message="Impossible de charger l'agenda."
        action="Réessayer"
        onAction={() => void agenda.refetch()}
      />
    ) : (
      <SkeletonCard />
    )
  ) : total === 0 ? (
    <EmptyState
      dashed
      icon={<CalendarX size={28} color={colors.ink} strokeWidth={2.5} />}
      title="Rien ce jour-là"
      text="Élargis le rayon ou dis-nous à quoi tu veux jouer : on te prévient dès qu'une room s'ouvre."
    />
  ) : (
    <>
      {view.partners.length
        ? block(
            'partners',
            'Chez nos partenaires',
            'Mis en avant : ces lieux sont partenaires de Lucko (partenariat payant).',
            view.partners,
            true,
          )
        : null}
      {view.groups.map((g) => block(g.day, g.label, wide ? g.count : undefined, g.items))}
    </>
  )

  if (wide) {
    return (
      <PlayerScreen tab="agenda" wide>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 24,
          }}
        >
          <PageTitle eyebrow={where} title="Agenda" hero />
          <View style={{ width: 460 }}>{ranges}</View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 32 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 20 }}>
            <View style={{ gap: 12 }}>
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
              >
                {view.menus.map((m) => (
                  <FilterMenu key={m.id} {...m} results={total} />
                ))}
                <View
                  style={{
                    width: 2,
                    height: 28,
                    marginHorizontal: 4,
                    backgroundColor: colors.line,
                  }}
                />
                {view.toggles.map((t) => (
                  <Chip
                    key={t.key}
                    tall
                    label={t.label}
                    active={t.value}
                    color={colors.venue}
                    icon={t.value ? Check : undefined}
                    onPress={() => t.onChange(!t.value)}
                  />
                ))}
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 28,
                }}
              >
                <Typography variant="number">{`${total} rendez-vous`}</Typography>
                {chips}
                {view.chips.length ? clearAll : null}
              </View>
            </View>
            {list}
          </View>
          <View style={{ width: 340, gap: 20 }}>
            {intents.loaded ? (
              <PlayIntentsCard
                subtitle="On te prévient dès qu'une room s'ouvre près de toi."
                rows={intents.demand.slice(0, 6).map((d) => ({
                  id: d.game.id,
                  game: d.game.name,
                  demand: demandLine(d, intents.city),
                  on: intents.gameIds.includes(d.game.id),
                }))}
                footer={PLAY_INTENTS_NOTE}
                onToggle={(id) => void intents.toggle(id)}
              />
            ) : null}
            <ColorLegend items={AGENDA_LEGEND} />
          </View>
        </View>
      </PlayerScreen>
    )
  }

  return (
    <PlayerScreen
      tab="agenda"
      wide={false}
      header={
        <View
          style={{ paddingHorizontal: space.screen, paddingTop: 6, paddingBottom: 10, gap: 12 }}
        >
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Typography variant="h1">Agenda</Typography>
            <Typography variant="label">{where}</Typography>
          </View>
          {ranges}
          <Carousel gap={6}>
            <FilterButton
              small
              label="Filtres"
              count={view.chips.length}
              active={view.chips.length > 0}
              onPress={() => setSheet(true)}
            />
            {chips}
          </Carousel>
        </View>
      }
    >
      <LinkCard
        highlight
        label="Je veux jouer à…"
        description={followedLine(intents.gameIds.length)}
        icon={ArrowRight}
        onPress={openPlayIntents}
      />
      {list}
      <BottomSheet
        visible={sheet}
        title="Filtres"
        action={clearAll}
        onClose={() => setSheet(false)}
        footer={<Button label={`Voir ${total}`} onPress={() => setSheet(false)} />}
      >
        {view.menus.map((m) => (
          <View key={m.id} style={{ gap: 8 }}>
            <Typography variant="label">{m.title}</Typography>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {m.options.map((o) => (
                <Chip
                  key={o.value}
                  tall
                  label={o.label}
                  count={o.count}
                  active={o.selected}
                  onPress={() => m.onToggle(o.value)}
                />
              ))}
            </View>
          </View>
        ))}
        <SettingsCard>
          {view.toggles.map((t) => (
            <SettingsRow key={t.key} label={t.label} toggle={t} />
          ))}
        </SettingsCard>
      </BottomSheet>
    </PlayerScreen>
  )
}

/** Room : « Rejoindre » ; événement : action de la fiche (s'inscrire, liste d'attente, voir). */
function RowAction({ entry }: { entry: AgendaEntry }) {
  const press = () => open(entry)
  if (!entry.action) {
    return entry.full ? (
      <Button small kind="ghost" label="Voir" onPress={press} />
    ) : (
      <Button small kind="rating" label="Rejoindre" onPress={press} />
    )
  }
  return <Button small kind={entry.action.kind} label={entry.action.label} onPress={press} />
}
