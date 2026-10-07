import {
  Banner,
  Button,
  ChipGroup,
  ConfirmDialog,
  colors,
  ListCard,
  ListRow,
  Note,
  PageTitle,
  SkeletonCard,
  StatusPill,
  Tag,
  TextLink,
  Typography,
} from '@lucko/design-system'
import {
  EVENT_TYPE_LABELS,
  formatPrice,
  REPORT_REASON_LABELS,
  type ReportReason,
} from '@lucko/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import { useState } from 'react'
import { Linking, View } from 'react-native'
import { DetailScreen } from '@/components/DetailScreen'
import { eventPlaces, eventWhen, gameLabel, isFull } from '@/lib/explore'
import { openChat, openManageVenue, openVenue } from '@/lib/navigation'
import { useChatUnread } from '@/queries/useChat'
import { useEventMutations, useEventQuery } from '@/queries/useEvent'
import { useMeQuery } from '@/queries/useMe'

/** Motifs proposés pour un événement (les autres visent un joueur : triche, absence…). */
const EVENT_REPORT_REASONS: ReportReason[] = ['INAPPROPRIATE_CONTENT', 'MINOR_SAFETY', 'OTHER']

/** Fiche événement (B4, LKO-11) et inscription dans l'app, avec liste d'attente quand c'est complet. */
export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const me = useMeQuery()
  const { data: event, isError: failed, refetch } = useEventQuery(id)
  const { register, unregister, report } = useEventMutations(id)
  const staffRole = event && me?.venues.find((venue) => venue.id === event.venue.id)?.role
  // Chat du tournoi : inscrits et staff du lieu (organisateur)
  const member = event?.myRegistration === 'REGISTERED' || !!staffRole
  const [reportReason, setReportReason] = useState<ReportReason | null>(null)
  const unread = useChatUnread({ type: 'event', id }, member)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const pending = register.isPending || unregister.isPending
  const error = register.error ?? unregister.error
  const clearError = () => {
    register.reset()
    unregister.reset()
  }

  if (!event) {
    return (
      <DetailScreen title="Événement">
        {failed ? (
          <Banner
            tone="err"
            message="Impossible de charger cet événement."
            action="Réessayer"
            onAction={() => void refetch()}
          />
        ) : (
          <SkeletonCard />
        )}
      </DetailScreen>
    )
  }

  const games = event.games.length ? event.games.map(gameLabel).join(', ') : 'Tous jeux'
  const details = [
    { title: 'Quand', value: eventWhen(event.startsAt, event.endsAt) },
    { title: 'Récurrence', value: event.recurrenceLabel },
    { title: 'Prix', value: formatPrice(event.priceCents) ?? 'Non renseigné' },
    { title: 'Places', value: eventPlaces(event) },
    { title: 'Âge minimum', value: event.minAge ? `${event.minAge} ans` : null },
  ].filter((row): row is { title: string; value: string } => !!row.value)

  let footer = null
  if (event.status !== 'PUBLISHED') {
    footer = (
      <Button
        disabled
        label={event.status === 'DRAFT' ? 'Brouillon non publié' : 'Événement annulé'}
      />
    )
  } else if (event.registrationMode === 'EXTERNAL' && event.externalUrl) {
    const url = event.externalUrl
    footer = (
      <Button kind="event" label="S'inscrire sur le site" onPress={() => Linking.openURL(url)} />
    )
  } else if (event.registrationMode === 'IN_APP') {
    footer = !me ? (
      <Button
        kind="event"
        label="Se connecter pour s'inscrire"
        onPress={() => router.push('/auth')}
      />
    ) : event.myRegistration ? (
      <Button
        kind="ghost"
        label={
          event.myRegistration === 'WAITLISTED' ? "Quitter la liste d'attente" : 'Se désinscrire'
        }
        disabled={pending}
        onPress={() => setConfirmCancel(true)}
      />
    ) : (
      <Button
        kind="event"
        label={isFull(event) ? "Rejoindre la liste d'attente" : "S'inscrire"}
        disabled={pending}
        onPress={() => register.mutate()}
      />
    )
  }

  return (
    <DetailScreen title={event.title} footer={footer}>
      <PageTitle eyebrow={`${EVENT_TYPE_LABELS[event.type]} · ${games}`} title={event.title} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {event.status === 'CANCELLED' ? <StatusPill tone="err" label="Annulé" /> : null}
        {event.status === 'DRAFT' ? <StatusPill tone="warn" label="Brouillon" /> : null}
        {event.status === 'HIDDEN' ? <StatusPill tone="err" label="Masqué par Lucko" /> : null}
        {event.myRegistration === 'REGISTERED' ? <StatusPill tone="ok" label="Inscrit" /> : null}
        {event.myRegistration === 'WAITLISTED' ? (
          <StatusPill tone="warn" label="En liste d'attente" />
        ) : null}
        {event.venue.isPartner ? <Tag variant="partner" label="Lieu partenaire" /> : null}
      </View>
      {error ? <Banner tone="err" message={error.message} onClose={clearError} /> : null}
      {staffRole === 'MANAGER' ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            small
            kind="ghost"
            label="Gérer les événements du lieu"
            onPress={() => openManageVenue(event.venue.id)}
          />
        </View>
      ) : null}
      {member ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            small
            kind="soft"
            label={`Chat de l'événement${unread ? ` · ${unread} non lu${unread > 1 ? 's' : ''}` : ''}`}
            onPress={() => openChat('event', id)}
          />
        </View>
      ) : null}
      {event.registrationMode === 'NONE' && event.status === 'PUBLISHED' ? (
        <Note tone="plain">Entrée libre : pas besoin de s'inscrire, viens directement.</Note>
      ) : null}

      <ListCard>
        {details.map((row) => (
          <ListRow key={row.title} inset={16} title={row.title} subtitle={row.value} />
        ))}
        <ListRow
          inset={16}
          title={event.venue.name}
          subtitle={event.venue.address}
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Typography variant="small">Voir le lieu</Typography>
              <ChevronRight size={16} color={colors.muted} strokeWidth={2.5} />
            </View>
          }
          last
          onPress={() => openVenue(event.venue.slug)}
        />
      </ListCard>

      {event.description ? <Typography>{event.description}</Typography> : null}

      {me && !staffRole ? (
        report.isSuccess ? (
          <Note tone="plain">Merci : l'équipe Lucko va regarder cet événement.</Note>
        ) : (
          <View style={{ alignSelf: 'flex-start' }}>
            <TextLink label="Signaler cet événement" onPress={() => setReportReason('OTHER')} />
          </View>
        )
      ) : null}
      <ConfirmDialog
        visible={reportReason !== null}
        title="Signaler cet événement ?"
        message="L'équipe Lucko vérifie l'événement et peut le masquer."
        confirmLabel="Signaler"
        destructive
        confirmDisabled={report.isPending}
        onConfirm={() => {
          if (reportReason) report.mutate({ reason: reportReason })
          setReportReason(null)
        }}
        onCancel={() => setReportReason(null)}
      >
        <ChipGroup
          items={EVENT_REPORT_REASONS.map((key) => ({ key, label: REPORT_REASON_LABELS[key] }))}
          value={reportReason ?? 'OTHER'}
          onChange={setReportReason}
        />
      </ConfirmDialog>
      {report.error ? (
        <Banner tone="err" message={report.error.message} onClose={() => report.reset()} />
      ) : null}

      <ConfirmDialog
        visible={confirmCancel}
        title={
          event.myRegistration === 'WAITLISTED'
            ? "Quitter la liste d'attente ?"
            : 'Se désinscrire ?'
        }
        message={
          event.myRegistration === 'WAITLISTED'
            ? "Tu perdras ta position dans la liste d'attente."
            : "Ta place sera proposée au premier joueur de la liste d'attente."
        }
        confirmLabel="Confirmer"
        destructive
        onConfirm={() => {
          setConfirmCancel(false)
          unregister.mutate()
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </DetailScreen>
  )
}
