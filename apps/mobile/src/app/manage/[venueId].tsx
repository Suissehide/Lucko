import {
  Banner,
  Button,
  ConfirmDialog,
  colors,
  EmptyState,
  PageTitle,
  Panel,
  ReviewCard,
  Segmented,
  SkeletonCard,
  StatusPill,
  Tag,
} from '@lucko/design-system'
import { EVENT_TYPE_LABELS, type VenueEvent } from '@lucko/shared'
import { useLocalSearchParams } from 'expo-router'
import { CalendarX } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { DetailScreen } from '@/components/DetailScreen'
import { ManagerEventForm } from '@/components/venue/ManagerEventForm'
import { eventWhen } from '@/lib/explore'
import { openEvent } from '@/lib/navigation'
import type { EditMode } from '@/lib/venueEvents'
import { useGamesQuery } from '@/queries/useGames'
import { useMeQuery } from '@/queries/useMe'
import { useVenueEventMutations, useVenueEventsQuery } from '@/queries/useVenueEvents'

const WHEN = ['upcoming', 'past'] as const

const STATUS_PILLS = {
  DRAFT: <StatusPill tone="warn" label="Brouillon" />,
  CANCELLED: <StatusPill tone="err" label="Annulé" />,
  HIDDEN: <StatusPill tone="err" label="Masqué par Lucko" />,
  PUBLISHED: null,
}

/**
 * Espace gérant (LKO-61) : les événements du lieu, publiés gratuitement qu'il soit partenaire ou non.
 * Créer (ponctuel ou récurrent), dupliquer, modifier une date ou la série, annuler.
 */
