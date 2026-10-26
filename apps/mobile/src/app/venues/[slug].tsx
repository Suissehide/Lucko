import {
  AccessibilityList,
  Banner,
  Button,
  border,
  Carousel,
  ClosureRow,
  colors,
  DataCredit,
  FactCard,
  font,
  HoursCard,
  IconButton,
  InfoChip,
  ListCard,
  MobileScreen,
  PerkBanner,
  PhotoCarousel,
  PhotoGallery,
  PhotoViewer,
  RoomCard,
  ScreenHeader,
  Section,
  Segmented,
  SkeletonCard,
  StatusPill,
  Tag,
  TextLink,
  Typography,
  WebScreen,
} from '@lucko/design-system'
import { formatDistance, metersBetween, VENUE_TYPE_LABELS } from '@lucko/shared'
import { useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { type ReactNode, useState } from 'react'
import { Linking, Text, useWindowDimensions, View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ExploreMap } from '@/components/explore/ExploreMap'
import { PlayerNav } from '@/components/PlayerNav'
import { VenueAgenda } from '@/components/venue/VenueAgenda'
import { roomCardProps } from '@/lib/explore'
import { goBack, openCreateRoom, openRoom } from '@/lib/navigation'
import { useLocation } from '@/lib/useLocation'
import {
  accessibilityItems,
  gameTabs,
  hoursRows,
  openingPill,
  upcomingClosures,
  venueFacts,
} from '@/lib/venue'
import { useVenueQuery } from '@/queries/useVenue'

const WIDE = 900

const statusColor = { ok: colors.venue, warn: colors.muted, err: colors.room } as Record<
  string,
  string
>

// Colonne latérale collée en haut au défilement (web uniquement, absent des types React Native)
const sticky = { position: 'sticky', top: 24 } as unknown as ViewStyle

/** Fiche lieu (B3, LKO-73) : photos, infos pratiques, horaires et fermetures, agenda, rooms, jeux, accès. */
export default function VenueScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const wide = useWindowDimensions().width >= WIDE
  const insets = useSafeAreaInsets()
  const { place, located } = useLocation()
  const { data: venue, isError: failed, refetch } = useVenueQuery(slug)
  const [gameTab, setGameTab] = useState(0)
  const [viewer, setViewer] = useState(false)

  const nav = <PlayerNav active="" />

  if (!venue) {
    const body = failed ? (
      <Banner
        tone="err"
        message="Impossible de charger ce lieu."
        action="Réessayer"
        onAction={() => void refetch()}
      />
    ) : (
      <SkeletonCard />
    )
    return wide ? (
      <WebScreen nav={nav}>{body}</WebScreen>
    ) : (
      <MobileScreen insets={insets} header={<ScreenHeader title="Lieu" onBack={goBack} />}>
        {body}
      </MobileScreen>
    )
  }

  const itinerary = () =>
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`,
    )
  const pill = openingPill(venue)
  const distance = located
    ? formatDistance(metersBetween({ latitude: place.lat, longitude: place.lng }, venue))
    : null
  const type = VENUE_TYPE_LABELS[venue.type]
  const address = [venue.address, venue.city].filter(Boolean).join(', ')
  const facts = venueFacts(venue)
  const closures = upcomingClosures(venue.closures)
  const access = accessibilityItems(venue.accessibility)
  const tabs = gameTabs(venue)
  const tab = tabs[gameTab] ?? tabs[0]
  const rooms = venue.rooms.map((room) => ({ id: room.id, ...roomCardProps(room) }))
  const contact = [venue.phone, venue.website?.replace(/^https?:\/\//, '')]
    .filter(Boolean)
    .join(' · ')

  const partner = venue.isPartner ? <Tag variant="partner" label="Partenaire" /> : null
  const perk =
    venue.isPartner && venue.luckoPerk ? (
      <PerkBanner text={venue.luckoPerk} compact={!wide} />
    ) : null
  const createRoom = (
    <Button kind="rating" label="+ Créer une room ici" onPress={() => openCreateRoom(venue.slug)} />
  )
  const itineraryButton = <Button kind="ghost" label="Itinéraire" onPress={itinerary} />

  const hours = venue.openingHours.length ? (
    <HoursCard
      rows={hoursRows(venue.openingHours)}
      title={wide ? 'Horaires' : undefined}
      status={wide ? pill?.short : undefined}
      statusColor={pill ? statusColor[pill.tone] : undefined}
    />
  ) : null

  const games = tab ? (
    <Section
      title="Jeux sur place"
      aside={<Mono>{`${tab.count} jeu${tab.count > 1 ? 'x' : ''}`}</Mono>}
    >
      {tabs.length > 1 ? (
        <View style={wide ? { width: 360 } : null}>
          <Segmented
            items={tabs.map((t) => `${t.title} (${t.count})`)}
            value={tabs.indexOf(tab)}
            onChange={setGameTab}
          />
        </View>
      ) : null}
      <GamesCard wide={wide} note={tab.note} games={tab.games} more={tab.more} />
    </Section>
  ) : null

  const accessibility = access.length ? (
    <AccessibilityList items={access} columns={wide ? 2 : 1} />
  ) : null

  if (!wide) {
    const back = (
      <IconButton
        label="Retour"
        size={44}
        icon={<ArrowLeft size={22} color={colors.ink} strokeWidth={2.5} />}
        onPress={goBack}
      />
    )
    return (
      <MobileScreen
        insets={insets}
        header={
          venue.photos.length ? undefined : <ScreenHeader title={venue.name} onBack={goBack} />
        }
        hero={
          venue.photos.length ? (
            <View style={{ borderBottomWidth: border.base, borderColor: colors.ink }}>
              <PhotoCarousel photos={venue.photos} height={300}>
                <View style={{ position: 'absolute', left: 16, top: insets.top + 12 }}>{back}</View>
              </PhotoCarousel>
            </View>
          ) : undefined
        }
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {itineraryButton}
            <View style={{ flex: 1 }}>{createRoom}</View>
          </View>
        }
      >
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Typography variant="label">{[type, distance].filter(Boolean).join(' · ')}</Typography>
            {partner}
          </View>
          <Typography variant="h1" style={{ fontSize: 32, lineHeight: 32 }}>
            {venue.name}
          </Typography>
          {pill ? <StatusPill tone={pill.tone} label={pill.label} /> : null}
        </View>
        {venue.description ? (
          <Text style={{ ...font('body', 500), fontSize: 15, lineHeight: 22, color: colors.ink }}>
            {venue.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {facts.map((f) => (
            <FactCard key={f.label} label={f.short ?? f.label} value={f.value} compact />
          ))}
        </View>
        {perk}

        {hours ? (
          <Section
            title="Horaires"
            aside={pill ? <Mono color={statusColor[pill.tone]}>{pill.short}</Mono> : null}
          >
            {hours}
            {closures.map((c) => (
              <ClosureRow key={c.id} {...c} compact />
            ))}
          </Section>
        ) : null}

        <VenueAgenda venue={venue} wide={false} />

        {rooms.length ? (
          <Section title="Rooms ouvertes">
            <Carousel>
              {rooms.map((room) => (
                <View key={room.id} style={{ width: 240 }}>
                  <RoomCard {...room} onPress={() => openRoom(room.id)} />
                </View>
              ))}
            </Carousel>
          </Section>
        ) : null}

        {games}

        <Section title="Accès">
          {accessibility}
          <AddressBlock
            address={address}
            transit={venue.transitInfo}
            contact={contact}
            fromOsm={!!venue.osmId}
          />
        </Section>
      </MobileScreen>
    )
  }

  return (
    <WebScreen nav={nav} contentStyle={{ paddingTop: 32 }}>
      <View style={{ alignSelf: 'flex-start' }}>
        <TextLink icon={ArrowLeft} label="Lieux près de toi" onPress={goBack} />
      </View>

      <PhotoGallery photos={venue.photos} onOpen={() => setViewer(true)} />
      <PhotoViewer visible={viewer} photos={venue.photos} onClose={() => setViewer(false)} />

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 32,
        }}
      >
        <View style={{ flexShrink: 1, gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Typography variant="label">
              {`${type} · ${venue.city}${venue.quarter ? `, ${venue.quarter}` : ''}`}
            </Typography>
            {partner}
          </View>
          <Typography variant="display" style={{ fontSize: 64, lineHeight: 62 }}>
            {venue.name}
          </Typography>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
            {pill ? <StatusPill tone={pill.tone} label={pill.label} /> : null}
            <Text style={{ ...font('body', 500), fontSize: 15, color: colors.ink }}>{address}</Text>
            {distance ? <Mono>{distance}</Mono> : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {itineraryButton}
          {createRoom}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 40 }}>
        <View style={{ flex: 7, minWidth: 0, gap: 40 }}>
          {venue.description ? (
            <Text
              style={{
                ...font('body', 500),
                maxWidth: 640,
                fontSize: 17,
                lineHeight: 26,
                color: colors.ink,
              }}
            >
              {venue.description}
            </Text>
          ) : null}
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {facts.map((f) => (
                <FactCard key={f.label} {...f} />
              ))}
            </View>
            {perk}
          </View>

          <VenueAgenda venue={venue} wide />

          <Section
            title="Rooms ouvertes ici"
            aside={<Typography variant="small">Parties lancées par des joueurs</Typography>}
          >
            {rooms.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                {rooms.map((room) => (
                  <View key={room.id} style={{ width: '48%' }}>
                    <RoomCard {...room} onPress={() => openRoom(room.id)} />
                  </View>
                ))}
              </View>
            ) : (
              <Typography variant="small">
                Aucune room ouverte ici pour l'instant. Lance la première !
              </Typography>
            )}
          </Section>

          {games}

          {accessibility ? <Section title="Accès et accessibilité">{accessibility}</Section> : null}
        </View>

        <View style={[{ flex: 4, minWidth: 0, gap: 24 }, sticky]}>
          {hours}
          {closures.length ? (
            <ListCard>
              <View style={{ paddingVertical: 16, paddingHorizontal: 18, gap: 12 }}>
                <Typography variant="h2">Fermetures</Typography>
                {closures.map((c) => (
                  <ClosureRow key={c.id} {...c} />
                ))}
              </View>
            </ListCard>
          ) : null}
          <ListCard>
            <View style={{ height: 180, borderBottomWidth: border.base, borderColor: colors.ink }}>
              <ExploreMap
                center={{ lat: venue.latitude, lng: venue.longitude, label: venue.name }}
                venues={[venue]}
                selectedId={venue.id}
                onSelect={itinerary}
              />
            </View>
            <View style={{ paddingVertical: 14, paddingHorizontal: 18 }}>
              <AddressBlock
                address={address}
                transit={venue.transitInfo}
                contact={contact}
                fromOsm={!!venue.osmId}
              />
            </View>
          </ListCard>
        </View>
      </View>
    </WebScreen>
  )
}

function Mono({ children, color = colors.muted }: { children: string; color?: string }) {
  return <Text style={{ ...font('mono', 700), fontSize: 12, color }}>{children}</Text>
}

function AddressBlock({
  address,
  transit,
  contact,
  fromOsm,
}: {
  address: string
  transit: string | null
  contact: string
  fromOsm: boolean
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...font('body', 800), fontSize: 15, color: colors.ink }}>{address}</Text>
      {transit ? <Typography variant="small">{transit}</Typography> : null}
      {contact ? <Typography variant="small">{contact}</Typography> : null}
      {fromOsm ? (
        <DataCredit
          source="© contributeurs OpenStreetMap"
          href="https://www.openstreetmap.org/copyright"
        />
      ) : null}
    </View>
  )
}

function GamesCard({
  wide,
  note,
  games,
  more,
}: {
  wide: boolean
  note: string | null
  games: string[]
  more: string | null
}) {
  const chips: ReactNode = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {games.map((g) => (
        <InfoChip key={g} label={g} />
      ))}
      {more ? <InfoChip label={more} muted /> : null}
    </View>
  )
  const text = note ? <Typography variant="small">{note}</Typography> : null
  return wide ? (
    <ListCard>
      <View style={{ paddingVertical: 18, paddingHorizontal: 20, gap: 14 }}>
        {text}
        {chips}
      </View>
    </ListCard>
  ) : (
    <>
      {text}
      {chips}
    </>
  )
}
