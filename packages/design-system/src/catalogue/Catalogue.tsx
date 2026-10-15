'use client'

import { CircleHelp, ExternalLink, Plus, SlidersHorizontal, Trash2 } from 'lucide-react-native'
import { type ReactNode, useState } from 'react'
import { ScrollView, View } from 'react-native'
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  Chip,
  CountBadge,
  DateBlock,
  DayChip,
  FilterButton,
  FilterTag,
  IconButton,
  InfoChip,
  Inset,
  Logo,
  Note,
  type Presence,
  PresenceToggle,
  ProgressSteps,
  Quote,
  Radio,
  RatingScale,
  Skeleton,
  Slider,
  SourceTag,
  Spinner,
  StatusPill,
  Swatch,
  Tag,
  TextLink,
  Toggle,
  Typography,
} from '../atoms'
import {
  AccessibilityList,
  AgendaCard,
  AgendaEventCard,
  AgendaRow,
  AvailabilityGrid,
  AvatarStack,
  Banner,
  Brand,
  CardFan,
  ChatBubble,
  ChatComposer,
  ChatDivider,
  ChatGroupLabel,
  ChatHeader,
  ChatRow,
  ChecklistItem,
  ChecklistRow,
  ChipGroup,
  ChoiceCard,
  ClosureRow,
  CodeInput,
  ColorLegend,
  ContentCard,
  Countdown,
  DataCredit,
  DayEventRow,
  DecisionCard,
  DemandCard,
  EmptyState,
  EventCard,
  FactCard,
  FuzzyZoneLabel,
  GameTile,
  HoursCard,
  LevelCard,
  LinkCard,
  ListCard,
  ListRow,
  OptionCard,
  PageTitle,
  Pagination,
  PairingRow,
  Panel,
  PerkBanner,
  PersonCell,
  PhotoReviewCard,
  PinnedBanner,
  PriorityBanner,
  ProfileCard,
  ProfileIdentity,
  QrPass,
  QueueCard,
  QueueItem,
  RadiusMap,
  RankCard,
  RankRow,
  RatingBadge,
  ReasonForm,
  ReviewCard,
  RoomCard,
  RoomStatusTimeline,
  ScanResult,
  ScorePicker,
  ScreenHeader,
  Segmented,
  SettingRow,
  SettingsCard,
  SettingsField,
  SettingsGroup,
  SettingsNav,
  SettingsRow,
  SettingsSection,
  ShareBar,
  SkeletonCard,
  StatCard,
  StatStrip,
  StepHeader,
  Stepper,
  StripeRow,
  SuccessState,
  TextField,
  TimelineItem,
  TimePicker,
  Section as TitledSection,
  Toast,
  ToggleGroup,
  VenueRow,
  WantToPlayRow,
  XpBar,
} from '../molecules'
import {
  Accordion,
  BarChart,
  ContextMenu,
  DataTable,
  DetailCard,
  FilterMenu,
  type MenuAnchor,
  MonthCalendar,
  type PlayerTab,
  PlayerTabBar,
  PlayIntentsCard,
  Popover,
  playerNavItems,
  RankPicker,
  Sidebar,
  SiteFooter,
  type Sort,
  StepsAside,
  TopNav,
  VenueTabBar,
} from '../organisms'
import { colors, dark, space } from '../tokens'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 14 }}>
      <Typography variant="h2">{title}</Typography>
      {children}
    </View>
  )
}

function Row({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
      {children}
    </View>
  )
}

type Event = { id: string; name: string; date: string; seats: string; status: string }
const events: Event[] = [
  { id: '1', name: 'Tournoi Pioneer', date: 'ven. 18 oct.', seats: '12 / 16', status: 'ok' },
  { id: '2', name: 'Soirée Commander', date: 'sam. 19 oct.', seats: '8 / 8', status: 'warn' },
  { id: '3', name: 'Draft Duskmourn', date: 'mer. 23 oct.', seats: '3 / 8', status: 'info' },
]
const statusLabel: Record<string, string> = { ok: 'Ouvert', warn: 'Complet', info: 'Brouillon' }

