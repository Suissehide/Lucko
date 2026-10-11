import {
  AvatarStack,
  Banner,
  Button,
  ConfirmDialog,
  colors,
  ListCard,
  ListRow,
  PageTitle,
  SkeletonCard,
  StatusPill,
  Tag,
  Typography,
} from '@lucko/design-system'
import {
  COMMANDER_BRACKETS,
  type CommanderBracket,
  formatRating,
  type HostAction,
  ROOM_VIBE_LABELS,
  type RoomCandidate,
  type RoomDetail,
} from '@lucko/shared'
import * as Linking from 'expo-linking'
import { router, useLocalSearchParams } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { DetailScreen } from '@/components/DetailScreen'
import { HomeSafetyDialog } from '@/components/HomeSafetyDialog'
import { HomeZoneCard } from '@/components/rooms/HomeZoneCard'
import { addToCalendar } from '@/lib/calendar'
import { eventWhen, gameLabel } from '@/lib/explore'
import { openChat, openVenue } from '@/lib/navigation'
import { useChatUnread } from '@/queries/useChat'
import { useMeQuery } from '@/queries/useMe'
import { useParticipationMutations, useRoomQuery } from '@/queries/useRoom'

const MY_STATUS: Partial<
  Record<NonNullable<RoomDetail['myStatus']>, { label: string; tone: 'ok' | 'warn' | 'err' }>
> = {
  ACCEPTED: { label: 'Tu joues', tone: 'ok' },
  PENDING: { label: 'Demande envoyée', tone: 'warn' },
  WAITLISTED: { label: "En liste d'attente", tone: 'warn' },
  DECLINED: { label: 'Demande refusée', tone: 'err' },
}

const ROOM_STATUS: Partial<
  Record<RoomDetail['status'], { label: string; tone?: 'ok' | 'warn' | 'err' }>
> = {
  FULL: { label: 'Complète' },
  CONFIRMED: { label: 'Inscriptions fermées', tone: 'ok' },
  IN_PROGRESS: { label: 'En cours', tone: 'ok' },
  FINISHED: { label: 'Terminée' },
  CANCELLED: { label: 'Annulée', tone: 'err' },
}

/**
 * Fiche room (B6, LKO-56) : demander à rejoindre, liste d'attente quand c'est complet, quitter.
 * L'hôte y gère les demandes (C5) avec le profil de jeu de chaque candidat (C6).
 */
