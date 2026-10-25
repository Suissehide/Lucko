import {
  Banner,
  BrandHeader,
  Button,
  Carousel,
  ChipGroup,
  colors,
  EmptyState,
  EventCard,
  ListCard,
  MobileScreen,
  PageTitle,
  PlayerTabBar,
  ProfileCard,
  RatingBadge,
  RoomCard,
  Section,
  SkeletonCard,
  Typography,
  VenueRow,
  WebScreen,
} from '@lucko/design-system'
import { formatRating, xpLevel } from '@lucko/shared'
import { useQuery } from '@tanstack/react-query'
import { Redirect } from 'expo-router'
import { MoonStar } from 'lucide-react-native'
import { useState } from 'react'
import { Linking, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MapFrame } from '@/components/explore/MapFrame'
import { PlayerNav } from '@/components/PlayerNav'
import { useScrollToRow } from '@/hooks/useScrollToRow'
import { track } from '@/lib/analytics'
import { KIND_COLORS } from '@/lib/cityAgenda'
import {
  eventCardProps,
  GAMES,
  matchesGame,
  roomCardProps,
  todayLine,
  venueRowProps,
} from '@/lib/explore'
import {
  openAgenda,
  openAgendaRooms,
  openCreateRoom,
  openEvent,
  openHome,
  openRoom,
  openTab,
  openVenue,
  openVenues,
} from '@/lib/navigation'
import { onboarding } from '@/lib/onboarding'
import { agendaAction } from '@/lib/venue'
import { useTabBadges } from '@/queries/useChat'
import { useEventMutations } from '@/queries/useEvent'
import { useTonightQuery } from '@/queries/useExplore'
import { useMeQuery } from '@/queries/useMe'
import { gameDemandQueryOptions } from '@/queries/usePlayIntents'

const WIDE = 900

