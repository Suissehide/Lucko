import {
  AgendaRow,
  Banner,
  Button,
  border,
  type CalendarDay,
  Chip,
  ChoiceCard,
  ConfirmDialog,
  colors,
  DayChip,
  DemandCard,
  ListCard,
  ListRow,
  MonthCalendar,
  PerkBanner,
  Popover,
  radius,
  Segmented,
  SettingRow,
  SkeletonCard,
  Stepper,
  SuccessState,
  Tag,
  TextField,
  TimePicker,
  Typography,
  WizardDialog,
} from '@lucko/design-system'
import {
  addDays,
  addMonths,
  BOARD_GAME_CATEGORIES,
  BOARD_GAME_CATEGORY_LABELS,
  COMMANDER_BRACKETS,
  DEFAULT_CITY,
  formatDistance,
  formatMinuteOfDay,
  type Game,
  localDateTime,
  monthGrid,
  PLAY_INTENT_MIN_COUNT,
  RADIUS_KM,
  ROOM_DESCRIPTION_MAX,
  ROOM_MAX_DAYS_AHEAD,
  ROOM_VIBE_LABELS,
  ROOM_VIBES,
  suggestedVenue,
  VENUE_TYPE_LABELS,
  type VenueListItem,
} from '@lucko/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import * as Linking from 'expo-linking'
import { router, useLocalSearchParams } from 'expo-router'
import { type ReactNode, useState } from 'react'
import { Platform, ScrollView, Share, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ExploreMap } from '@/components/explore/ExploreMap'
import { HomeSafetyDialog } from '@/components/HomeSafetyDialog'
import { HomeAddressPicker } from '@/components/rooms/HomeAddressPicker'
import {
  clockLabel,
  dayChip,
  formatOf,
  MINUTE_RANGE,
  otherDayLabel,
  PRESET_MINUTES,
  presetDays,
  previewTime,
  type RoomDraft,
  roomBody,
  roomDraft,
  roomTitle,
  seatsRange,
  startsAt,
  whenLabel,
  withFormat,
  withGame,
} from '@/forms/room.form'
import { useScrollToRow } from '@/hooks/useScrollToRow'
import { gameLabel } from '@/lib/explore'
import { goBack } from '@/lib/navigation'
import { gameColor } from '@/lib/profile'
import { ApiError } from '@/lib/queryClient'
import { venuesQueryOptions } from '@/queries/useExplore'
import { useGamesQuery } from '@/queries/useGames'
import { useMeQuery } from '@/queries/useMe'
import { gameDemandQueryOptions } from '@/queries/usePlayIntents'
import { useRoomMutations } from '@/queries/useRoom'

const WIDE = 1024
const STEPS = ['Le jeu', 'Lieu et heure', 'Joueurs']
const STEP_TITLES = ['Quel jeu ?', 'Où et quand ?', 'Les joueurs']

/**
 * Créer une room (19a popup web, 19b plein écran) : le jeu, le lieu (ou chez soi) et l'heure, les joueurs,
 * puis « Room créée ». `?venue=<slug>` présélectionne le lieu (« Créer une room ici » de la fiche lieu).
 */
