import { Banner, PageTitle } from '@lucko/design-system'
import { useLocalSearchParams } from 'expo-router'
import { DetailScreen } from '@/components/DetailScreen'
import { ResultDisputeList } from '@/components/rooms/ResultDisputeList'
import { useMeQuery } from '@/queries/useMe'

/** Résultats contestés des rooms d'un lieu partenaire (LKO-83) : le staff tranche, décision tracée. */
export default function VenueDisputesScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>()
  const me = useMeQuery({ required: true })
  const venue = me?.venues.find((v) => v.id === venueId)

  return (
    <DetailScreen title={venue?.name ?? 'Mon lieu'}>
      <PageTitle eyebrow={venue?.name ?? 'Mon lieu'} title="Résultats contestés" />
      {me && !venue?.isPartner ? (
        <Banner tone="err" message="Réservé au staff d’un lieu partenaire." />
      ) : (
        <ResultDisputeList venueId={venueId} />
      )}
    </DetailScreen>
  )
}
