import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'
import {
  HOME_ADDRESS_REVEAL_MS,
  HOME_FUZZY_RADIUS_M,
  type ParticipantStatus,
  type RoomAddress,
  type RoomStatus,
} from '@lucko/shared'
import { ROOM_PLAY_MS } from './rooms.rules'

const EARTH_M = 6_371_000
const rad = (deg: number) => (deg * Math.PI) / 180

/** Distance à vol d'oiseau, en mètres. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * EARTH_M * Math.asin(Math.sqrt(h))
}

/**
 * Centre de la zone floue (archi §8) : le point réel décalé au hasard jusqu'à 80 % du rayon, puis arrondi
 * au millième (~110 m). Le cercle de 500 m contient toujours le point réel. Tiré une seule fois, à la
 * création, et le même pour toutes les rooms d'un hôte à cette adresse (`stableDraws`) : un centre
 * différent à chaque fois permettrait de trianguler l'adresse.
 */
export function fuzzyCenter(lat: number, lng: number, random = Math.random) {
  const distance = HOME_FUZZY_RADIUS_M * 0.8 * Math.sqrt(random())
  const angle = 2 * Math.PI * random()
  const round = (deg: number) => Math.round(deg * 1000) / 1000
  return {
    lat: round(lat + ((distance * Math.cos(angle)) / EARTH_M) * (180 / Math.PI)),
    lng: round(
      lng + ((distance * Math.sin(angle)) / (EARTH_M * Math.cos(rad(lat)))) * (180 / Math.PI),
    ),
  }
}

/**
 * Tirage de `fuzzyCenter` stable pour un hôte et une adresse (LKO-155) : chaque nouvelle room au même
 * endroit reprend la même zone floue, sinon croiser les cercles de plusieurs rooms resserrerait l'adresse.
 * HMAC secret (clé des adresses) : la zone ne se recalcule pas sans la clé. Position arrondie à ~10 m.
 */
export function stableDraws(
  { active, keys }: AddressKeys,
  hostId: string,
  lat: number,
  lng: number,
) {
  const key = keys.get(active)
  if (!key) throw new Error('Clé d’adresse active introuvable')
  const digest = createHmac('sha256', key)
    .update(`fuzzy:${hostId}:${lat.toFixed(4)}:${lng.toFixed(4)}`)
    .digest()
  let offset = 0
  return () => {
    const draw = digest.readUInt32BE(offset) / 2 ** 32
    offset = (offset + 4) % digest.length
    return draw
  }
}

export const revealAt = (startsAt: Date) => new Date(startsAt.getTime() - HOME_ADDRESS_REVEAL_MS)

/** Marge après la fin supposée de la room avant de supprimer l'adresse (retardataires, oubli d'objet). */
const PURGE_MARGIN_MS = 6 * 60 * 60 * 1000

/** Les adresses des rooms commencées avant cette date sont supprimées. */
export const purgeBefore = (now = new Date()) =>
  new Date(now.getTime() - ROOM_PLAY_MS - PURGE_MARGIN_MS)

/**
 * Accès à l'adresse : motif de refus, ou null. L'hôte toujours ; un joueur accepté à partir de
 * 24 h avant le début ; jamais un joueur retiré, parti ou en attente, ni après la room ou une annulation.
 */
export function addressRefusal(
  room: {
    hostId: string
    status: RoomStatus
    startsAt: Date
    participants: { userId: string; status: ParticipantStatus }[]
  },
  userId: string,
  now = new Date(),
): string | null {
  if (room.status === 'CANCELLED') return 'Cette room est annulée'
  // Jamais dans l'historique, même avant la suppression
  if (now.getTime() >= room.startsAt.getTime() + ROOM_PLAY_MS) return 'Cette room est terminée'
  if (room.hostId === userId) return null
  const mine = room.participants.find((p) => p.userId === userId)
  if (mine?.status !== 'ACCEPTED') return 'L’adresse est réservée aux joueurs acceptés'
  if (now < revealAt(room.startsAt)) return 'L’adresse sera visible 24 h avant le début'
  return null
}

// ---------- Chiffrement de l'adresse (AES-256-GCM) ----------

const TAG_BYTES = 16

/** Clés par version ; `active` chiffre, les autres ne servent qu'à relire les adresses déjà chiffrées. */
export type AddressKeys = { active: number; keys: Map<number, Buffer> }

/**
 * `HOME_ADDRESS_KEYS` : « 2:<base64>,1:<base64> », clés de 32 octets, la première est la clé active.
 * Rotation : ajouter la nouvelle clé en tête ; retirer l'ancienne une fois ses adresses supprimées
 * (au plus 60 jours). Sans valeur (hors production, cf. env.ts), une clé de développement fixe.
 */
export function addressKeys(value?: string): AddressKeys {
  if (!value)
    return {
      active: 1,
      keys: new Map([[1, createHash('sha256').update('lucko-dev-home-address').digest()]]),
    }
  const entries = value.split(',').map((part) => {
    const [version = '', base64 = ''] = part.trim().split(':')
    const key = Buffer.from(base64, 'base64')
    if (!/^\d+$/.test(version) || key.length !== 32)
      throw new Error('« version:clé » attendu, clé de 32 octets en base64')
    return [Number(version), key] as const
  })
  const keys = new Map(entries)
  if (keys.size !== entries.length) throw new Error('Version de clé en double')
  return { active: entries[0]?.[0] ?? 1, keys }
}

export function sealAddress({ active, keys }: AddressKeys, address: RoomAddress) {
  const key = keys.get(active)
  if (!key) throw new Error('Clé d’adresse active introuvable')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(address), 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ])
  return { ciphertext, iv, keyVersion: active }
}

/** Déchiffre ; lève une erreur si la donnée a été altérée ou la clé ne correspond pas. */
export function openAddress(
  { keys }: AddressKeys,
  sealed: { ciphertext: Uint8Array; iv: Uint8Array; keyVersion: number },
): RoomAddress {
  const key = keys.get(sealed.keyVersion)
  if (!key) throw new Error(`Clé d’adresse version ${sealed.keyVersion} absente`)
  const data = Buffer.from(sealed.ciphertext)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv))
  decipher.setAuthTag(data.subarray(data.length - TAG_BYTES))
  const clear = Buffer.concat([
    decipher.update(data.subarray(0, data.length - TAG_BYTES)),
    decipher.final(),
  ])
  return JSON.parse(clear.toString('utf8'))
}
