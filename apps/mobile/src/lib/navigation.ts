import { type PlayerTab, SITE_URL } from '@lucko/design-system'
import { router } from 'expo-router'
import { Linking } from 'react-native'

const TAB_ROUTES: Record<
  PlayerTab | 'agenda',
  '/' | '/agenda' | '/my-games' | '/messages' | '/profile'
> = {
  explorer: '/',
  agenda: '/agenda',
  parties: '/my-games',
  messages: '/messages',
  profil: '/profile',
}

export const openHome = () => router.navigate('/')

/** Retour à l'écran précédent ; à l'accueil si la fiche a été ouverte directement (lien, web). */
export const goBack = () => (router.canGoBack() ? router.back() : openHome())

/** Tous les lieux autour du joueur (B2, KWT-75). */
export const openVenues = () => router.push('/venues')

/** Agenda de la ville : rooms et événements des prochains jours (LKO-62). */
export const openAgenda = () => router.push('/agenda')

/** « Je veux jouer à… » : jeux attendus, prévenu à l'ouverture d'une room (LKO-17). */
export const openPlayIntents = () => router.push('/agenda/play-intents')

export const openVenue = (slug: string) =>
  router.push({ pathname: '/venues/[slug]', params: { slug } })

export const openEvent = (id: string) => router.push({ pathname: '/events/[id]', params: { id } })

export const openRoom = (id: string) => router.push({ pathname: '/rooms/[id]', params: { id } })

export const openChat = (type: 'room' | 'event', id: string) =>
  router.push({ pathname: '/chat/[type]/[id]', params: { type, id } })

export const openSettings = () => router.push('/settings')

/** Espace gérant d'un lieu : ses événements (LKO-61). */
export const openManageVenue = (venueId: string) =>
  router.push({ pathname: '/manage/[venueId]', params: { venueId } })

/** Créer une room ; `venueSlug` présélectionne le lieu. */
export const openCreateRoom = (venueSlug?: string) =>
  router.push({ pathname: '/rooms/new', params: venueSlug ? { venue: venueSlug } : {} })

/** Page du site public : aide, pages légales. */
export const openSite = (path: string) => void Linking.openURL(SITE_URL + path)

export function openTab(tab: string) {
  const route = TAB_ROUTES[tab as keyof typeof TAB_ROUTES]
  if (route) router.navigate(route)
}

// ponytail: listes complètes (programme, rooms, carte) pas encore faites
export const notYet = () => {}