export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const me = useMeQuery()
  const { data: room, isError: failed, refetch } = useRoomQuery(id)
  const { join, leave, decide, hostAction } = useParticipationMutations(id)
  const member = room?.isHost === true || room?.myStatus === 'ACCEPTED'
  const unread = useChatUnread({ type: 'room', id }, member)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmAction, setConfirmAction] = useState<HostConfirm | null>(null)
  const [safety, setSafety] = useState(false)
  const pending = join.isPending || leave.isPending || decide.isPending || hostAction.isPending
  const error = join.error ?? leave.error ?? decide.error ?? hostAction.error
  const clearError = () => {
    join.reset()
    leave.reset()
    decide.reset()
    hostAction.reset()
  }

  if (!room) {
    return (
      <DetailScreen title="Room">
        {failed ? (
          <Banner
            tone="err"
            message="Impossible de charger cette room."
            action="Réessayer"
            onAction={() => void refetch()}
          />
        ) : (
          <SkeletonCard />
        )}
      </DetailScreen>
    )
  }

  const title = `${room.format ?? room.game.name} à ${room.capacity}`
  const full = room.players.length >= room.capacity
  const closed = room.status !== 'OPEN' && room.status !== 'FULL'
  // Après le début de la partie ou une annulation, plus rien ne bouge
  const over =
    room.status === 'IN_PROGRESS' || room.status === 'FINISHED' || room.status === 'CANCELLED'
  const active =
    room.myStatus === 'ACCEPTED' || room.myStatus === 'PENDING' || room.myStatus === 'WAITLISTED'
  const status = MY_STATUS[room.myStatus ?? 'LEFT']
  const roomPill = ROOM_STATUS[room.status]
  const details = [
    { title: 'Quand', value: eventWhen(room.startsAt, null) },
    {
      title: 'Places',
      value: `${room.players.length}/${room.capacity}${room.waitlistCount ? ` · ${room.waitlistCount} en liste d'attente` : ''}`,
    },
    {
      title: 'Inscription',
      value: room.autoAccept ? 'Automatique' : "Sur acceptation de l'hôte",
    },
    { title: 'Âge', value: room.minorsAllowed ? 'Ouverte aux mineurs' : '18 ans et plus' },
    ...(room.vibes.length
      ? [{ title: 'Ambiance', value: room.vibes.map((v) => ROOM_VIBE_LABELS[v]).join(', ') }]
      : []),
    ...(room.bracket
      ? [
          {
            title: 'Bracket des decks',
            value: `${room.bracket} · ${COMMANDER_BRACKETS[room.bracket as CommanderBracket]}`,
          },
        ]
      : []),
  ]

  let footer = null
  if (room.isHost || over) {
    footer = null
  } else if (!me) {
    footer = (
      <Button kind="room" label="Se connecter pour jouer" onPress={() => router.push('/auth')} />
    )
  } else if (active) {
    footer = (
      <Button
        kind="ghost"
        label={room.myStatus === 'ACCEPTED' ? 'Quitter la room' : 'Retirer ma demande'}
        disabled={pending}
        onPress={() => setConfirmLeave(true)}
      />
    )
  } else if (closed) {
    footer = <Button disabled label="Inscriptions fermées" />
  } else if (room.myStatus !== 'DECLINED') {
    footer = (
      <Button
        kind="room"
        label={
          full
            ? "Rejoindre la liste d'attente"
            : room.autoAccept
              ? 'Rejoindre la room'
              : 'Demander à rejoindre'
        }
        disabled={pending}
        // Room à domicile : avertissement sécurité avant la première demande (LKO-72)
        onPress={() => (room.home && !me.homeSafetyAccepted ? setSafety(true) : join.mutate())}
      />
    )
  }

  return (
    <DetailScreen title={title} footer={footer}>
      <PageTitle
        eyebrow={`${room.mode === 'RANKED' ? 'Room classée' : 'Room libre'} · ${gameLabel(room.game)}`}
        title={title}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {room.isHost ? <StatusPill tone="ok" label="Tu organises" /> : null}
        {!room.isHost && status ? <StatusPill {...status} /> : null}
        {roomPill ? <StatusPill {...roomPill} /> : null}
        {room.venue?.isPartner ? <Tag variant="partner" label="Lieu partenaire" /> : null}
      </View>
      {error ? <Banner tone="err" message={error.message} onClose={clearError} /> : null}
      {member ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button
            small
            kind="soft"
            label={`Chat de la room${unread ? ` · ${unread} non lu${unread > 1 ? 's' : ''}` : ''}`}
            onPress={() => openChat('room', id)}
          />
          {over ? null : (
            <Button
              small
              kind="ghost"
              label="Ajouter au calendrier"
              onPress={() =>
                void addToCalendar({
                  uid: `room-${id}`,
                  title: `${room.game.name} · ${title}`,
                  startsAt: new Date(room.startsAt),
                  endsAt: null,
                  // Zone floue seulement pour une room à domicile : l'adresse reste dans l'app
                  location: room.venue
                    ? `${room.venue.name}, ${room.venue.address}`
                    : (room.home?.areaLabel ?? null),
                  url: Linking.createURL(`/rooms/${id}`),
                })
              }
            />
          )}
        </View>
      ) : null}

      <ListCard>
        {details.map((row) => (
          <ListRow key={row.title} inset={16} title={row.title} subtitle={row.value} />
        ))}
        {room.venue ? (
          <ListRow
            inset={16}
            title={room.venue.name}
            subtitle={room.venue.address}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Typography variant="small">Voir le lieu</Typography>
                <ChevronRight size={16} color={colors.muted} strokeWidth={2.5} />
              </View>
            }
            last
            onPress={() => room.venue && openVenue(room.venue.slug)}
          />
        ) : null}
      </ListCard>

      {room.home ? (
        <HomeZoneCard
          roomId={id}
          home={room.home}
          isHost={room.isHost}
          accepted={room.myStatus === 'ACCEPTED'}
          over={room.status === 'FINISHED' || room.status === 'CANCELLED'}
        />
      ) : null}

      {room.description ? <Typography>{room.description}</Typography> : null}

      <Typography variant="h2">Joueurs</Typography>
      {room.isHost ? (
        <HostPlayers
          room={room}
          hostId={me?.id}
          disabled={pending || over}
          onAsk={(player, type) =>
            setConfirmAction(
              type === 'remove'
                ? {
                    action: { type, userId: player.userId },
                    title: `Retirer ${player.pseudo} ?`,
                    message:
                      "Ce joueur ne pourra plus revenir dans cette room ; sa place revient à la liste d'attente.",
                    label: 'Retirer',
                  }
                : {
                    action: { type, userId: player.userId },
                    title: `Nommer ${player.pseudo} hôte ?`,
                    message: 'Tu restes joueur de la room, mais tu ne pourras plus la gérer.',
                    label: 'Nommer hôte',
                  },
            )
          }
        />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AvatarStack names={room.players.map((p) => p.initial)} />
          <Typography variant="small">
            {room.players.some((p) => p.pseudo)
              ? room.players.map((p) => p.pseudo ?? p.initial).join(', ')
              : `Organisée par ${room.host.pseudo ?? 'un joueur'}`}
          </Typography>
        </View>
      )}

      {room.isHost && !over ? (
        <>
          <Candidates
            candidates={room.candidates}
            full={full}
            disabled={pending}
            onDecide={(userId, accept) => decide.mutate({ userId, accept })}
          />
          <Typography variant="h2">Gérer la room</Typography>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button
              small
              kind="ghost"
              label={
                room.status === 'CONFIRMED' ? 'Rouvrir les inscriptions' : 'Fermer les inscriptions'
              }
              disabled={pending}
              onPress={() =>
                hostAction.mutate({ type: room.status === 'CONFIRMED' ? 'reopen' : 'close' })
              }
            />
            <Button
              small
              kind="danger"
              label="Annuler la room"
              disabled={pending}
              onPress={() =>
                setConfirmAction({
                  action: { type: 'cancel' },
                  title: 'Annuler la room ?',
                  message:
                    'Elle disparaît de l’agenda des joueurs. Tu ne pourras pas revenir en arrière.',
                  label: 'Annuler la room',
                })
              }
            />
          </View>
          <Typography variant="small">
            Fermer les inscriptions confirme la table : plus de nouvelles demandes, la liste
            d'attente patiente jusqu'à la réouverture.
          </Typography>
        </>
      ) : null}

      <ConfirmDialog
        visible={!!confirmAction}
        title={confirmAction?.title ?? ''}
        message={confirmAction?.message ?? ''}
        confirmLabel={confirmAction?.label ?? 'Confirmer'}
        cancelLabel="Retour"
        destructive
        onConfirm={() => {
          if (confirmAction) hostAction.mutate(confirmAction.action)
          setConfirmAction(null)
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        visible={confirmLeave}
        title={room.myStatus === 'ACCEPTED' ? 'Quitter la room ?' : 'Retirer ta demande ?'}
        message={
          room.myStatus === 'ACCEPTED'
            ? "Ta place sera proposée au premier joueur de la liste d'attente."
            : 'Tu pourras redemander plus tard.'
        }
        confirmLabel="Confirmer"
        destructive
        onConfirm={() => {
          setConfirmLeave(false)
          leave.mutate()
        }}
        onCancel={() => setConfirmLeave(false)}
      />

      <HomeSafetyDialog
        visible={safety}
        sheet={false}
        onAccepted={() => {
          setSafety(false)
          join.mutate()
        }}
        onCancel={() => setSafety(false)}
      />
    </DetailScreen>
  )
}

