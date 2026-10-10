import { Banner, colors, SkeletonCard, Typography } from '@lucko/design-system'
import { QR_TOKEN_TTL_MS } from '@lucko/shared'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { DetailScreen } from '@/components/DetailScreen'
import { useQrTokenQuery } from '@/queries/useCheckin'
import { useMeQuery } from '@/queries/useMe'

const QR_SIZE = 240

/**
 * Mon QR Lucko (LKO-77) : à montrer au comptoir d'un lieu partenaire pour l'avantage Lucko.
 * Jeton renouvelé chaque minute et compte à rebours qui bouge : une capture d'écran ne sert à rien.
 * Connecté seulement : sans réseau, plus de QR une fois le jeton expiré.
 */
// ponytail: luminosité pas forcée au maximum (expo-brightness), à ajouter si les scans échouent en salle sombre
export default function QrScreen() {
  const me = useMeQuery({ required: true })
  const { data, isError, refetch, dataUpdatedAt } = useQrTokenQuery()
  // Compté depuis la réception du jeton : l'horloge du téléphone peut différer de celle de l'API
  const left = useCountdown(dataUpdatedAt + QR_TOKEN_TTL_MS)
  const valid = !!data && left > 0

  return (
    <DetailScreen title="Mon QR Lucko">
      <View style={{ alignItems: 'center', gap: 16, paddingVertical: 8 }}>
        <Typography variant="h1">Mon QR Lucko</Typography>
        <Typography variant="small" style={{ textAlign: 'center' }}>
          Montre-le au comptoir d’un lieu partenaire pour profiter de l’avantage Lucko.
        </Typography>
        {valid ? (
          <>
            <View
              style={{
                padding: 16,
                backgroundColor: colors.white,
                borderWidth: 2,
                borderColor: colors.ink,
                borderRadius: 16,
              }}
            >
              <QRCode value={data.token} size={QR_SIZE} color={colors.ink} />
            </View>
            {me?.pseudo ? <Typography variant="h2">{me.pseudo}</Typography> : null}
            <View
              style={{ width: QR_SIZE, height: 6, borderRadius: 3, backgroundColor: colors.line }}
            >
              <View
                style={{
                  width: `${(left / (QR_TOKEN_TTL_MS / 1000)) * 100}%`,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.ink,
                }}
              />
            </View>
            <Typography variant="small">Nouveau QR dans {left} s</Typography>
          </>
        ) : isError ? (
          <Banner
            tone="err"
            message="Connexion requise pour afficher ton QR Lucko."
            action="Réessayer"
            onAction={() => void refetch()}
          />
        ) : (
          <SkeletonCard />
        )}
      </View>
    </DetailScreen>
  )
}

/** Secondes restantes jusqu'à `until` (ms), mises à jour chaque seconde. */
function useCountdown(until: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return Math.max(0, Math.ceil((until - now) / 1000))
}
