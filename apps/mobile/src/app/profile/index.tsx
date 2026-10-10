import {
  AvailabilityGrid,
  Button,
  colors,
  IconButton,
  LevelCard,
  ListCard,
  ListRow,
  Panel,
  ProfileIdentity,
  RankCard,
  RankRow,
  Section,
  SkeletonCard,
  space,
  TextLink,
  Typography,
} from '@lucko/design-system'
import { xpLevel } from '@lucko/shared'
import { router } from 'expo-router'
import { Settings } from 'lucide-react-native'
import { useWindowDimensions, View } from 'react-native'
import { PlayerScreen } from '@/components/PlayerScreen'
import { openManageVenue, openSettings } from '@/lib/navigation'
import { placeLine, rankProps, vibeLabels, visibleAvatar } from '@/lib/profile'
import { useMeQuery } from '@/queries/useMe'

const WIDE = 900

const openEdit = () => router.push('/profile/edit')
const openGames = () => router.push('/profile/games')

/** Profil du joueur (F1) : identité, niveau, LK par jeu, disponibilités. Les parties sont dans Mes parties. */
export default function ProfileScreen() {
  const wide = useWindowDimensions().width >= WIDE
  const me = useMeQuery({ required: true })

  const header = wide ? null : (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: space.screen,
        paddingTop: 6,
        paddingBottom: 10,
      }}
    >
      <Typography variant="h2">Profil</Typography>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton
          size={44}
          label="Réglages"
          onPress={openSettings}
          icon={<Settings size={20} color={colors.ink} strokeWidth={2.5} />}
        />
        <Button small kind="ghost" label="Modifier" onPress={openEdit} />
      </View>
    </View>
  )

  if (!me) {
    return (
      <PlayerScreen tab="profil" wide={wide} header={header}>
        <SkeletonCard />
        <SkeletonCard />
      </PlayerScreen>
    )
  }

  const pseudo = me.pseudo ?? ''
  const xp = xpLevel(me.xp)
  const identity = (
    <ProfileIdentity
      wide={wide}
      pseudo={pseudo}
      avatarUri={visibleAvatar(me)}
      place={placeLine(me, !wide)}
      vibes={vibeLabels(me)}
      xp={xp}
      onEdit={openEdit}
    />
  )

  const rankings = me.rankings.length ? (
    wide ? (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        {me.rankings.map((r) => (
          <View key={`${r.game.slug}-${r.format}`} style={{ flexBasis: 240, flexGrow: 1 }}>
            <RankCard {...rankProps(r)} />
          </View>
        ))}
      </View>
    ) : (
      <ListCard>
        {me.rankings.map((r, i) => {
          const { shortNote, ...props } = rankProps(r)
          return (
            <RankRow
              key={`${r.game.slug}-${r.format}`}
              {...props}
              note={shortNote}
              last={i === me.rankings.length - 1}
            />
          )
        })}
      </ListCard>
    )
  ) : (
    <Typography variant="small">
      Pas encore de LK : ils apparaissent après tes premières parties classées en TCG.
    </Typography>
  )

  // Espace gérant (LKO-61) : publier les événements de son lieu, partenaire ou non
  const managed = me.venues.filter((v) => v.role === 'MANAGER')
  const myVenues = managed.length ? (
    <Section title={managed.length > 1 ? 'Mes lieux' : 'Mon lieu'}>
      <ListCard>
        {managed.map((venue, i) => (
          <ListRow
            key={venue.id}
            inset={16}
            title={venue.name}
            subtitle="Publier et gérer les événements"
            last={i === managed.length - 1}
            onPress={() => openManageVenue(venue.id)}
          />
        ))}
      </ListCard>
    </Section>
  ) : null

  if (!wide) {
    return (
      <PlayerScreen tab="profil" wide={false} header={header}>
        {identity}
        {myVenues}
        <Section title="Classements" link="Mes jeux" onLink={openGames}>
          {rankings}
        </Section>
      </PlayerScreen>
    )
  }

  return (
    <PlayerScreen tab="profil" wide>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 72 }}>
        <View style={{ flex: 1, minWidth: 0 }}>{identity}</View>
        <View style={{ width: 380 }}>
          <LevelCard {...xp} />
        </View>
      </View>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 16 }}>
          <Typography variant="h2">Classements par jeu</Typography>
          <Typography variant="small">LK calculés sur les parties classées</Typography>
          <TextLink label="Mes jeux" onPress={openGames} />
        </View>
        {rankings}
      </View>
      {myVenues}
      <Section title="Disponibilités" link="Modifier" onLink={openEdit}>
        <Panel>
          <AvailabilityGrid value={me.availability} />
        </Panel>
      </Section>
    </PlayerScreen>
  )
}