type HostConfirm = { action: HostAction; title: string; message: string; label: string }
type ManagedPlayer = { userId: string; pseudo: string }

/** Joueurs acceptés vus par l'hôte (LKO-57) : retirer un joueur ou lui transférer la room. */
function HostPlayers({
  room,
  hostId,
  disabled,
  onAsk,
}: {
  room: RoomDetail
  hostId?: string
  disabled: boolean
  onAsk: (player: ManagedPlayer, type: 'remove' | 'transfer') => void
}) {
  const others = room.players.flatMap((p) =>
    p.userId && p.userId !== hostId ? [{ userId: p.userId, pseudo: p.pseudo ?? p.initial }] : [],
  )
  return (
    <View style={{ gap: 8 }}>
      <Typography variant="small">
        Toi
        {others.length
          ? `, ${others.map((p) => p.pseudo).join(', ')}`
          : ' : personne d’autre pour l’instant'}
      </Typography>
      {others.map((player) => (
        <ListCard key={player.userId}>
          <ListRow inset={16} last title={player.pseudo} />
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 }}>
            <Button
              small
              kind="ghost"
              label="Retirer"
              disabled={disabled}
              onPress={() => onAsk(player, 'remove')}
            />
            <Button
              small
              kind="ghost"
              label="Nommer hôte"
              disabled={disabled}
              onPress={() => onAsk(player, 'transfer')}
            />
          </View>
        </ListCard>
      ))}
    </View>
  )
}

/** Demandes et liste d'attente (C5) : niveau, LK sur le format, badge -18 ; accepter ou refuser. */
function Candidates({
  candidates,
  full,
  disabled,
  onDecide,
}: {
  candidates: RoomCandidate[]
  full: boolean
  disabled: boolean
  onDecide: (userId: string, accept: boolean) => void
}) {
  return (
    <>
      <Typography variant="h2">Demandes ({candidates.length})</Typography>
      {candidates.length === 0 ? (
        <Typography variant="small">Aucune demande pour l'instant.</Typography>
      ) : (
        // Une carte par candidat, boutons sous le profil : rien de tronqué sur téléphone
        <View style={{ gap: 8 }}>
          {candidates.map((c) => (
            <ListCard key={c.userId}>
              <ListRow
                inset={16}
                last
                title={`${c.pseudo ?? 'Joueur'}${c.minor ? ' · -18' : ''}`}
                subtitle={[
                  c.status === 'WAITLISTED' ? "Liste d'attente" : null,
                  `${c.xp} XP`,
                  c.rating !== null
                    ? `LK ${formatRating(c.rating)}`
                    : c.rankedGames
                      ? `${c.rankedGames} parties classées`
                      : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <View
                style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 }}
              >
                <Button
                  small
                  kind="ghost"
                  label="Refuser"
                  disabled={disabled}
                  onPress={() => onDecide(c.userId, false)}
                />
                <Button
                  small
                  kind="room"
                  label="Accepter"
                  disabled={disabled || full}
                  onPress={() => onDecide(c.userId, true)}
                />
              </View>
            </ListCard>
          ))}
        </View>
      )}
      {full && candidates.length ? (
        <Typography variant="small">
          La room est complète : une place libérée revient au premier de la liste d'attente.
        </Typography>
      ) : null}
    </>
  )
}