export default function CreateRoomScreen() {
  const wide = useWindowDimensions().width >= WIDE
  const insets = useSafeAreaInsets()
  const { venue: venueSlug } = useLocalSearchParams<{ venue?: string }>()
  const me = useMeQuery({ required: true })
  const games = useGamesQuery()
  const today = localDateTime(new Date()).date
  const [draft, setDraft] = useState(() => roomDraft(today))
  const set = (patch: Partial<RoomDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const [step, setStep] = useState(0)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [safety, setSafety] = useState(false)
  const { createRoom } = useRoomMutations()

  const center = { lat: me?.latitude ?? DEFAULT_CITY.lat, lng: me?.longitude ?? DEFAULT_CITY.lng }
  const at = startsAt(draft).toISOString()
  // Lieux dans le rayon maximal, ouverts ou non à l'heure choisie : la room peut être un peu plus loin
  const venues = useQuery({
    ...venuesQueryOptions(center.lat, center.lng, RADIUS_KM.max, at),
    enabled: !!me,
    placeholderData: keepPreviousData,
  })
  const demand = useQuery({
    ...gameDemandQueryOptions({ ...center, label: '' }, me?.searchRadiusKm ?? RADIUS_KM.default),
    enabled: !!me,
  })
  // Lieu passé par la fiche lieu : sélectionné dès que la liste arrive
  const preset = venues.data?.find((v) => v.slug === venueSlug)
  if (preset && !draft.venueId) set({ venueId: preset.id })
  // Sinon, partenaire proche et ouvert proposé une seule fois en arrivant sur « Où » (LKO-92)
  const [suggested, setSuggested] = useState(false)
  const suggestion = venues.data && me ? suggestedVenue(venues.data, me.searchRadiusKm) : undefined
  if (step === 1 && !suggested && venues.data && !venueSlug) {
    setSuggested(true)
    if (suggestion && !draft.venueId && !draft.atHome) set({ venueId: suggestion.id })
  }

  const game = games.data?.find((g) => g.id === draft.gameId)
  const venue = draft.atHome ? undefined : venues.data?.find((v) => v.id === draft.venueId)
  const place = draft.atHome ? (draft.home?.areaLabel ?? 'Chez moi') : venue?.name
  const title = roomTitle(game, draft)
  const waiting = demand.data?.find((d) => d.game.id === draft.gameId)?.waitingCount
  const demandCount = waiting == null ? `< ${PLAY_INTENT_MIN_COUNT}` : String(waiting)
  const demandText = game
    ? `${waiting === 1 ? 'joueur attend' : 'joueurs attendent'} ${game.kind === 'TCG' ? `du ${gameLabel(game)}` : 'des jeux de société'} près d'ici. Ils seront prévenus dès que la room est créée.`
    : ''

  const whereBlocker = draft.atHome
    ? draft.home
      ? null
      : 'Choisis ton adresse dans la liste.'
    : !venue
      ? 'Choisis un lieu.'
      : venue.openNow === false
        ? 'Ce lieu est fermé à cette heure : choisis-en un autre.'
        : null
  const blocker =
    step === 0 && !game
      ? 'Choisis un jeu.'
      : step === 1 && startsAt(draft) <= new Date()
        ? 'Choisis une heure à venir.'
        : step === 1
          ? whereBlocker
          : null
  const last = step === STEPS.length - 1

  const next = () => {
    if (!last) return setStep(step + 1)
    // Room à domicile : avertissement sécurité accepté avant de la créer (LKO-72)
    if (draft.atHome && !me?.homeSafetyAccepted) return setSafety(true)
    void create()
  }
  const create = async () => {
    setError(null)
    try {
      const room = await createRoom.mutateAsync(roomBody(draft))
      setCreatedId(room.id)
    } catch (e) {
      // 400 : motif métier (lieu fermé, mineurs…) affiché tel quel
      setError(
        e instanceof ApiError && e.status === 400
          ? e.message
          : 'Impossible de créer la room pour l’instant. Réessaie.',
      )
    }
  }
  const close = () => (step > 0 && !createdId ? setConfirmClose(true) : goBack())

  const failed = games.isError || venues.isError
  const body = createdId ? (
    <SuccessState
      compact={!wide}
      title="Room créée"
      text={`Ta room « ${title} » est en ligne ${draft.atHome ? 'chez toi' : `à ${venue?.name ?? 'ce lieu'}`}. On prévient ${waiting == null ? 'les joueurs' : `les ${waiting} joueurs`} qui attendent ce jeu près d'ici.`}
      actions={
        <>
          <Button
            kind="ghost"
            label="Partager le lien"
            onPress={() => void shareRoom(createdId, title)}
          />
          <Button
            kind="rating"
            label="Voir la room"
            onPress={() => router.replace({ pathname: '/rooms/[id]', params: { id: createdId } })}
          />
        </>
      }
    />
  ) : !games.data || !venues.data ? (
    failed ? (
      <Banner
        tone="err"
        message="Impossible de charger les jeux et les lieux."
        action="Réessayer"
        onAction={() => {
          void games.refetch()
          void venues.refetch()
        }}
      />
    ) : (
      <SkeletonCard />
    )
  ) : step === 0 ? (
    <GameStep games={games.data} game={game} draft={draft} setDraft={setDraft} wide={wide} />
  ) : step === 1 ? (
    <WhereStep
      draft={draft}
      set={set}
      today={today}
      venues={venues.data}
      center={center}
      radiusKm={me?.searchRadiusKm ?? RADIUS_KM.default}
      suggestedId={suggestion?.id}
      wide={wide}
    />
  ) : (
    <PlayersStep
      game={game}
      draft={draft}
      set={set}
      wide={wide}
      demand={game ? <DemandCard inline count={demandCount} text={demandText} /> : null}
    />
  )

  return (
    <>
      <WizardDialog
        wide={wide}
        title="Créer une room"
        steps={STEPS}
        stepTitles={STEP_TITLES}
        step={step}
        done={!!createdId}
        doneTitle="C'est fait"
        blocker={blocker ?? error}
        action={{
          label: last ? 'Créer la room' : 'Continuer',
          kind: last ? 'room' : 'rating',
          disabled: !!blocker || createRoom.isPending,
          onPress: next,
        }}
        insets={insets}
        onStep={(i) => {
          setError(null)
          setStep(i)
        }}
        onBack={() => {
          setError(null)
          setStep(Math.max(0, step - 1))
        }}
        onClose={close}
        aside={
          <>
            <Typography variant="label">Aperçu dans l'agenda</Typography>
            <AgendaRow
              time={previewTime(draft, today)}
              color={colors.rating}
              tint={colors.ratingPale}
              type="Room"
              title={title}
              meta={[place ?? 'Lieu à choisir', game ? gameLabel(game) : null]
                .filter(Boolean)
                .join(' · ')}
              adult={!draft.minorsAllowed}
              ranked={draft.ranked}
              places={`1/${draft.capacity}`}
            />
            {game ? <DemandCard count={demandCount} text={demandText} /> : null}
            {venue?.isPartner && venue.luckoPerk ? (
              <PerkBanner compact text={venue.luckoPerk} />
            ) : null}
          </>
        }
      >
        {body}
      </WizardDialog>
      <ConfirmDialog
        visible={confirmClose}
        sheet={!wide}
        title="Abandonner la création ?"
        message="Ta room n'est pas encore créée : ce que tu as choisi sera perdu."
        confirmLabel="Abandonner"
        cancelLabel="Continuer"
        onConfirm={() => {
          setConfirmClose(false)
          goBack()
        }}
        onCancel={() => setConfirmClose(false)}
      />
      <HomeSafetyDialog
        visible={safety}
        sheet={!wide}
        onAccepted={() => {
          setSafety(false)
          void create()
        }}
        onCancel={() => setSafety(false)}
      />
    </>
  )
}

/** Lien de la room : partage du système, sinon copie dans le presse-papiers (web). */
async function shareRoom(id: string, title: string) {
  const url = Linking.createURL(`/rooms/${id}`)
  if (Platform.OS === 'web' && !navigator.share) return navigator.clipboard?.writeText(url)
  await Share.share({ title, message: url, url }).catch(() => undefined)
}

function Field({ label, aside, children }: { label: string; aside?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
        }}
      >
        <Typography variant="label">{label}</Typography>
        {aside ? (
          <Typography variant="title" style={{ fontSize: 14 }}>
            {aside}
          </Typography>
        ) : null}
      </View>
      {children}
    </View>
  )
}

