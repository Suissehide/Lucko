import {
  Banner,
  colors,
  EmptyState,
  QueueItem,
  SkeletonCard,
  Tag,
  Typography,
} from '@lucko/design-system'
import { formatAgo, REPORT_REASON_LABELS } from '@lucko/shared'
import { ShieldCheck } from 'lucide-react-native'
import { useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { AdminScreen } from '@/components/admin/AdminScreen'
import { ReportDossier } from '@/components/admin/ReportDossier'
import { reportsNote } from '@/lib/admin'
import { useAdminReportsQuery } from '@/queries/useAdminModeration'

const TWO_PANELS = 1100

/** File des signalements (LKO-19, LKO-20) : mineurs en tête, puis du plus ancien ; dossier à droite. */
export default function AdminReportsScreen() {
  const twoPanels = useWindowDimensions().width >= TWO_PANELS
  const reports = useAdminReportsQuery()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const list = reports.data ?? []
  const selected = list.find((r) => r.id === selectedId) ?? list[0]
  const minors = list.filter((r) => r.target.minor).length

  return (
    <AdminScreen
      section="reports"
      note={reports.data ? reportsNote(list.length, minors) : undefined}
    >
      {notice ? <Banner tone="ok" message={notice} /> : null}
      {reports.isError ? (
        <Banner
          tone="err"
          message="Impossible de charger les signalements."
          action="Réessayer"
          onAction={() => void reports.refetch()}
        />
      ) : !reports.data ? (
        <SkeletonCard />
      ) : !selected ? (
        <EmptyState
          dashed
          icon={<ShieldCheck size={28} color={colors.ink} strokeWidth={2.5} />}
          title="File vide"
          text="Aucun signalement en attente."
        />
      ) : (
        <View
          style={{ flexDirection: twoPanels ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}
        >
          <View style={{ width: twoPanels ? 360 : '100%', gap: 10 }}>
            {list.map((report) => (
              <QueueItem
                key={report.id}
                title={report.target.pseudo ?? 'Compte supprimé'}
                tags={report.target.minor ? <Tag label="-18" variant="alert" /> : null}
                age={formatAgo(report.createdAt)}
                line={REPORT_REASON_LABELS[report.reason]}
                meta={`par ${report.reporter.pseudo ?? 'compte supprimé'}`}
                stripe={report.target.minor ? colors.room : colors.rating}
                selected={report.id === selected.id}
                onPress={() => {
                  setNotice(null)
                  setSelectedId(report.id)
                }}
              />
            ))}
            <Typography variant="small">
              Ordre : signalements sur un mineur d’abord, puis du plus ancien au plus récent.
            </Typography>
          </View>
          <View style={{ flex: twoPanels ? 1 : undefined, width: twoPanels ? undefined : '100%' }}>
            <ReportDossier
              key={selected.id}
              report={selected}
              onDone={(message) => {
                setNotice(message)
                setSelectedId(null)
              }}
            />
          </View>
        </View>
      )}
    </AdminScreen>
  )
}
