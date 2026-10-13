import { Banner, colors, EmptyState, SkeletonCard } from '@lucko/design-system'
import { Scale } from 'lucide-react-native'
import { View } from 'react-native'
import { useResultDisputesQuery } from '@/queries/useResults'
import { ResultDisputeCard } from './ResultDisputeCard'

/** Contestations de résultats à trancher : d'un lieu partenaire (`venueId`), ou toutes pour un admin. */
export function ResultDisputeList({ venueId }: { venueId?: string }) {
  const disputes = useResultDisputesQuery(venueId)
  if (disputes.isError)
    return (
      <Banner
        tone="err"
        message={disputes.error.message}
        action="Réessayer"
        onAction={() => void disputes.refetch()}
      />
    )
  if (!disputes.data) return <SkeletonCard />
  if (!disputes.data.length)
    return (
      <EmptyState
        dashed
        icon={<Scale size={28} color={colors.ink} strokeWidth={2.5} />}
        title="Aucune contestation"
        text="Quand un joueur conteste le résultat d’une room classée, il arrive ici."
      />
    )
  return (
    <View style={{ gap: 16 }}>
      {disputes.data.map((item) => (
        <ResultDisputeCard key={item.roomId} item={item} venueId={venueId} />
      ))}
    </View>
  )
}