export default function ManageVenueEventsScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>()
  const me = useMeQuery({ required: true })
  const venue = me?.venues.find((v) => v.id === venueId)
  const [when, setWhen] = useState(0)
  const events = useVenueEventsQuery(venueId, WHEN[when] ?? 'upcoming')
  const games = useGamesQuery().data ?? []
  const { cancel } = useVenueEventMutations(venueId)
  const [editing, setEditing] = useState<EditMode | null>(null)
  const [cancelling, setCancelling] = useState<{ event: VenueEvent; series: boolean } | null>(null)
  const gameName = (id: string) => games.find((g) => g.id === id)?.name
  const edit = (mode: EditMode) => {
    setEditing(mode)
    cancel.reset()
  }

  if (me && venue?.role !== 'MANAGER') {
    return (
      <DetailScreen title="Mon lieu">
        <Banner tone="err" message="Réservé au gérant du lieu." />
      </DetailScreen>
    )
  }

  return (
    <DetailScreen title={venue?.name ?? 'Mon lieu'}>
      <PageTitle eyebrow="Espace gérant" title="Événements" />

      {editing ? (
        <Panel
          title={
            editing.kind === 'create'
              ? 'Nouvel événement'
              : editing.kind === 'duplicate'
                ? 'Dupliquer l’événement'
                : editing.scope === 'series'
                  ? 'Modifier la série'
                  : 'Modifier la date'
          }
        >
          <ManagerEventForm
            key={editing.kind === 'create' ? 'new' : `${editing.kind}-${editing.event.id}`}
            venueId={venueId}
            mode={editing}
            games={games}
            onDone={() => setEditing(null)}
          />
        </Panel>
      ) : (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            kind="event"
            label="+ Nouvel événement"
            onPress={() => edit({ kind: 'create' })}
          />
        </View>
      )}

      <Segmented
        items={['À venir', 'Passés']}
        value={when}
        onChange={setWhen}
        color={colors.event}
      />
      {cancel.error ? (
        <Banner tone="err" message={cancel.error.message} onClose={() => cancel.reset()} />
      ) : null}

      {events.isError ? (
        <Banner
          tone="err"
          message={events.error.message}
          action="Réessayer"
          onAction={() => void events.refetch()}
        />
      ) : !events.data ? (
        <SkeletonCard />
      ) : events.data.length === 0 ? (
        <EmptyState
          dashed
          icon={<CalendarX size={28} color={colors.ink} strokeWidth={2.5} />}
          title={when === 0 ? 'Agenda vide' : 'Rien de passé'}
          text={
            when === 0
              ? 'Publie ta première soirée : elle apparaîtra sur la fiche du lieu et dans l’agenda des joueurs.'
              : 'Les événements passés du lieu apparaîtront ici.'
          }
        />
      ) : (
        <View style={{ gap: 12 }}>
          {events.data.map((event) => {
            const live = (event.status === 'PUBLISHED' || event.status === 'DRAFT') && when === 0
            const inscrits =
              event.registrationMode === 'IN_APP'
                ? `${event.registered} inscrit${event.registered > 1 ? 's' : ''}${event.capacity ? ` / ${event.capacity}` : ''}${event.waitlisted ? ` · ${event.waitlisted} en attente` : ''}`
                : event.registrationMode === 'EXTERNAL'
                  ? 'Billetterie externe'
                  : 'Entrée libre'
            return (
              <ReviewCard
                key={event.id}
                title={event.title}
                tags={
                  <>
                    <Tag label={EVENT_TYPE_LABELS[event.type]} variant="event" />
                    {event.series ? <StatusPill tone="info" label={event.series.label} /> : null}
                    {event.overridden ? (
                      <StatusPill tone="neutral" label="Modifiée à part" />
                    ) : null}
                    {STATUS_PILLS[event.status]}
                  </>
                }
                meta={eventWhen(event.startsAt, event.endsAt)}
                body={[
                  inscrits,
                  event.gameIds.map(gameName).filter(Boolean).join(', ') || 'Tous jeux',
                ].join(' · ')}
                actions={
                  <>
                    {event.status !== 'DRAFT' && event.status !== 'HIDDEN' ? (
                      <Button small kind="ghost" label="Voir" onPress={() => openEvent(event.id)} />
                    ) : null}
                    {live ? (
                      <Button
                        small
                        kind="ghost"
                        label={event.series ? 'Modifier la date' : 'Modifier'}
                        onPress={() => edit({ kind: 'edit', event, scope: 'occurrence' })}
                      />
                    ) : null}
                    {live && event.series ? (
                      <Button
                        small
                        kind="ghost"
                        label="Modifier la série"
                        onPress={() => edit({ kind: 'edit', event, scope: 'series' })}
                      />
                    ) : null}
                    <Button
                      small
                      kind="ghost"
                      label="Dupliquer"
                      onPress={() => edit({ kind: 'duplicate', event })}
                    />
                    {live ? (
                      <Button
                        small
                        kind="room"
                        label="Annuler"
                        onPress={() => setCancelling({ event, series: false })}
                      />
                    ) : null}
                    {live && event.series ? (
                      <Button
                        small
                        kind="room"
                        label="Arrêter la série"
                        onPress={() => setCancelling({ event, series: true })}
                      />
                    ) : null}
                  </>
                }
              />
            )
          })}
        </View>
      )}

      <ConfirmDialog
        visible={cancelling !== null}
        title={cancelling?.series ? 'Arrêter la série ?' : 'Annuler cette date ?'}
        message={
          cancelling?.series
            ? 'Cette date et toutes les suivantes sont annulées. Les inscrits sont prévenus par notification et e-mail.'
            : 'Les inscrits et la liste d’attente sont prévenus par notification et e-mail.'
        }
        confirmLabel={cancelling?.series ? 'Arrêter la série' : 'Annuler la date'}
        cancelLabel="Retour"
        destructive
        onCancel={() => setCancelling(null)}
        onConfirm={() => {
          if (cancelling) cancel.mutate({ id: cancelling.event.id, series: cancelling.series })
          setCancelling(null)
        }}
      />
    </DetailScreen>
  )
}
