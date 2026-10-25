import { Banner, SkeletonCard } from '@lucko/design-system'
import { useQuery } from '@tanstack/react-query'
import { meQueryOptions } from '@/queries/useMe'

/**
 * Profil en cours de chargement : squelette, ou erreur avec « Réessayer » si l'API ne répond pas
 * (LKO-158), au lieu d'un squelette sans fin.
 */
export function MeLoading({ double = false }: { double?: boolean }) {
  const { isError, error, refetch } = useQuery(meQueryOptions)
  if (isError)
    return (
      <Banner
        tone="err"
        message={error.message}
        action="Réessayer"
        onAction={() => void refetch()}
      />
    )
  return (
    <>
      <SkeletonCard />
      {double ? <SkeletonCard /> : null}
    </>
  )
}