/** Vitrine de tous les composants, utilisée par les routes /design-system du web et du mobile. */
export function Catalogue() {
  const [seg, setSeg] = useState(0)
  const [game, setGame] = useState<string | null>(null)
  const [chip, setChip] = useState(true)
  const [toggle, setToggle] = useState(true)
  const [check, setCheck] = useState(true)
  const [radio, setRadio] = useState(0)
  const [players, setPlayers] = useState(4)
  const [minute, setMinute] = useState(19 * 60 + 30)
  const [name, setName] = useState('')
  const [page, setPage] = useState(7)
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const [sort, setSort] = useState<Sort>({ key: 'date', dir: 'desc' })
  const [selected, setSelected] = useState<string[]>([])
  const [tab, setTab] = useState<PlayerTab>('explorer')
  const [radiusKm, setRadiusKm] = useState(10)
  const [slots, setSlots] = useState([5, 11, 14, 17])
  const [vibe, setVibe] = useState(true)
  const [presence, setPresence] = useState<Presence | null>('present')
  const [punctual, setPunctual] = useState(4)
  const [code, setCode] = useState('48')
  const [score, setScore] = useState<string | null>('2-0')
  const [ranking, setRanking] = useState(['hugo'])
  const [notified, setNotified] = useState(true)

  return (
    <ScrollView
      style={{ flex: 1, width: '100%', backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: space.screen, gap: 36, maxWidth: 1000 }}
    >
      <View style={{ gap: 8 }}>
        <Typography variant="display">Plateau pop</Typography>
        <Typography variant="small">
          Design system Lucko : atomes, molécules, organismes, templates.
        </Typography>
      </View>

      <Section title="Atomes">
        <Row>
          <Typography variant="h1">Titre H1</Typography>
          <Typography variant="title">Titre de carte</Typography>
          <Typography variant="label">Label</Typography>
        </Row>
        <Row>
          <Button label="Rejoindre" />
          <Button label="Événement" kind="event" />
          <Button label="Lieu" kind="venue" />
          <Button label="LK" kind="rating" />
          <Button label="Ink" kind="ink" />
          <Button label="Annuler" kind="ghost" />
          <Button label="Désactivé" disabled />
          <Button label="Petit" small />
        </Row>
        <Row>
          <Tag label="Classée" variant="ranked" />
          <Tag label="Normale" />
          <Tag label="Partenaire" variant="partner" />
          <Tag label="Ce soir" variant="tonight" />
          <Tag label="Event" variant="event" />
        </Row>
        <Row>
          <Chip label="Pioneer" active={chip} onPress={() => setChip(!chip)} />
          <Chip label="Commander" />
          <StatusPill label="Confirmée" tone="ok" />
          <StatusPill label="En attente" tone="warn" />
          <StatusPill label="Refusée" tone="err" />
          <StatusPill label="Brouillon" />
          <CountBadge count={3} />
          <CountBadge count={140} />
        </Row>
        <Row>
          <Avatar name="Léa" />
          <Avatar name="Max" color={colors.rating} size={56} badge={<CountBadge count={2} />} />
          <IconButton
            label="Filtrer"
            icon={<SlidersHorizontal size={18} color={colors.ink} strokeWidth={2.5} />}
          />
          <IconButton
            label="Ajouter"
            bg={colors.rating}
            icon={<Plus size={20} color={colors.ink} strokeWidth={2.5} />}
          />
          <DateBlock day="18" month="OCT" />
          <DateBlock day="23" month="OCT" color={colors.room} />
          <Spinner />
        </Row>
        <Row>
          <Toggle label="Notifications" value={toggle} onChange={setToggle} />
          <Checkbox label="J'accepte les règles" value={check} onChange={setCheck} />
          <Radio label="Lieu partenaire" value={radio === 0} onPress={() => setRadio(0)} />
          <Radio label="Domicile" value={radio === 1} onPress={() => setRadio(1)} />
        </Row>
        <ProgressSteps current={2} total={4} />
        <Note>Les résultats sont comptés à la majorité des présents.</Note>
        <Note tone="room">Ce lieu est fermé ce soir : impossible d'y créer une room.</Note>
        <View style={{ gap: 8 }}>
          <Skeleton width="70%" />
          <Skeleton width="40%" height={10} />
        </View>
      </Section>

      <Section title="Molécules">
        <ScreenHeader title="Fiche room" onBack={() => {}} />
        <View style={{ marginHorizontal: -space.screen }}>
          <StepHeader
            current={2}
            total={3}
            title="Tu joues où ?"
            subtitle="Une ville et un rayon suffisent."
            onBack={() => {}}
          />
        </View>
        <Segmented items={['Rooms', 'Événements', 'Lieux']} value={seg} onChange={setSeg} />
        <TextField
          label="Nom de la room"
          placeholder="Ex. Pioneer du jeudi"
          value={name}
          onChangeText={setName}
          help="Visible par les autres joueurs"
        />
        <TextField label="E-mail" value="lea@" error="Adresse e-mail incomplète" />
        <Row>
          <Stepper value={players} min={2} max={8} onChange={setPlayers} />
          <RatingBadge value="1 184" reliability={96} />
          <RatingBadge value="1 184" large />
        </Row>
        <XpBar level={7} name="Habitué" current={340} max={500} />
        <Slider label="Rayon" value={radiusKm} min={1} max={50} onChange={setRadiusKm} />
        <Panel title="Disponibilités">
          <AvailabilityGrid
            value={slots}
            onToggle={(s) =>
              setSlots((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]))
            }
          />
        </Panel>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(
            [
              ['Magic', colors.room],
              ['Lorcana', colors.event],
            ] as const
          ).map(([label, color]) => (
            <View key={label} style={{ flex: 1 }}>
              <GameTile
                label={label}
                color={color}
                selected={vibe === (label === 'Magic')}
                onPress={() => setVibe((v) => !v)}
              />
            </View>
          ))}
        </View>
        <RadiusMap radiusKm={radiusKm} label="14 lieux · 23 soirées cette semaine" />
        <Row>
          <DayChip top="Auj." label="8" active onPress={() => {}} />
          <DayChip top="Ven." label="9" active={false} onPress={() => {}} />
          <DayChip other top="Autre" label="date…" active={false} onPress={() => {}} />
          <Chip tall dashed label="Autre heure…" onPress={() => {}} />
        </Row>
        <Row>
          <ChoiceCard
            label="Amicale"
            description="Pour le plaisir. Pas de résultat à saisir."
            selected
            onPress={() => {}}
          />
          <ChoiceCard
            label="Classée"
            description="Indisponible pour les jeux de société."
            disabled
            selected={false}
            onPress={() => {}}
          />
        </Row>
        <Popover
          label="Choisir une heure"
          width={340}
          trigger={({ open, toggle }) => (
            <Chip tall dashed label="Autre heure…" active={open} onPress={toggle} />
          )}
        >
          {() => (
            <View style={{ padding: 14 }}>
              <TimePicker value={minute} min={8 * 60} max={23 * 60 + 45} onChange={setMinute} />
            </View>
          )}
        </Popover>
        <DemandCard
          count="23"
          text="joueurs attendent du Magic près d'ici. Ils seront prévenus dès que la room est créée."
        />
        <SuccessState
          title="Room créée"
          text="Ta room « Commander · bracket 3 » est en ligne au Dé Fêlé."
          actions={<Button kind="rating" label="Voir la room" onPress={() => {}} />}
        />
        <OptionCard
          label="Détente"
          description="On joue pour le plaisir, sans pression."
          value={vibe}
          onChange={setVibe}
        />
        <SettingsGroup
          title="Notifications"
          rows={[
            {
              label: 'Mes rooms',
              description: 'Candidatures, rappels, annulations',
              toggle: { value: toggle, onChange: setToggle },
            },
            { label: 'Joueurs bloqués', value: '2', onPress: () => {} },
          ]}
        />
        <SettingsSection title="Session" description="Ta session sur ce navigateur.">
          <SettingsCard>
            <SettingsField label="E-mail de connexion" value="lea@lucko.fr" />
            <SettingsRow
              wide
              danger
              label="Supprimer mon compte"
              description="C'est définitif."
              aside={<Button small kind="ghost" label="Supprimer…" onPress={() => {}} />}
            />
          </SettingsCard>
        </SettingsSection>
        <Row>
          <SettingsNav
            back="Profil"
            onBack={() => {}}
            items={['Compte', 'Notifications']}
            active={0}
            onSelect={() => {}}
          />
          <View style={{ width: 300 }}>
            <LinkCard
              label="Aide"
              description="Questions fréquentes"
              icon={ExternalLink}
              onPress={() => {}}
            />
          </View>
        </Row>
        <ProfileIdentity
          pseudo="Léa"
          place="Bordeaux · 10 km"
          vibes={['Détente', 'Compétitif']}
          xp={{ level: 4, name: 'Pilier de table', current: 340, max: 500 }}
        />
        <View style={{ width: 380 }}>
          <LevelCard level={4} name="Pilier de table" current={340} max={500} />
        </View>
        <Row>
          <View style={{ width: 240 }}>
            <RankCard
              color={colors.room}
              game="Magic"
              format="Commander"
              rating="1 214"
              note="38 parties classées"
            />
          </View>
          <View style={{ width: 240 }}>
            <RankCard
              color={colors.venue}
              game="One Piece"
              format="Standard"
              rating={null}
              progress="3 / 5"
              note="Encore 2 parties classées avant tes premiers LK"
            />
          </View>
        </Row>
        <ListCard>
          <RankRow
            color={colors.event}
            game="Lorcana"
            format="Core"
            rating="1 310"
            note="12 parties"
            last
          />
        </ListCard>
        <AgendaCard
          wide
          color={colors.event}
          day="06"
          month="OCT"
          label="Soirée jeux · Magic"
          title="Soirée Commander"
          meta="Le Dé Fêlé · 19 h 30"
          count="8/12"
          status={<StatusPill label="Place réservée" tone="ok" />}
          onPress={() => {}}
        />
        <AgendaCard
          color={colors.room}
          day="04"
          month="OCT"
          label="Room classée · Pokémon"
          title="Standard à 4"
          meta="Carte Blanche · 21 h"
          count="3/4"
          status={<StatusPill label="Il manque 1 joueur" tone="warn" />}
        />
        <ContentCard kind="room" raised>
          <Typography variant="title">Pioneer du jeudi</Typography>
          <Typography variant="small">La Taverne du Dé · 20 h 30 · 3 places</Typography>
          <Row>
            <Tag label="Classée" variant="ranked" />
            <Tag label="Partenaire" variant="partner" />
          </Row>
        </ContentCard>
        <View>
          <ListRow left={<Avatar name="Léa" />} title="Léa" subtitle="Pioneer · LK 1 240" />
          <ListRow
            left={<Avatar name="Max" color={colors.venue} />}
            title="Max"
            subtitle="Commander"
            last
          />
        </View>
        <RoomStatusTimeline current={2} />
        <ReviewCard
          title="Tom_16"
          tags={<Tag label="-18" variant="tonight" />}
          meta="Signalé par hugo · il y a 2 h"
          body="Pseudo limite dans le chat de la room."
          onPress={() => {}}
          actions={
            <>
              <Button small kind="ghost" label="Classer" onPress={() => {}} />
              <Button small kind="room" label="Suspendre" onPress={() => {}} />
            </>
          }
        />
        <Row>
          <View style={{ flex: 1, minWidth: 160 }}>
            <StatCard value="42" label="Joueurs ce soir" delta={{ text: '12 %', up: true }} />
          </View>
          <View style={{ flex: 1, minWidth: 160 }}>
            <StatCard value="7" label="Événements" bg={colors.event} onPress={() => {}} />
          </View>
        </Row>
        <ShareBar label="Pioneer" percent={46} color={colors.room} />
        <Banner message="Ta room commence dans 1 h." action="Voir" onClose={() => {}} />
        <Toast message="Candidature envoyée" action="Annuler" />
        <ListCard>
          <ChatGroupLabel first label="À venir" />
          <ChatRow
            title="Commander à 4"
            time="12:15"
            context="Room classée · Ce soir 20:30 · Le Dé Fêlé"
            preview="Alex : Ok pour moi, je ramène des tapis"
            color={colors.room}
            unread={1}
            selected
            onPress={() => {}}
          />
          <ChatRow
            title="Tournoi Standard"
            time="Lun."
            context="Tournoi · Mer. 7 oct. · Carte Blanche"
            preview="Pas encore de message"
            color={colors.event}
            muted
            onPress={() => {}}
          />
        </ListCard>
        <View style={{ gap: 8 }}>
          <ChatHeader
            title="Avant-première Lorcana"
            detail="Vendredi 16 octobre, 19:00 · Carte Blanche · 18 inscrits"
            color={colors.event}
            link="Voir l’événement"
            onOpen={() => {}}
            muted={false}
            onMute={() => {}}
          />
          <PinnedBanner author="Carte Blanche" text="Accueil dès 18 h 30, boosters sur place." />
          <ChatBubble
            announcement
            author="Fêlé"
            time="19:02"
            text="Ronde 1 lancée, tables 1 à 6."
            avatar={{ name: 'Fêlé', color: colors.venue }}
          />
          <ChatBubble
            author="Léa"
            time="19:40"
            text="Je ramène mon deck Mono-rouge !"
            avatar={{ name: 'Léa', color: colors.event }}
          />
          <ChatBubble indent text="Et des sleeves en rab." />
          <ChatDivider label="Nouveaux messages" />
          <ChatBubble mine time="19:41" text="Parfait, on se retrouve à 20 h." onMenu={setMenu} />
          <ContextMenu
            anchor={menu}
            align="right"
            items={[
              { label: 'Supprimer', icon: Trash2, danger: true, onPress: () => setMenu(null) },
            ]}
            onClose={() => setMenu(null)}
          />
          <ChatBubble mine pending text="J'arrive" />
          <ChatComposer value="" onChange={() => {}} onSend={() => {}} status="Léa écrit…" />
          <ChatComposer compact value="" onChange={() => {}} onSend={() => {}} />
        </View>
        <EmptyState
          icon={<CircleHelp size={28} color={colors.ink} strokeWidth={2.5} />}
          title="Aucune room ce soir"
          text="Crée la tienne : les joueurs du coin seront prévenus."
          action={<Button label="Créer une room" small />}
        />
        <SkeletonCard />
        <CardFan size="sm" />
        <Brand />
        <PageTitle eyebrow="Samedi 3 octobre · Bordeaux" title="Ce soir près de toi" />
        <ChipGroup
          items={[
            { key: null, label: 'Tous' },
            { key: 'magic', label: 'Magic' },
            { key: 'pokemon', label: 'Pokémon' },
          ]}
          value={game}
          onChange={setGame}
        />
        <TitledSection title="Soirées ce soir" link="Tout le programme" onLink={() => {}}>
          <EventCard
            wide
            raised
            day="03"
            time="19H30"
            label="Soirée jeux · Magic"
            title="Soirée Commander"
            meta="Le Dé Fêlé · 1,2 km"
            places="4 places sur 12"
            partner
            action={<Button small label="S'inscrire" />}
          />
          <EventCard
            day="03"
            time="20H"
            label="Tournoi · Pokémon"
            title="Tournoi Standard"
            meta="Carte Blanche · 800 m"
            places="2 places sur 16"
            onPress={() => {}}
          />
        </TitledSection>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          <View style={{ width: 300 }}>
            <RoomCard
              wide
              label="Partie classée · Pokémon"
              title="Il manque 2 joueurs"
              meta="Le Dé Fêlé · 21 h"
              players={['M', 'S']}
              capacity={4}
              rating="1 180 – 1 260"
              onPress={() => {}}
            />
          </View>
          <View style={{ width: 300 }}>
            <ProfileCard
              pseudo="Léa"
              format="Commander"
              rating="1 214"
              xp={{ level: 4, name: 'Pilier de table', current: 340, max: 500 }}
            />
          </View>
        </View>
        <AvatarStack names={['T', 'A', 'J']} />
        <ListCard>
          <VenueRow
            inset={16}
            name="Le Dé Fêlé"
            subtitle="Bar à jeux · jusqu'à 1 h"
            distance="1,2 km"
            partner
            perk="Droit de jeu offert avec Lucko"
            onPress={() => {}}
          />
          <VenueRow
            inset={16}
            last
            name="Carte Blanche"
            subtitle="Boutique TCG · jusqu'à 22 h"
            distance="800 m"
            onPress={() => {}}
          />
        </ListCard>
        <Row>
          <FactCard label="Droit de jeu" value="5 €" note="par personne, toute la soirée" />
          <FactCard label="Âge" value="16 ans +" compact />
        </Row>
        <PerkBanner text="Droit de jeu offert sur présentation de l'app" />
        <ToggleGroup items={['Liste', 'Calendrier']} value={0} onChange={() => {}} />
        <AgendaEventCard
          wide
          kind="room"
          weekday="SAM"
          day="07"
          month="OCT"
          label="Tournoi · Pokémon"
          title="Tournoi Standard"
          meta="19 h 30 · 8 €"
          places="2 places sur 16"
          placesAlert
          action={<Button small label="S'inscrire" />}
          onPress={() => {}}
        />
        <HoursCard
          title="Horaires"
          status="Ouvert"
          rows={[
            { day: 'Lundi', value: 'Fermé', closed: true },
            { day: 'Samedi', value: '14 h – 2 h', today: true },
          ]}
        />
        <ClosureRow date="1er nov." label="Fermé (Toussaint)" note="Réouverture le 2 novembre" />
        <ClosureRow date="11 nov." label="Ouverture à 14 h" special />
        <AccessibilityList
          columns={2}
          items={[
            { label: 'Accès de plain-pied', status: 'yes' },
            { label: "Salle à l'étage", note: 'Escalier uniquement', status: 'no' },
            { label: 'Niveau sonore', note: 'Animé le samedi soir', status: 'info' },
          ]}
        />
        <Row>
          <InfoChip label="Cascadia" />
          <InfoChip label="+ 290 autres" muted />
        </Row>
      </Section>

      <Section title="Agenda de la ville">
        <Row>
          <FilterMenu
            label="Type"
            options={[
              { value: 'room', label: 'Room', count: 2, selected: true, swatch: colors.rating },
              {
                value: 'tournoi',
                label: 'Tournoi',
                count: 0,
                selected: false,
                swatch: colors.room,
              },
            ]}
            results={2}
            onToggle={() => {}}
            onClear={() => {}}
          />
          <FilterButton small label="Filtres" count={2} active onPress={() => {}} />
          <FilterTag label="Magic" onRemove={() => {}} />
        </Row>
        <ListCard>
          <AgendaRow
            wide
            first
            time="19:30"
            color={colors.rating}
            tint={colors.ratingPale}
            type="Room"
            title="Room Magic · Commander"
            meta="Le Dé Fêlé · 450 m · Magic"
            partner
            places="1 place"
            placesTone="alert"
            price="Gratuit"
            action={<Button small kind="rating" label="Rejoindre" />}
          />
        </ListCard>
        <AgendaRow
          time="21:00"
          color={colors.event}
          tint={colors.eventSoft}
          type="Soirée jeux"
          title="Blind test et jeux d'ambiance"
          meta="La Taverne des Dés · 2,8 km · Gratuit"
          adult
          places="Accès libre"
        />
        <PlayIntentsCard
          subtitle="On te prévient dès qu'une room s'ouvre près de toi."
          rows={[
            {
              id: 'mtg',
              game: 'Magic : Commander',
              demand: "23 joueurs l'attendent à Bordeaux",
              on: true,
            },
            { id: 'op', game: 'One Piece', demand: 'Sois parmi les premiers', on: false },
          ]}
          footer="Les hôtes voient combien de joueurs attendent un jeu, jamais qui."
          onToggle={() => {}}
        />
        <ColorLegend
          items={[
            { label: 'Room entre joueurs', color: colors.rating },
            { label: 'Tournoi', color: colors.room },
          ]}
        />
      </Section>

      <Section title="Organismes">
        <MonthCalendar
          title="Octobre 2026"
          days={Array.from({ length: 35 }, (_, i) => ({
            key: String(i),
            day: i < 3 || i > 33 ? null : i - 2,
            today: i === 5,
            past: i < 5,
            closed: i % 7 === 0,
            items: i === 9 ? [{ label: 'Tournoi Pokémon', color: colors.room }] : [],
          }))}
          selected="9"
          onSelect={() => {}}
          onNext={() => {}}
          dayTitle="Mercredi 7 octobre"
          legend={[
            { label: 'Soirée', color: colors.event },
            { label: 'Tournoi', color: colors.room },
          ]}
        >
          <DayEventRow
            color={colors.room}
            label="19 h 30 · Tournoi · Pokémon"
            title="Tournoi Standard"
            meta="8 € · 2 places sur 16"
            metaAlert
          />
        </MonthCalendar>
        <DataTable<Event>
          columns={[
            { key: 'name', label: 'Événement', flex: 2 },
            { key: 'date', label: 'Date', sortable: true },
            { key: 'seats', label: 'Places', mono: true, align: 'right' },
            {
              key: 'status',
              label: 'Statut',
              render: (r) => (
                <StatusPill
                  label={statusLabel[r.status] ?? r.status}
                  tone={r.status as 'ok' | 'warn' | 'info'}
                />
              ),
            },
          ]}
          rows={events}
          sort={sort}
          onSort={setSort}
          selectable
          selected={selected}
          onSelect={setSelected}
          bulkActions={<Button label="Publier" kind="rating" small />}
          footer={<Pagination page={page} pages={20} total={58} perPage={3} onChange={setPage} />}
        />
        <BarChart
          data={[
            { label: 'Lun', value: 4 },
            { label: 'Mar', value: 7 },
            { label: 'Mer', value: 5 },
            { label: 'Jeu', value: 12 },
            { label: 'Ven', value: 9 },
          ]}
          highlight={[3]}
        />
        <Accordion
          items={[
            { q: 'Comment marchent les LK ?', a: 'Ils mesurent ta force par format TCG.' },
            { q: "Et l'XP ?", a: "Elle récompense l'assiduité, pas la victoire." },
          ]}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Logo size={44} />
          <TextLink label="Tout le programme" onPress={() => {}} />
        </View>
        <TopNav
          items={playerNavItems}
          active={tab}
          onSelect={(key) => setTab(key as PlayerTab)}
          right={<Button small kind="rating" label="+ Créer une room" />}
        />
        <View style={{ maxWidth: 420, width: '100%', gap: 12 }}>
          <PlayerTabBar active={tab} onSelect={setTab} onCreate={() => {}} bottomInset={10} />
          <VenueTabBar active="scanner" onSelect={() => {}} bottomInset={10} />
        </View>
        <View style={{ height: 320, flexDirection: 'row' }}>
          <Sidebar
            title="Espace lieu"
            active="ce-soir"
            onSelect={() => {}}
            items={[
              { key: 'ce-soir', label: 'Ce soir', badge: '3' },
              { key: 'evenements', label: 'Événements' },
              { key: 'pointage', label: 'Pointage' },
              { key: 'factures', label: 'Factures', later: true },
            ]}
          />
        </View>
        <View style={{ height: 520, flexDirection: 'row' }}>
          <StepsAside
            title="Trois questions et on te montre où jouer ce soir."
            subtitle="Tu pourras tout changer plus tard dans ton profil."
            steps={['Tes jeux', 'Ta ville', 'Ton pseudo']}
            current={1}
            onSelect={() => {}}
          />
        </View>
        <SiteFooter compact={false} />
        <View style={{ maxWidth: 420, width: '100%' }}>
          <SiteFooter compact />
        </View>
      </Section>

      <Section title="Back-office">
        <View style={{ height: 300, flexDirection: 'row' }}>
          <Sidebar
            dark
            title="Back-office"
            active="reports"
            onSelect={() => {}}
            items={[
              { key: 'dashboard', label: 'Tableau de bord' },
              {
                key: 'reports',
                label: 'Signalements',
                group: 'Modération',
                badge: '2',
                alert: true,
              },
              { key: 'avatars', label: 'Photos de profil', badge: '3' },
              { key: 'venues', label: 'Lieux et événements', group: 'Catalogue', badge: '1' },
            ]}
            footer={<TextLink onDark label="Retour à l’app" onPress={() => {}} />}
          />
        </View>
        <PriorityBanner
          tag="Prioritaire"
          message="1 signalement concerne un joueur mineur."
          action="Traiter maintenant"
          onAction={() => {}}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          <QueueCard
            value={2}
            label="Signalements ouverts"
            note="Le plus ancien : il y a 2 j"
            color={colors.room}
            onPress={() => {}}
          />
          <QueueCard
            value={0}
            label="Joueurs suspendus"
            note="Aucune suspension en cours"
            color={colors.ink}
            onPress={() => {}}
          />
        </View>
        <View style={{ maxWidth: 360, gap: 10 }}>
          <QueueItem
            title="Tom_16"
            tags={<Tag label="-18" variant="alert" />}
            age="il y a 3 h"
            line="Pseudo ou photo inappropriés"
            meta="par Maya"
            stripe={colors.room}
            selected
            onPress={() => {}}
          />
          <PersonCell name="Léa" subtitle="lea@lucko.dev" />
          <Swatch color={colors.venue} label="Suspension levée" />
          <ChecklistItem ok label="Adresse" detail="Géolocalisée sur la carte" />
          <ChecklistItem ok={false} label="Photos" detail="Aucune photo" />
          <TimelineItem color={colors.rating} title="Joueur averti" meta="admin · Mar. 6 oct." />
          <SettingRow
            title="Lieu partenaire"
            description="Badge et avantage Lucko."
            value
            onChange={() => {}}
          />
        </View>
        <DetailCard
          sections={[
            {
              key: 'stats',
              flush: true,
              children: (
                <StatStrip
                  items={[
                    { label: 'Avertissements', value: 0 },
                    { label: 'Suspensions', value: 1 },
                  ]}
                />
              ),
            },
            { key: 'quote', children: <Quote text="Sa photo montre un autre joueur." /> },
            {
              key: 'decision',
              label: 'Décision',
              children: (
                <>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <DecisionCard title="Classer" description="Aucune suite" onPress={() => {}} />
                    <DecisionCard
                      title="Suspendre"
                      description="Compte bloqué"
                      color={colors.room}
                      selected
                      onPress={() => {}}
                    />
                  </View>
                  <ReasonForm
                    label="Motif"
                    durations={[
                      { key: '7', label: '7 jours' },
                      { key: 'def', label: 'Définitive' },
                    ]}
                    consequence="Déconnecté partout."
                    confirmLabel="Suspendre"
                    onConfirm={() => {}}
                    onCancel={() => {}}
                  />
                </>
              ),
            },
          ]}
        />
        <Inset>
          <StripeRow
            stripe={colors.event}
            title="Soirée Commander"
            subtitle="Ven. 9 oct. · 12 places"
          />
        </Inset>
        <View style={{ maxWidth: 300 }}>
          <PhotoReviewCard
            uri="https://picsum.photos/400"
            name="Jade"
            age="il y a 1 h"
            badge="Photo envoyée"
            onOpen={() => {}}
            onApprove={() => {}}
            onReject={() => {}}
          />
        </View>
      </Section>

      <Section title="Présence, parties et progression">
        <View style={{ backgroundColor: dark.bg, padding: 22, borderRadius: 14, gap: 20 }}>
          <QrPass value="lucko:demo:jeton-signe" pseudo="Léa" size={180} scanning />
          <Countdown variant="bar" label="Nouveau code dans" seconds={18} total={30} tone="dark" />
          <Countdown variant="clock" label="Ronde 3" seconds={29 * 60 + 42} tone="dark" />
        </View>
        <ScanResult
          status="ok"
          player={{ pseudo: 'Hugo', level: 3, visits: 4, minor: true }}
          body="Première venue de la semaine : +40 XP."
          perk="-10 % sur les boissons"
        />
        <Row>
          <ScanResult status="duplicate" body="Ce code a déjà été scanné ce soir." />
          <ScanResult status="expired" body="Demande au joueur de rafraîchir son QR." />
        </Row>
        <Row>
          <PresenceToggle label="Hugo" value={presence} onChange={setPresence} />
          <SourceTag source="google" />
          <SourceTag source="lucko" />
          <SourceTag source="missing" />
          <DataCredit
            source="© contributeurs OpenStreetMap"
            href="https://www.openstreetmap.org/copyright"
          />
        </Row>
        <CodeInput value={code} onChange={setCode} />
        <RatingScale label="Ponctualité" size="sm" value={punctual} onChange={setPunctual} />
        <RatingScale
          label="Ponctualité"
          help="Arrivé à l'heure, prêt à jouer"
          value={punctual}
          onChange={setPunctual}
        />
        <ScorePicker bestOf={3} value={score} onChange={setScore} />
        <ScorePicker bestOf={3} value={score} onChange={setScore} wide />
        <RankPicker
          players={[
            {
              id: 'hugo',
              pseudo: 'Hugo',
              deck: 'Izzet Prowess',
              rating: 1420,
              color: colors.event,
            },
            { id: 'noah', pseudo: 'Noah', deck: 'Golgari', rating: 1385, color: colors.venue },
            { id: 'lea', pseudo: 'Léa', rating: 1502, color: colors.room },
          ]}
          order={ranking}
          onChange={setRanking}
          deltas={['+18', '-4', '-14']}
        />
        <PairingRow table={4} a="Jade" b="Léa" score="2-1" status="done" />
        <PairingRow
          table={5}
          a="Hugo"
          b="Noah"
          score="1-1"
          status="disputed"
          variant="orga"
          action={{ label: 'Trancher', onPress: () => {} }}
        />
        <PairingRow table={6} a="Maya" status="bye" variant="orga" />
        <PairingRow table={4} a="Jade" b="Léa" status="live" variant="tv" />
        <PairingRow table={5} a="Hugo" b="Noah" status="live" variant="tv" odd />
        <ChecklistRow state="done" label="Decklist envoyée" note="Moxfield" />
        <ChecklistRow state="todo" label="Paiement" />
        <ChecklistRow state="warn" label="Photos" note="Aucune photo" />
        <ChecklistRow state="locked" label="Pas d'alcool pour les -18" />
        <FuzzyZoneLabel revealed={false} />
        <FuzzyZoneLabel revealed address="12 rue des Lilas, Lyon 7e" />
        <Row>
          <Badge glyph="T" name="Tournoi" color={colors.room} rotate={-4} earned />
          <Badge glyph="5" name="5 venues" color={colors.venue} shape="round" earned />
          <Badge
            glyph="10"
            name="10 venues"
            description="Viens 10 fois"
            color={colors.venue}
            shape="round"
            earned={false}
          />
        </Row>
        <View style={{ backgroundColor: colors.event, padding: 16, borderRadius: 14 }}>
          <XpBar level={3} name="Régulier" current={340} max={500} tone="inverse" size="lg" />
        </View>
        <ProgressSteps
          current={2}
          total={3}
          color={colors.venue}
          labels={['Trouver', 'Prouver', 'Vérifier']}
          onStep={() => {}}
        />
        <Row>
          <StatCard
            label="Attendus ce soir"
            value="17"
            note="dans 4 rooms et événements"
            bg={colors.white}
            layout="label-first"
            emphasized
          />
          <StatCard label="Litiges" value="0" bg={colors.white} layout="label-first" empty />
        </Row>
        <AgendaEventCard
          kind="room"
          time="19:30"
          title="Tournoi Standard"
          meta="Carte Blanche · 1,2 km · Magic"
          tags={<Tag label="18+" />}
          places="9/16"
          price="8 €"
          wide
          onPress={() => {}}
        />
        <WantToPlayRow
          game="Magic : Commander"
          demandCount={23}
          city="Lyon"
          subscribed={notified}
          onToggle={() => setNotified(!notified)}
        />
        <WantToPlayRow
          game="Lorcana"
          demandCount={7}
          city="Lyon"
          subscribed={notified}
          onToggle={() => setNotified(!notified)}
          variant="checkbox"
        />
        <BarChart
          data={Array.from({ length: 30 }, (_, i) => ({
            label: String(i + 1),
            value: 3 + ((i * 7) % 11),
          }))}
          highlight={[4, 11, 18, 25]}
          color={colors.event}
          gap={6}
          height={120}
        />
      </Section>

      <Section title="Templates">
        <Typography variant="small">
          MobileScreen (écran mobile : en-tête, contenu, pied, onglets), WebScreen (web à barre du
          haut : accueil, connexion) et WebSidebarLayout (espace lieu, admin) : voir
          packages/design-system/README.md.
        </Typography>
      </Section>
    </ScrollView>
  )
}