export default function HomeScreen() {
  const wide = useWindowDimensions().width >= WIDE
  const insets = useSafeAreaInsets()
  const badges = useTabBadges()
  const me = useMeQuery()
  const { place, data, failed, retry } = useTonightQuery(me?.searchRadiusKm)
  const [game, setGame] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { scrollRef, rowProps } = useScrollToRow(selectedId)
  // Jeu le plus attendu près de toi (LKO-17) : raccourci pour ouvrir une room
  const demand = useQuery(gameDemandQueryOptions(place, me?.searchRadiusKm ?? 10))
  const wanted = demand.data?.[0]?.waitingCount ? demand.data[0] : null

  // Compte tout juste créé : jeux, ville et pseudo avant l'accueil (sauf « Je regarde d'abord »)
  if (me?.parentalConsentPending) return <Redirect href="/parental-consent" />
  if (me && me.pseudo === null && !onboarding.deferred) return <Redirect href="/onboarding" />

  const events = data?.events.filter((e) => matchesGame(game, e.games)) ?? []
  const rooms = data?.rooms.filter((r) => matchesGame(game, [r.game])) ?? []
  const title = (
    <PageTitle
      eyebrow={todayLine(me?.city ?? place.label, !wide)}
      title="Ce soir près de toi"
      hero={wide}
    />
  )
  const filters = <ChipGroup items={GAMES} value={game} onChange={setGame} scroll={!wide} />
  const wantedBanner = wanted ? (
    <Banner
      tone="info"
      message={`${wanted.waitingCount} joueurs veulent jouer à ${wanted.game.name} près de toi`}
      action="Créer une room"
      onAction={() => {
        track('room-from-demand', { game: wanted.game.slug })
        openCreateRoom()
      }}
    />
  ) : null
  const error = failed ? (
    <Banner
      tone="err"
      message="Impossible de charger les soirées et les lieux."
      action="Réessayer"
      onAction={retry}
    />
  ) : null

  const eventList = !data ? (
    <SkeletonCard />
  ) : events.length === 0 ? (
    <EmptyState
      icon={<MoonStar size={28} color={colors.ink} strokeWidth={2.5} />}
      title="Pas de soirée ce soir"
      text={
        game
          ? 'Aucune soirée pour ce jeu près de toi ce soir. Essaie un autre jeu.'
          : 'Aucune soirée près de toi ce soir. Les rooms et les lieux ouverts sont juste en dessous.'
      }
    />
  ) : (
    events.map((e, i) => {
      return (
        <EventCard
          key={e.id}
          {...eventCardProps(e)}
          color={KIND_COLORS[e.type].color}
          wide={wide}
          raised={i === 0}
          onPress={() => openEvent(e.id)}
          action={<EventAction event={e} />}
        />
      )
    })
  )

  const roomCards = rooms.map((r) => (
    <View key={r.id} style={wide ? { width: '48%', flexGrow: 1, maxWidth: '50%' } : { width: 250 }}>
      <RoomCard {...roomCardProps(r)} wide={wide} onPress={() => openRoom(r.id)} />
    </View>
  ))
  const roomList = !data ? (
    <SkeletonCard />
  ) : rooms.length === 0 ? (
    <Typography variant="small">Aucune room ne cherche de joueurs pour l'instant.</Typography>
  ) : wide ? (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{roomCards}</View>
  ) : (
    <Carousel>{roomCards}</Carousel>
  )

  const map = (height: number) => (
    <MapFrame
      height={height}
      center={place}
      venues={data?.venues ?? []}
      openNow
      selectedId={selectedId}
      onSelect={setSelectedId}
    />
  )

  const venueList = !data ? (
    <SkeletonCard />
  ) : data.venues.length === 0 ? (
    <Typography variant="small">Aucun lieu ouvert en ce moment autour de toi.</Typography>
  ) : (
    <ListCard maxHeight={400} scrollRef={scrollRef}>
      {data.venues.map((v, i) => {
        const props = venueRowProps(v)
        return (
          <View key={v.id} {...rowProps(v.id)}>
            <VenueRow
              {...props}
              perk={wide ? props.perk : null}
              inset={wide ? 16 : 14}
              last={i === data.venues.length - 1}
              selected={v.id === selectedId}
              onPress={() => openVenue(v.slug)}
            />
          </View>
        )
      })}
    </ListCard>
  )

  if (!wide) {
    return (
      <MobileScreen
        insets={insets}
        header={
          <BrandHeader
            onHome={openHome}
            right={
              me?.mainRating ? (
                <RatingBadge value={formatRating(me.mainRating.rating)} />
              ) : undefined
            }
          />
        }
        tabBar={
          <PlayerTabBar
            badges={badges}
            active="explorer"
            onSelect={openTab}
            onCreate={() => openCreateRoom()}
            bottomInset={Math.max(22, insets.bottom)}
          />
        }
      >
        {title}
        {filters}
        {error}
        {wantedBanner}
        <Section title="Soirées ce soir" link="Agenda" onLink={openAgenda}>
          {eventList}
        </Section>
        <Section title="Il manque des joueurs">{roomList}</Section>
        <Section title="Lieux ouverts" link="Tous les lieux" onLink={openVenues}>
          {map(200)}
          {venueList}
        </Section>
      </MobileScreen>
    )
  }

  return (
    <WebScreen nav={<PlayerNav active="explorer" />}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 72 }}>
        <View style={{ flex: 1, minWidth: 0 }}>{title}</View>
        {me ? (
          <View style={{ width: 380 }}>
            <ProfileCard
              pseudo={me.pseudo ?? ''}
              format={me.mainRating?.format}
              rating={me.mainRating ? formatRating(me.mainRating.rating) : undefined}
              xp={xpLevel(me.xp)}
            />
          </View>
        ) : null}
      </View>
      {filters}
      {error}
      {wantedBanner}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 40 }}>
        <View style={{ flex: 7, minWidth: 0, gap: 40 }}>
          <Section title="Soirées ce soir" link="Tout l'agenda" onLink={openAgenda}>
            {eventList}
          </Section>
          <Section title="Il manque des joueurs" link="Voir les rooms" onLink={openAgendaRooms}>
            {roomList}
          </Section>
        </View>
        <View style={{ flex: 5, minWidth: 0 }}>
          <Section title="Lieux ouverts" link="Tous les lieux" onLink={openVenues}>
            {map(280)}
            {venueList}
          </Section>
        </View>
      </View>
    </WebScreen>
  )
}

/**
 * Bouton d'une soirée de l'accueil (LKO-129) : fait ce qu'il annonce. « S'inscrire » ou « Liste d'attente »
 * inscrit tout de suite, « Inscription » ouvre la billetterie ; sinon (ou si l'inscription est refusée, ex.
 * âge minimum), la fiche de la soirée.
 */
function EventAction({ event }: { event: Parameters<typeof agendaAction>[0] & { id: string } }) {
  const action = agendaAction(event)
  const { register } = useEventMutations(event.id)
  const registers = event.registrationMode === 'IN_APP' && !event.myRegistration
  const onPress = () => {
    if (action.url) return void Linking.openURL(action.url)
    if (!registers) return openEvent(event.id)
    register.mutate(undefined, { onError: () => openEvent(event.id) })
  }
  return (
    <Button
      small
      kind={action.kind}
      label={action.label}
      disabled={register.isPending}
      onPress={onPress}
    />
  )
}