/** Cartes en `columns` colonnes égales ; la dernière ligne garde la largeur des autres. */
function Grid({ columns, children }: { columns: number; children: ReactNode[] }) {
  const rows = Array.from({ length: Math.ceil(children.length / columns) }, (_, r) =>
    children.slice(r * columns, r * columns + columns),
  )
  return (
    <View style={{ gap: 10 }}>
      {rows.map((row, r) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lignes d'une grille fixe
        <View key={r} style={{ flexDirection: 'row', gap: 10 }}>
          {row}
          {Array.from({ length: columns - row.length }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: cases vides de fin de ligne
            <View key={`empty-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  )
}

/** « Stratégie, ambiance, coopératif… » : les catégories se choisissent juste après. */
const BOARD_GAME_HINT = `${BOARD_GAME_CATEGORIES.slice(0, 3)
  .map((c) => BOARD_GAME_CATEGORY_LABELS[c].label.toLowerCase())
  .join(', ')}…`.replace(/^./, (c) => c.toUpperCase())

const pills = { flexDirection: 'row', flexWrap: 'wrap', gap: 6 } as const

function GameStep({
  games,
  game,
  draft,
  setDraft,
  wide,
}: {
  games: Game[]
  game: Game | undefined
  draft: RoomDraft
  setDraft: (update: (d: RoomDraft) => RoomDraft) => void
  wide: boolean
}) {
  const board = game ? game.kind !== 'TCG' : false
  const format = formatOf(game, draft)
  const tcgs = games.filter((g) => g.kind === 'TCG')
  const boardGames = games.filter((g) => g.kind !== 'TCG')
  return (
    <>
      <Field label="Cartes à collectionner">
        <Grid columns={wide ? 4 : 2}>
          {tcgs.map((g) => (
            <ChoiceCard
              key={g.id}
              label={gameLabel(g)}
              swatch={gameColor(g.slug)}
              selected={g.id === draft.gameId}
              onPress={() => setDraft((d) => withGame(d, g))}
            />
          ))}
        </Grid>
      </Field>
      {boardGames.length ? (
        <Field label="Jeux de société">
          <Grid columns={wide ? 2 : 1}>
            {boardGames.map((g) => (
              <ChoiceCard
                key={g.id}
                label={gameLabel(g)}
                description={BOARD_GAME_HINT}
                swatch={colors.venue}
                selected={g.id === draft.gameId}
                onPress={() => setDraft((d) => withGame(d, g))}
              />
            ))}
          </Grid>
        </Field>
      ) : null}
      {game ? (
        <Field label={board ? 'Catégorie' : 'Format'}>
          <View style={pills}>
            {board
              ? [null, ...BOARD_GAME_CATEGORIES].map((c) => (
                  <Chip
                    key={c ?? 'all'}
                    tall
                    label={c ? BOARD_GAME_CATEGORY_LABELS[c].label : 'Tous les jeux'}
                    active={draft.category === c}
                    onPress={() => setDraft((d) => withFormat(d, game, '', c))}
                  />
                ))
              : game.formats.map((f) => (
                  <Chip
                    key={f.id}
                    tall
                    label={f.name}
                    active={draft.formatId === f.id}
                    onPress={() => setDraft((d) => withFormat(d, game, f.id, null))}
                  />
                ))}
          </View>
        </Field>
      ) : null}
      {format?.hasBrackets ? (
        <Field label={wide ? 'Puissance des decks (bracket)' : 'Bracket'}>
          <View style={{ flexDirection: 'row', gap: wide ? 8 : 6 }}>
            {Object.entries(COMMANDER_BRACKETS).map(([n, name]) => (
              <ChoiceCard
                key={n}
                big
                label={n}
                description={wide ? name : undefined}
                selected={draft.bracket === Number(n)}
                onPress={() =>
                  setDraft((d) => ({ ...d, bracket: d.bracket === Number(n) ? null : Number(n) }))
                }
              />
            ))}
          </View>
          {!wide && draft.bracket ? (
            <Typography variant="small">
              {`Bracket ${draft.bracket} · ${COMMANDER_BRACKETS[draft.bracket as keyof typeof COMMANDER_BRACKETS]}`}
            </Typography>
          ) : null}
        </Field>
      ) : null}
      {game ? (
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 10 : 8 }}>
          <ChoiceCard
            label="Amicale"
            description="Pour le plaisir. Pas de résultat à saisir."
            selected={!draft.ranked}
            onPress={() => setDraft((d) => ({ ...d, ranked: false }))}
          />
          <ChoiceCard
            label="Classée"
            description={
              board
                ? 'Indisponible pour les jeux de société.'
                : 'Résultat à confirmer en fin de partie, compte pour les LK.'
            }
            disabled={board}
            selected={draft.ranked}
            onPress={() => setDraft((d) => ({ ...d, ranked: true }))}
          />
        </View>
      ) : null}
    </>
  )
}

function WhereStep({
  draft,
  set,
  today,
  venues,
  center,
  radiusKm,
  suggestedId,
  wide,
}: {
  draft: RoomDraft
  set: (patch: Partial<RoomDraft>) => void
  today: string
  venues: VenueListItem[]
  center: { lat: number; lng: number }
  radiusKm: number
  suggestedId?: string
  wide: boolean
}) {
  const [month, setMonth] = useState(draft.day.slice(0, 7))
  const [mapView, setMapView] = useState(false)
  const days = presetDays(today)
  const otherDay = !days.includes(draft.day)
  const otherTime = !PRESET_MINUTES.includes(draft.minute)
  const lastDay = addDays(today, ROOM_MAX_DAYS_AHEAD)
  const selected = venues.find((v) => v.id === draft.venueId)
  const { scrollRef, rowProps } = useScrollToRow(draft.venueId || null)
  const pick = (v: VenueListItem) =>
    v.openNow === false ? undefined : () => set({ venueId: v.id })

  const map = (
    <View
      style={{
        height: wide ? 250 : 300,
        borderWidth: border.base,
        borderColor: colors.ink,
        borderRadius: radius.card,
        overflow: 'hidden',
      }}
    >
      <ExploreMap
        center={{ ...center, label: '' }}
        venues={venues.filter((v) => v.openNow !== false)}
        selectedId={draft.venueId || null}
        onSelect={(id) => set({ venueId: id })}
      />
    </View>
  )
  const list = (
    <ListCard maxHeight={wide ? 320 : 360} scrollRef={scrollRef}>
      {venues.map((v, i) => {
        const closed = v.openNow === false
        const on = v.id === draft.venueId
        return (
          <View key={v.id} {...rowProps(v.id)} style={{ opacity: closed ? 0.5 : 1 }}>
            <ListRow
              inset={wide ? 16 : 12}
              last={i === venues.length - 1}
              selected={on}
              onPress={pick(v)}
              left={<RadioDot on={on} />}
              title={v.name}
              subtitle={closed ? 'Fermé à cette heure' : venueLine(v)}
              note={v.id === suggestedId ? 'Proposé : partenaire le plus proche' : undefined}
              right={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {v.isPartner ? <Tag label="Partenaire" variant="partner" /> : null}
                  <Typography variant="label">{formatDistance(v.distanceMeters)}</Typography>
                </View>
              }
            />
          </View>
        )
      })}
    </ListCard>
  )

  return (
    <>
      <Field label="Quand" aside={whenLabel(draft, today)}>
        <ScrollView
          horizontal
          scrollEnabled={!wide}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingRight: 4, paddingBottom: 4 }}
        >
          {days.map((day) => (
            <DayChip
              key={day}
              compact={!wide}
              {...dayChip(day, today)}
              active={draft.day === day}
              onPress={() => set({ day })}
            />
          ))}
          <Popover
            bare
            label="Choisir une date"
            trigger={({ open, toggle }) => (
              <DayChip
                other
                compact={!wide}
                {...(otherDay ? otherDayLabel(draft.day) : { top: 'Autre', label: 'date…' })}
                active={otherDay}
                open={open}
                onPress={() => {
                  setMonth(draft.day.slice(0, 7))
                  toggle()
                }}
              />
            )}
          >
            {(close) => (
              <MonthCalendar
                compact
                title={new Intl.DateTimeFormat('fr-FR', {
                  timeZone: 'UTC',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date(`${month}-15T12:00:00Z`))}
                days={monthGrid(month).map(
                  (day, i): CalendarDay =>
                    day
                      ? {
                          key: day,
                          day: Number(day.slice(8)),
                          today: day === today,
                          past: day < today || day > lastDay,
                          items: [],
                        }
                      : { key: `${month}-${i}`, day: null, items: [] },
                )}
                selected={draft.day}
                onSelect={(day) => {
                  if (day < today || day > lastDay) return
                  set({ day })
                  close()
                }}
                onPrev={
                  month > today.slice(0, 7) ? () => setMonth(addMonths(month, -1)) : undefined
                }
                onNext={
                  month < lastDay.slice(0, 7) ? () => setMonth(addMonths(month, 1)) : undefined
                }
                dayTitle={whenLabel(draft, today)}
              />
            )}
          </Popover>
        </ScrollView>
        <View style={pills}>
          {PRESET_MINUTES.map((minute) => (
            <Chip
              key={minute}
              tall
              label={clockLabel(minute)}
              active={draft.minute === minute}
              onPress={() => set({ minute })}
            />
          ))}
          <Popover
            label="Choisir une heure"
            width={340}
            trigger={({ open, toggle }) => (
              <Chip
                tall
                dashed
                label={otherTime ? clockLabel(draft.minute) : 'Autre heure…'}
                active={otherTime || open}
                onPress={toggle}
              />
            )}
          >
            {(close) => (
              <View style={{ padding: 14, gap: 12 }}>
                <TimePicker
                  value={draft.minute}
                  min={MINUTE_RANGE.min}
                  max={MINUTE_RANGE.max}
                  step={MINUTE_RANGE.step}
                  onChange={(minute) => set({ minute })}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="small">Par pas de 15 min.</Typography>
                  <Button small kind="ink" label="OK" onPress={close} />
                </View>
              </View>
            )}
          </Popover>
        </View>
      </Field>

      <View style={{ gap: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Typography variant="label">Où</Typography>
          {draft.atHome ? null : wide ? (
            <Typography variant="small">Ouverts à cette heure · triés par distance</Typography>
          ) : (
            <View style={{ width: 160 }}>
              <Segmented
                items={['Liste', 'Carte']}
                value={mapView ? 1 : 0}
                onChange={(i) => setMapView(i === 1)}
                color={colors.ink}
              />
            </View>
          )}
        </View>
        <Segmented
          items={['Dans un lieu', 'Chez moi']}
          value={draft.atHome ? 1 : 0}
          onChange={(i) => set({ atHome: i === 1 })}
          color={colors.ink}
        />
        {draft.atHome ? (
          <HomeAddressPicker
            value={draft.home}
            saveAddress={draft.saveAddress}
            onChange={(home) => set({ home })}
            onSaveAddress={(saveAddress) => set({ saveAddress })}
            wide={wide}
          />
        ) : wide ? (
          <>
            {map}
            {list}
          </>
        ) : mapView ? (
          <>
            {map}
            <Typography variant="small">
              {selected
                ? `Sélectionné : ${selected.name} · ${formatDistance(selected.distanceMeters)}`
                : `Touche un lieu sur la carte · rayon ${radiusKm} km`}
            </Typography>
          </>
        ) : (
          list
        )}
      </View>
    </>
  )
}

/** « Bar à jeux · ferme à 22 h ». */
const venueLine = (v: VenueListItem) =>
  [
    VENUE_TYPE_LABELS[v.type],
    v.closesAtMinute === null ? null : `ferme à ${formatMinuteOfDay(v.closesAtMinute)}`,
  ]
    .filter(Boolean)
    .join(' · ')

function RadioDot({ on }: { on: boolean }) {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderWidth: border.thin,
        borderColor: colors.ink,
        borderRadius: 10,
        backgroundColor: on ? colors.ink : colors.white,
      }}
    />
  )
}

function PlayersStep({
  game,
  draft,
  set,
  wide,
  demand,
}: {
  game: Game | undefined
  draft: RoomDraft
  set: (patch: Partial<RoomDraft>) => void
  wide: boolean
  demand: ReactNode
}) {
  const { min, max } = seatsRange(game, draft)
  const format = formatOf(game, draft)
  const hint = format?.hasBrackets
    ? 'Le Commander se joue idéalement à 4.'
    : draft.category
      ? `Pré-rempli selon la catégorie. Entre ${min} et ${max} joueurs.`
      : `Entre ${min} et ${max} joueurs.`
  return (
    <>
      <Field label="Joueurs, toi compris">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          <Stepper
            label="de joueurs"
            value={draft.capacity}
            min={min}
            max={max}
            onChange={(capacity) => set({ capacity })}
          />
          <Typography variant="small">{hint}</Typography>
        </View>
      </Field>
      <Field label="Qui peut rejoindre">
        {draft.atHome ? (
          <ChoiceCard
            label="Sur acceptation"
            description="Chez toi, tu valides chaque demande : c'est obligatoire pour une room à domicile."
            selected
            onPress={() => undefined}
          />
        ) : (
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 10 : 8 }}>
            <ChoiceCard
              label="Tout le monde"
              description="Les joueurs rejoignent directement tant qu'il reste des places."
              selected={draft.autoAccept}
              onPress={() => set({ autoAccept: true })}
            />
            <ChoiceCard
              label="Sur acceptation"
              description="Tu valides chaque demande."
              selected={!draft.autoAccept}
              onPress={() => set({ autoAccept: false })}
            />
          </View>
        )}
      </Field>
      <Field label="Ambiance">
        <View style={pills}>
          {ROOM_VIBES.map((v) => (
            <Chip
              key={v}
              tall
              label={ROOM_VIBE_LABELS[v]}
              active={draft.vibes.includes(v)}
              onPress={() =>
                set({
                  vibes: draft.vibes.includes(v)
                    ? draft.vibes.filter((x) => x !== v)
                    : [...draft.vibes, v],
                })
              }
            />
          ))}
        </View>
      </Field>
      <TextField
        label="Un mot pour les joueurs (facultatif)"
        placeholder="Ex. Proxys acceptés, on commence à l'heure, j'ai des sleeves en rab."
        multiline
        maxLength={ROOM_DESCRIPTION_MAX}
        value={draft.description}
        onChangeText={(description) => set({ description })}
      />
      {draft.atHome ? (
        <Typography variant="small">
          Room à domicile réservée aux adultes. Seuls tes enfants liés à ton compte peuvent la
          rejoindre.
        </Typography>
      ) : (
        <ListCard style={{ padding: 14, borderWidth: border.thin, borderRadius: radius.button }}>
          <SettingRow
            title="Ouverte aux mineurs"
            description="Les 13–17 ans peuvent rejoindre. Les règles de sécurité mineurs s'appliquent."
            value={draft.minorsAllowed}
            onChange={(minorsAllowed) => set({ minorsAllowed })}
          />
        </ListCard>
      )}
      {wide ? null : demand}
    </>
  )
}
