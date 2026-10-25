import {
  Banner,
  Button,
  colors,
  EmptyState,
  Panel,
  ReasonForm,
  SkeletonCard,
  Typography,
} from '@lucko/design-system'
import { type AdminDisputedVisit, formatLongDay, formatPrice } from '@lucko/shared'
import { ReceiptText } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { useAdminVisitDisputesQuery, useDecideVisitMutation } from '@/queries/useBilling'

const SOURCE = { QR_SCAN: 'Scan du QR', CHECK_IN: 'Pointage' } as const

/** Venues facturables contestées par les lieux (LKO-146) : les garder ou les annuler, avec un motif. */
export default function AdminVisitsScreen() {
  const disputes = useAdminVisitDisputesQuery()
  return (
    <AdminScreen
      section="visits"
      note="Venues qu’un lieu partenaire conteste sur sa facture. La garder la laisse facturée, l’annuler la retire."
    >
      {disputes.isError ? (
        <Banner
          tone="err"
          message={disputes.error.message}
          action="Réessayer"
          onAction={() => void disputes.refetch()}
        />
      ) : !disputes.data ? (
        <SkeletonCard />
      ) : !disputes.data.length ? (
        <EmptyState
          dashed
          icon={<ReceiptText size={28} color={colors.ink} strokeWidth={2.5} />}
          title="Aucune contestation"
          text="Quand un lieu conteste une venue facturée, elle arrive ici."
        />
      ) : (
        <View style={{ gap: 16 }}>
          {disputes.data.map((visit) => (
            <VisitDisputeCard key={visit.id} visit={visit} />
          ))}
        </View>
      )}
    </AdminScreen>
  )
}

function VisitDisputeCard({ visit }: { visit: AdminDisputedVisit }) {
  const decide = useDecideVisitMutation()
  const [status, setStatus] = useState<'VALID' | 'CANCELLED' | null>(null)
  return (
    <Panel
      title={`${visit.venueName} · ${formatLongDay(visit.businessDate)}`}
      right={
        <Typography variant="small">{formatPrice(visit.priceCents) ?? 'Forfait ?'}</Typography>
      }
    >
      <View style={{ gap: 12 }}>
        <Typography variant="small">
          {`${visit.pseudo ?? 'Joueur supprimé'} · ${SOURCE[visit.source]}`}
        </Typography>
        <Typography>{`« ${visit.disputeReason ?? 'Sans motif'} »`}</Typography>
        {decide.error ? (
          <Banner tone="err" message={decide.error.message} onClose={() => decide.reset()} />
        ) : null}
        {status ? (
          <ReasonForm
            label={
              status === 'VALID' ? 'Garder la venue : pourquoi ?' : 'Annuler la venue : pourquoi ?'
            }
            placeholder={
              status === 'VALID'
                ? 'Ex. scan vérifié, le joueur était bien là'
                : 'Ex. absence confirmée avec le lieu'
            }
            consequence={
              status === 'VALID'
                ? 'La venue reste facturée au lieu.'
                : 'La venue est retirée de la facture du lieu.'
            }
            confirmLabel="Trancher"
            busy={decide.isPending}
            onConfirm={({ text }) => decide.mutate({ id: visit.id, status, reason: text })}
            onCancel={() => setStatus(null)}
          />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button kind="soft" label="Garder la venue" onPress={() => setStatus('VALID')} />
            <Button kind="ghost" label="Annuler la venue" onPress={() => setStatus('CANCELLED')} />
          </View>
        )}
      </View>
    </Panel>
  )
}
