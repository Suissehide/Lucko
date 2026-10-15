import { queryOptions } from '@tanstack/react-query'
import { GEOCODE } from '@/constants/queryKeys'
import { reverseCity, searchAddresses, searchCity, suggestCities } from '@/lib/geocode'
import { searchPlaces } from '@/lib/places'
import { queryClient } from '@/lib/queryClient'

// Communes et positions changent rarement : une recherche faite reste valable toute la session
const STATIC = { staleTime: Number.POSITIVE_INFINITY }

// * QUERIES

export const citySearchQueryOptions = (query: string) =>
  queryOptions({
    queryKey: [GEOCODE.SEARCH, query.trim().toLowerCase()],
    queryFn: () => searchCity(query.trim()),
    ...STATIC,
  })

export const citySuggestionsQueryOptions = (query: string) =>
  queryOptions({
    queryKey: [GEOCODE.SUGGEST, query.trim().toLowerCase()],
    queryFn: () => suggestCities(query.trim()),
    ...STATIC,
  })

/** Adresses proposées à partir de 3 caractères (room à domicile, nouveau lieu près de `near`). */
export const addressSearchQueryOptions = (query: string, near?: { lat: number; lng: number }) =>
  queryOptions({
    queryKey: [GEOCODE.ADDRESS, query.trim().toLowerCase(), near],
    queryFn: () => searchAddresses(query.trim(), near),
    enabled: query.trim().length >= 3,
    ...STATIC,
  })

/** Lieux OpenStreetMap proposés à partir de 3 caractères (création d'un lieu au back-office). */
export const placeSearchQueryOptions = (query: string) =>
  queryOptions({
    queryKey: [GEOCODE.PLACES, query.trim().toLowerCase()],
    queryFn: () => searchPlaces(query.trim()),
    enabled: query.trim().length >= 3,
    ...STATIC,
  })

export const cityAtQueryOptions = (lat: number, lng: number) =>
  queryOptions({
    queryKey: [GEOCODE.REVERSE, lat, lng],
    queryFn: () => reverseCity(lat, lng),
    ...STATIC,
  })

/** Commune correspondant au texte saisi (null si aucune), en cache : validation puis enregistrement ne la cherchent qu'une fois. */
export const findCity = (query: string) => queryClient.fetchQuery(citySearchQueryOptions(query))

export const findCityAt = (lat: number, lng: number) =>
  queryClient.fetchQuery(cityAtQueryOptions(lat, lng))
