import { AdminScreen } from '@/components/admin/AdminScreen'
import { ResultDisputeList } from '@/components/rooms/ResultDisputeList'

/** Résultats de rooms classées contestés (LKO-83) : les lieux partenaires tranchent d'abord les leurs. */
export default function AdminResultsScreen() {
  return (
    <AdminScreen
      section="results"
      note="Rooms classées dont le résultat est contesté. Dans un lieu partenaire, le lieu tranche d’abord : intervenir s’il ne le fait pas."
    >
      <ResultDisputeList />
    </AdminScreen>
  )
}
