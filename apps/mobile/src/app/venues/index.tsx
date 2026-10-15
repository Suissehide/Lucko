import {
  Banner,
  Chip,
  colors,
  EmptyState,
  ListCard,
  PageTitle,
  ScreenHeader,
  SkeletonCard,
  Typography,
  VenueRow,
} from '@lucko/design-system'
import { PARTNER_TIE_METERS, RADIUS_KM } from '@lucko/shared'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { MapFrame } from '@/components/explore/MapFrame'
import { PlayerScreen } from '@/components/PlayerScreen'
import { venueRowProps } from '@/lib/explore'
import { goBack, openVenue } from '@/lib/navigation'
import { useLocation } from '@/lib/useLocation'
import { venuesQueryOptions } from '@/queries/useExplore'
import { useMeQuery } from '@/queries/useMe'

const WIDE = 900

/**
 * Tous les lieux autour du joueur (B2, KWT-75) : carte et liste dans l'ordre de l'API (tri honnête :
 * la distance d'abord, les partenaires devant seulement à distance égale), badge partenaire.
 */
export default function VenuesScreen() {
  const wide = useWindowDimensions().width >= WIDE
  const me = useMeQuery()
  const { place, ready } = useLocation()
  const radiusKm = me?.searchRadiusKm ?? RADIUS_KM.default
  const venues = useQuery({ ...venuesQueryOptions(place.lat, place.lng, radiusKm), enabled: ready })
  const [openOnly, setOpenOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const shown = (venues.data ?? []).filter((v) => !openOnly || v.openNow)

  const filters = (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Chip tall label="Tous" active={!openOnly} onPress={() => setOpenOnly(false)} />
      <Chip tall label="Ouverts maintenant" active={openOnly} onPress={() => setOpenOnly(true)} />
    </View>
  )
  const map = (
    <View style={{ gap: 8 }}>
      <MapFrame
        height={wide ? 520 : 240}
        center={place}
        venues={shown}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Legend color={colors.venue} label="Lieu partenaire" />
        <Legend color={colors.white} label="Autre lieu" />
      </View>
    </View>
  )
  const list = !venues.data ? (
    venues.isError ? (
      <Banner
        tone="err"
        message="Impossible de charger les lieux."
        action="Réessayer"
        onAction={() => void venues.refetch()}
      />
    ) : (
      <SkeletonCard />
    )
  ) : shown.length === 0 ? (
    <EmptyState
      dashed
      icon={<Typography variant="h2">◎</Typography>}
      title={openOnly ? 'Rien d’ouvert en ce moment' : 'Aucun lieu dans ton rayon'}
      text={
        openOnly
          ? 'Affiche tous les lieux pour voir leurs horaires.'
          : `Agrandis ton rayon de recherche (${radiusKm} km) dans ton profil.`
      }
    />
  ) : (
    <ListCard>
      {shown.map((v, i) => {
        const props = venueRowProps(v)
        return (
          <VenueRow
            key={v.id}
            {...props}
            perk={wide ? props.perk : null}
            inset={wide ? 16 : 14}
            last={i === shown.length - 1}
            onPress={() => openVenue(v.slug)}
          />
        )
      })}
    </ListCard>
  )
  const note = (
    <Typography variant="small">
      Classés par distance, à {radiusKm} km autour de toi. À distance égale (moins de{' '}
      {PARTNER_TIE_METERS} m d’écart), les lieux partenaires, qui rémunèrent Lucko pour chaque
      joueur venu, passent devant ; un lieu plus proche reste toujours avant.
    </Typography>
  )

  return (
    <PlayerScreen
      tab="explorer"
      wide={wide}
      pushed
      header={<ScreenHeader title="Lieux" onBack={goBack} />}
    >
      {wide ? (
        <>
          <PageTitle title="Où jouer" />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 32 }}>
            <View style={{ flex: 6, minWidth: 0 }}>{map}</View>
            <View style={{ flex: 5, minWidth: 0, gap: 14 }}>
              {filters}
              {note}
              {list}
            </View>
          </View>
        </>
      ) : (
        <>
          {map}
          {filters}
          {note}
          {list}
        </>
      )}
    </PlayerScreen>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: colors.ink,
          backgroundColor: color,
        }}
      />
      <Typography variant="small">{label}</Typography>
    </View>
  )
}
