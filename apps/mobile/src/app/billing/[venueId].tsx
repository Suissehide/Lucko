import {
  Banner,
  Button,
  colors,
  EmptyState,
  ListCard,
  ListRow,
  PageTitle,
  Panel,
  ReasonForm,
  SkeletonCard,
  StatCard,
  StatusPill,
} from '@lucko/design-system'
import { addMonths, formatDayMonth, formatPrice, type VenueVisits } from '@lucko/shared'
import { useLocalSearchParams } from 'expo-router'
import { ChevronRight, Receipt } from 'lucide-react-native'
import { useState } from 'react'
import { Platform, Share, View } from 'react-native'
import { DetailScreen } from '@/components/DetailScreen'
import { useDisputeVisitMutation, useVenueVisitsQuery } from '@/queries/useBilling'
import { useMeQuery } from '@/queries/useMe'

const STATUS = {
  VALID: null,
  DISPUTED: <StatusPill tone="warn" label="Contestée" />,
  CANCELLED: <StatusPill tone="err" label="Annulée" />,
}

const SOURCE = { QR_SCAN: 'Scan du QR', CHECK_IN: 'Pointage' } as const

const monthName = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

const dayLabel = (date: string) => {
  const { day, month } = formatDayMonth(date)
  return `${day} ${month}`
}

/** CSV du mois pour la compta du lieu : téléchargé sur le web, partagé ailleurs. */
function exportCsv(data: VenueVisits) {
  const rows = [
    ['Soirée', 'Joueur', 'Source', 'Forfait (€)', 'Statut'],
    ...data.visits.map((v) => [
      v.businessDate,
      v.pseudo ?? '',
      SOURCE[v.source],
      ((v.priceCents ?? 0) / 100).toFixed(2).replace('.', ','),
      v.status,
    ]),
  ]
  const csv = rows.map((r) => r.map((c) => `"${c.replaceAll('"', '""')}"`).join(';')).join('\n')
  if (Platform.OS !== 'web') return void Share.share({ message: csv })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv' }))
  link.download = `lucko-venues-${data.month}.csv`
  link.click()
}

/**
 * Venues facturables d'un lieu partenaire (LKO-79), pour le gérant : celles du mois, le total prévisionnel
 * (venues valides au forfait figé), l'export CSV et la contestation d'une venue dans les 14 jours.
 */
export default function VenueBillingScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>()
  const me = useMeQuery({ required: true })
  const venue = me?.venues.find((v) => v.id === venueId)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const visits = useVenueVisitsQuery(venueId, month)
  const dispute = useDisputeVisitMutation(venueId)
  const [disputing, setDisputing] = useState<string | null>(null)

  if (me && venue?.role !== 'MANAGER') {
    return (
      <DetailScreen title="Mon lieu">
        <Banner tone="err" message="Réservé au gérant du lieu." />
      </DetailScreen>
    )
  }

  const data = visits.data
  return (
    <DetailScreen title={venue?.name ?? 'Mon lieu'}>
      <PageTitle eyebrow={venue?.name ?? 'Mon lieu'} title="Venues facturables" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button
          kind="ghost"
          label="Mois précédent"
          onPress={() => setMonth(addMonths(month, -1))}
        />
        <Button
          kind="ghost"
          label="Mois suivant"
          icon={ChevronRight}
          onPress={() => setMonth(addMonths(month, 1))}
        />
      </View>

      {visits.isError ? (
        <Banner
          tone="err"
          message={visits.error.message}
          action="Réessayer"
          onAction={() => void visits.refetch()}
        />
      ) : !data ? (
        <SkeletonCard />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <StatCard
              value={data.totalCents ? (formatPrice(data.totalCents) ?? '') : '0 €'}
              label={`Total prévisionnel · ${monthName(month)}`}
              note={
                data.pricePerVisitCents === null
                  ? 'Forfait pas encore renseigné'
                  : `${formatPrice(data.pricePerVisitCents)} par venue`
              }
            />
            <StatCard
              value={String(data.validCount)}
              label="Venues valides"
              note={data.disputedCount ? `${data.disputedCount} contestée(s)` : undefined}
            />
          </View>
          {dispute.error ? (
            <Banner tone="err" message={dispute.error.message} onClose={() => dispute.reset()} />
          ) : null}
          {disputing ? (
            <Panel title="Contester une venue">
              <ReasonForm
                label="Pourquoi cette venue ne doit-elle pas être facturée ?"
                placeholder="Ex. joueur pas venu, compte du staff…"
                consequence="Lucko examine la contestation ; la venue sort du total en attendant."
                confirmLabel="Contester"
                busy={dispute.isPending}
                onConfirm={({ text }) =>
                  dispute.mutate(
                    { id: disputing, reason: text },
                    { onSuccess: () => setDisputing(null) },
                  )
                }
                onCancel={() => setDisputing(null)}
              />
            </Panel>
          ) : null}
          {data.visits.length === 0 ? (
            <EmptyState
              dashed
              icon={<Receipt size={28} color={colors.ink} strokeWidth={2.5} />}
              title="Aucune venue ce mois-ci"
              text="Chaque joueur scanné ou pointé dans ton lieu compte une fois par soirée."
            />
          ) : (
            <>
              <ListCard>
                {data.visits.map((v, i) => (
                  <ListRow
                    key={v.id}
                    inset={16}
                    last={i === data.visits.length - 1}
                    title={`${dayLabel(v.businessDate)} · ${v.pseudo ?? 'Joueur'}`}
                    subtitle={`${SOURCE[v.source]} · ${formatPrice(v.priceCents) ?? 'forfait non renseigné'}`}
                    note={v.disputeReason ?? undefined}
                    right={
                      STATUS[v.status] ??
                      (v.disputeRefused ? null : (
                        <Button
                          kind="ghost"
                          label="Contester"
                          onPress={() => {
                            dispute.reset()
                            setDisputing(v.id)
                          }}
                        />
                      ))
                    }
                  />
                ))}
              </ListCard>
              <View style={{ alignSelf: 'flex-start' }}>
                <Button kind="ghost" label="Exporter en CSV" onPress={() => exportCsv(data)} />
              </View>
            </>
          )}
        </>
      )}
    </DetailScreen>
  )
}
