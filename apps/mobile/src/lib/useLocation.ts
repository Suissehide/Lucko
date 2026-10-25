import { DEFAULT_CITY } from '@lucko/shared'
import * as Location from 'expo-location'
import { useEffect, useState } from 'react'
import { useMeQuery } from '@/queries/useMe'

export type Place = { lat: number; lng: number; label: string }

const fallback: Place = { lat: DEFAULT_CITY.lat, lng: DEFAULT_CITY.lng, label: DEFAULT_CITY.name }

/**
 * Position du joueur pour l'exploration : celle du téléphone si elle est accordée, sinon la ville de son
 * profil (LKO-147), sinon le centre de Bordeaux.
 * `ready` passe à true une fois la position connue, le repli choisi ou après 3 s sans réponse.
 * `located` : position du téléphone (distances exactes), pas un repli.
 */
export function useLocation() {
  const me = useMeQuery()
  const [device, setDevice] = useState<Place | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    // La demande de position peut rester sans réponse
    const timer = setTimeout(() => setReady(true), 3000)
    ;(async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync()
        if (!granted) return
        const { coords } = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        if (!cancelled) {
          setDevice({ lat: coords.latitude, lng: coords.longitude, label: 'Autour de toi' })
        }
      } catch {
        // Position indisponible (web sans HTTPS, GPS coupé…) : ville du profil ou Bordeaux.
      } finally {
        clearTimeout(timer)
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const profile =
    me?.city && me.latitude != null && me.longitude != null
      ? { lat: me.latitude, lng: me.longitude, label: me.city }
      : null
  return { place: device ?? profile ?? fallback, ready, located: device !== null }
}
