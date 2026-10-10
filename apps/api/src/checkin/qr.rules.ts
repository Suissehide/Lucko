import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { addDays, localDateTime, QR_TOKEN_TTL_MS } from '@lucko/shared'

/** Préfixe de version du jeton : changer de format ou de clé = nouveau préfixe. */
const VERSION = 'lk1'

/**
 * Clé HMAC des QR Lucko, dérivée du secret de session (BETTER_AUTH_SECRET). Changer le secret invalide
 * seulement les jetons en cours, que l'app renouvelle toutes les minutes : pas de clé ni de rotation à part.
 */
export const qrKey = (secret = 'lucko-dev-auth-secret') =>
  createHmac('sha256', secret).update('lucko-qr-token').digest()

const sign = (key: Buffer, payload: string) => createHmac('sha256', key).update(payload).digest()

/** Jeton signé côté serveur : joueur, nonce à usage unique, expiration (archi §10). */
export function signQrToken(key: Buffer, userId: string, now = new Date()) {
  const expiresAt = new Date(now.getTime() + QR_TOKEN_TTL_MS)
  const payload = Buffer.from(
    JSON.stringify({ u: userId, n: randomBytes(12).toString('base64url'), e: expiresAt.getTime() }),
  ).toString('base64url')
  return { token: `${VERSION}.${payload}.${sign(key, payload).toString('base64url')}`, expiresAt }
}

const INVALID = 'Ce n’est pas un QR Lucko valide'

/** Joueur et nonce d'un jeton authentique et pas expiré, sinon le motif du refus montré au comptoir. */
export function verifyQrToken(
  key: Buffer,
  token: string,
  now = new Date(),
): { userId: string; nonce: string } | { refused: string } {
  const [version, payload, signature] = token.split('.')
  if (version !== VERSION || !payload || !signature) return { refused: INVALID }
  const given = Buffer.from(signature, 'base64url')
  const expected = sign(key, payload)
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return { refused: INVALID }
  const data: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString())
  if (
    typeof data !== 'object' ||
    data === null ||
    !('u' in data && typeof data.u === 'string') ||
    !('n' in data && typeof data.n === 'string') ||
    !('e' in data && typeof data.e === 'number')
  )
    return { refused: INVALID }
  if (data.e <= now.getTime())
    return { refused: 'QR expiré : demande au joueur de rouvrir son QR Lucko' }
  return { userId: data.u, nonce: data.n }
}

/** Heure (Paris) avant laquelle un passage compte pour la soirée de la veille. */
const EVENING_ENDS_AT = 6 * 60

/** Soirée de rattachement d'une venue (date locale « 2026-10-10 ») : jusqu'à 6 h, c'est encore la veille. */
export function businessDate(now = new Date()) {
  const { date, minute } = localDateTime(now)
  return minute < EVENING_ENDS_AT ? addDays(date, -1) : date
}
