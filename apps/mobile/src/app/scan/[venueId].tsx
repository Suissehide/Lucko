import { Banner, Button, colors, Typography } from '@lucko/design-system'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useLocalSearchParams } from 'expo-router'
import { useRef } from 'react'
import { View } from 'react-native'
import { DetailScreen } from '@/components/DetailScreen'
import { useScanMutation } from '@/queries/useCheckin'
import { useMeQuery } from '@/queries/useMe'

/**
 * Scan du QR Lucko au comptoir (LKO-77), pour le staff d'un lieu partenaire. Le jeton est toujours
 * vérifié par l'API : sans connexion, pas de scan accepté. Un résultat à la fois, puis « Scanner le suivant ».
 */
export default function ScanScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>()
  const me = useMeQuery({ required: true })
  const venue = me?.venues.find((v) => v.id === venueId)
  const [permission, requestPermission] = useCameraPermissions()
  const scan = useScanMutation(venueId)
  const busy = scan.isPending || scan.isSuccess || scan.isError
  // La caméra signale le même QR plusieurs fois avant le rendu suivant : un seul envoi
  const locked = useRef(false)
  const next = () => {
    locked.current = false
    scan.reset()
  }

  return (
    <DetailScreen
      title="Scanner un QR Lucko"
      footer={busy && !scan.isPending ? <Button label="Scanner le suivant" onPress={next} /> : null}
    >
      <Typography variant="h1">Scanner un QR Lucko</Typography>
      {venue ? <Typography variant="small">{venue.name}</Typography> : null}

      {!permission ? null : !permission.granted ? (
        <Banner
          tone="warn"
          message="Autorise la caméra pour scanner le QR Lucko des joueurs."
          action="Autoriser"
          onAction={() => void requestPermission()}
        />
      ) : busy ? null : (
        <View
          style={{
            aspectRatio: 1,
            width: '100%',
            maxWidth: 420,
            alignSelf: 'center',
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 2,
            borderColor: colors.ink,
          }}
        >
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (locked.current) return
              locked.current = true
              scan.mutate(data)
            }}
          />
        </View>
      )}

      {scan.isPending ? <Typography variant="small">Vérification…</Typography> : null}
      {scan.isError ? <Banner tone="err" message={scan.error.message} /> : null}
      {scan.data ? (
        <View style={{ gap: 12 }}>
          <Banner
            tone={scan.data.alreadyScanned ? 'warn' : 'ok'}
            message={
              scan.data.alreadyScanned
                ? `${scan.data.pseudo ?? 'Ce joueur'} est déjà passé ce soir : avantage déjà accordé.`
                : `QR valide : ${scan.data.pseudo ?? 'joueur Lucko'}`
            }
          />
          {scan.data.alreadyScanned ? null : (
            <Typography variant="h2">
              {scan.data.perk ?? 'Pas d’avantage Lucko renseigné pour ce lieu.'}
            </Typography>
          )}
          {scan.data.minor ? (
            <Banner tone="warn" message="Joueur mineur : pas d’avantage sur l’alcool." />
          ) : null}
        </View>
      ) : null}
    </DetailScreen>
  )
}
