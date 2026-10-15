import { queryOptions, useQuery } from '@tanstack/react-query'
import type { MapBounds } from '@/components/explore/mapPins'
import { EXPLORE } from '@/constants/queryKeys'
import { api } from '@/lib/api'
import { agendaEntries } from '@/lib/cityAgenda'
import { localDay } from '@/lib/explore'
import { unwrap } from '@/lib/queryClient'
import { type Place, useLocation } from '@/lib/useLocation'

// * QUERIES

/** « Ce soir » autour d'un point : soirées du jour, rooms qui cherchent des joueurs, lieux ouverts. */
export const tonightQueryOptions = (place: Place, radiusKm: number) =>
  queryOptions({
    queryKey: [EXPLORE.TONIGHT, place.lat, place.lng, radiusKm],
    queryFn: async () => {
      const query = { lat: place.lat, lng: place.lng, radiusKm, days: 1 }
      const [events, rooms, venues] = await Promise.all([
        unwrap(api.GET('/events', { params: { query } })),
        unwrap(api.GET('/rooms', { params: { query } })),
        unwrap(api.GET('/venues', { params: { query } })),
      ])
      const today = localDay(new Date())
      return {
        events: events.filter((e) => localDay(e.startsAt) === today),
        rooms,
        venues: venues.filter((v) => v.openNow),
      }
    },
  })

/** Accueil Explorer : attend la position (ou le repli sur Bordeaux) avant de charger. */
export function useTonightQuery(radiusKm = 10) {
  const { place, ready } = useLocation()
  const { data, isError, refetch } = useQuery({
    ...tonightQueryOptions(place, radiusKm),
    enabled: ready,
  })
  return { place, data: data ?? null, failed: isError, retry: () => void refetch() }
}

/** Agenda de la ville : événements et rooms des 7 prochains jours autour d'un point (LKO-62). */
export const cityAgendaQueryOptions = (place: Place, radiusKm: number) =>
  queryOptions({
    queryKey: [EXPLORE.CITY_AGENDA, place.lat, place.lng, radiusKm],
    queryFn: async () => {
      const query = { lat: place.lat, lng: place.lng, radiusKm, days: 7 }
      const [events, rooms] = await Promise.all([
        unwrap(api.GET('/events', { params: { query } })),
        unwrap(api.GET('/rooms', { params: { query } })),
      ])
      return agendaEntries(events, rooms)
    },
  })

/** Lieux autour d'un point (choix du lieu d'une room), du plus proche au plus loin. */
/** `at` (ISO) : ouverture des lieux à cet instant plutôt que maintenant (création de room). */
export const venuesQueryOptions = (lat: number, lng: number, radiusKm: number, at?: string) =>
  queryOptions({
    queryKey: [EXPLORE.VENUES, lat, lng, radiusKm, at],
    queryFn: () => unwrap(api.GET('/venues', { params: { query: { lat, lng, radiusKm, at } } })),
  })

/** Épingles d'une zone de la carte (LKO-122) ; rien tant que la zone est inconnue ou trop grande. */
export const mapVenuesQueryOptions = (area: MapBounds | null, openNow: boolean) =>
  queryOptions({
    queryKey: [EXPLORE.MAP_VENUES, area, openNow],
    queryFn: () =>
      unwrap(
        api.GET('/map/venues', {
          params: { query: { ...(area as MapBounds), openNow: openNow ? 'true' : undefined } },
        }),
      ),
    enabled: !!area,
    placeholderData: (previous) => previous,
  })

/** Nombre de lieux et de soirées des 7 prochains jours dans un rayon (onboarding). */
export const nearbyCountQueryOptions = (lat: number, lng: number, radiusKm: number) =>
  queryOptions({
    queryKey: [EXPLORE.NEARBY_COUNT, lat, lng, radiusKm],
    queryFn: async () => {
      const query = { lat, lng, radiusKm }
      const [venues, events] = await Promise.all([
        unwrap(api.GET('/venues', { params: { query } })),
        unwrap(api.GET('/events', { params: { query: { ...query, days: 7 } } })),
      ])
      return { venues: venues.length, events: events.length }
    },
  })
