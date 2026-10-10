import {
  Banner,
  Button,
  ChecklistItem,
  colors,
  DetailCard,
  HoursCard,
  SettingRow,
  StatusPill,
  StripeRow,
  Typography,
} from '@lucko/design-system'
import { type AdminEvent, type AdminVenue, formatPrice, VENUE_TYPE_LABELS } from '@lucko/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { venueChecklist } from '@/lib/admin'
import { eventWhen } from '@/lib/explore'
import { openVenue } from '@/lib/navigation'
import { hoursRows } from '@/lib/venue'
import { useAdminCatalogMutations, useAdminEventsQuery } from '@/queries/useAdminCatalog'
import { useGamesQuery } from '@/queries/useGames'
import { ActionDialog } from './ActionDialog'
import { EventForm } from './EventForm'

const eventLine = (event: AdminEvent) =>
  [
    eventWhen(event.startsAt, event.endsAt),
    event.capacity
      ? `${event.registered}/${event.capacity} places`
      : `${event.registered} inscrits`,
    formatPrice(event.priceCents),
  ]
    .filter(Boolean)
    .join(' · ')

/** Fiche d'un lieu : vérifications avant publication, horaires, réglages, événements. */
export function VenueDetail({ venue }: { venue: AdminVenue }) {
  const events = useAdminEventsQuery(venue.id)
  const games = useGamesQuery().data ?? []
  const { updateVenue, cancelEvent } = useAdminCatalogMutations()
  const [editing, setEditing] = useState<AdminEvent | 'new' | null>(null)
  const [cancelling, setCancelling] = useState<{ event: AdminEvent; series: boolean } | null>(null)
  const [perk, setPerk] = useState(false)
  const pending = venue.status === 'PENDING'
  const update = (body: Parameters<typeof updateVenue.mutate>[0]) => updateVenue.mutate(body)
  const upcoming = (events.data ?? []).filter(
    (e) => e.status !== 'CANCELLED' && e.status !== 'HIDDEN' && new Date(e.startsAt) >= new Date(),
  )

  return (
    <>
      <DetailCard
        sections={[
          {
            key: 'head',
            children: (
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}
              >
                <View style={{ flex: 1, minWidth: 220, gap: 4 }}>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
                  >
                    <Typography variant="h1">{venue.name}</Typography>
                    {pending ? (
                      <StatusPill tone="warn" label="À valider" />
                    ) : (
                      <StatusPill tone="ok" label="Publié" />
                    )}
                  </View>
                  <Typography variant="small">
                    {VENUE_TYPE_LABELS[venue.type]} · {venue.address}, {venue.city}
                  </Typography>
                </View>
                {pending ? (
                  <Button
                    kind="venue"
                    label="Publier"
                    disabled={updateVenue.isPending}
                    onPress={() => update({ id: venue.id, status: 'PUBLISHED' })}
                  />
                ) : (
                  <Button
                    small
                    kind="ghost"
                    label="Voir la fiche ↗"
                    onPress={() => openVenue(venue.slug)}
                  />
                )}
              </View>
            ),
          },
          updateVenue.isError && {
            key: 'error',
            children: <Banner tone="err" message={updateVenue.error.message} />,
          },
          pending && {
            key: 'checklist',
            label: 'Avant de publier',
            tinted: true,
            children: venueChecklist(venue).map((item) => (
              <ChecklistItem key={item.label} {...item} />
            )),
          },
          {
            key: 'settings',
            columns: [
              <View key="hours" style={{ gap: 8 }}>
                <Typography variant="label" style={{ color: colors.ink }}>
                  Horaires
                </Typography>
                <HoursCard
                  plain
                  rows={hoursRows(venue.openingHours).map((r) => ({
                    ...r,
                    day: `${r.day.slice(0, 3)}.`,
                  }))}
                />
              </View>,
              <View key="settings" style={{ gap: 14 }}>
                <Typography variant="label" style={{ color: colors.ink }}>
                  Réglages du lieu
                </Typography>
                <SettingRow
                  title="Lieu partenaire"
                  description={
                    venue.isPartner && venue.luckoPerk
                      ? `Avantage : ${venue.luckoPerk}`
                      : 'Badge partenaire et avantage Lucko sur la fiche.'
                  }
                  value={venue.isPartner}
                  onChange={(on) =>
                    on ? setPerk(true) : update({ id: venue.id, isPartner: false })
                  }
                />
                <SettingRow
                  title="Mineurs non accompagnés"
                  description="Les moins de 16 ans peuvent venir seuls. Interdit dans un bar (art. L3342-3 du Code de la santé publique) : laisse désactivé si le lieu sert de l’alcool."
                  value={venue.acceptsUnaccompaniedMinors}
                  onChange={(on) => update({ id: venue.id, acceptsUnaccompaniedMinors: on })}
                />
              </View>,
            ],
          },
          {
            key: 'events',
            children: editing ? (
              <>
                <Typography variant="label" style={{ color: colors.ink }}>
                  {editing === 'new' ? 'Nouvel événement' : 'Modifier la date'}
                </Typography>
                <EventForm
                  venueId={venue.id}
                  event={editing === 'new' ? undefined : editing}
                  games={games}
                  onDone={() => setEditing(null)}
                />
              </>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Typography variant="label" style={{ color: colors.ink }}>
                    Événements · {upcoming.length}
                  </Typography>
                  <Button
                    small
                    kind="rating"
                    label="+ Créer un événement"
                    onPress={() => setEditing('new')}
                  />
                </View>
                {upcoming.length ? (
                  upcoming.map((event) => (
                    <StripeRow
                      key={event.id}
                      stripe={event.type === 'TOURNAMENT' ? colors.room : colors.event}
                      title={event.title}
                      subtitle={eventLine(event)}
                      tags={event.seriesId ? <StatusPill tone="info" label="Série" /> : null}
                      actions={
                        <>
                          <Button
                            small
                            kind="ghost"
                            label="Modifier"
                            onPress={() => setEditing(event)}
                          />
                          <Button
                            small
                            kind="danger"
                            label="Annuler…"
                            onPress={() => setCancelling({ event, series: false })}
                          />
                          {event.seriesId ? (
                            <Button
                              small
                              kind="danger"
                              label="La série…"
                              onPress={() => setCancelling({ event, series: true })}
                            />
                          ) : null}
                        </>
                      }
                    />
                  ))
                ) : (
                  <Typography variant="small">Aucun événement pour l’instant.</Typography>
                )}
              </>
            ),
          },
        ]}
      />
      <ActionDialog
        key={`perk-${perk}`}
        visible={perk}
        title={`${venue.name} partenaire ?`}
        message="Badge Partenaire sur la fiche et en tête à distance égale dans Explorer."
        confirmLabel="Passer partenaire"
        label="Avantage Lucko (facultatif)"
        placeholder="-10 % sur les boosters avec le QR Lucko"
        initial={venue.luckoPerk ?? ''}
        optional
        destructive={false}
        onCancel={() => setPerk(false)}
        onConfirm={async ({ text }) => {
          await updateVenue.mutateAsync({ id: venue.id, isPartner: true, luckoPerk: text || null })
          setPerk(false)
        }}
      />
      <ActionDialog
        key={cancelling ? `${cancelling.event.id}-${cancelling.series}` : 'closed'}
        visible={cancelling !== null}
        title={cancelling?.series ? 'Annuler la série ?' : 'Annuler cet événement ?'}
        message={
          cancelling?.series
            ? 'Cette date et toutes les suivantes de la série sont annulées. Les inscrits sont prévenus.'
            : 'Les inscrits sont prévenus par notification.'
        }
        confirmLabel="Annuler l’événement"
        onCancel={() => setCancelling(null)}
        onConfirm={async ({ text }) => {
          if (!cancelling) return
          await cancelEvent.mutateAsync({
            id: cancelling.event.id,
            reason: text,
            series: cancelling.series,
          })
          setCancelling(null)
        }}
      />
    </>
  )
}
