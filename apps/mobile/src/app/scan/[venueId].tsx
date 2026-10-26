import { Banner, Button, colors, TextField, Typography } from '@lucko/design-system'
import { MANUAL_CODE } from '@lucko/shared'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
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
  const [code, setCode] = useState('')
  const next = () => {
    locked.current = false
    setCode('')
    scan.reset()
  }
  const submitCode = () => {
    if (MANUAL_CODE.test(code)) scan.mutate(code)
  }

  return (
    <DetailScreen
      title="Scanner un QR Lucko"
      footer={busy && !scan.isPending ? <Button label="Scanner le suivant" onPress={next} /> : null}
    >
      <Typography variant="h1">Scanner un QR Lucko</Typography>
      {venue ? <Typography variant="small">{venue.name}</Typography> : null}

      {!permission ? null : !permission.granted ? (
        permission.canAskAgain ? (
          <Banner
            tone="warn"
            message="Autorise la caméra pour scanner le QR Lucko des joueurs, ou saisis leur code."
            action="Autoriser"
            onAction={() => void requestPermission()}
          />
        ) : (
          <Banner
            tone="warn"
            message="Caméra refusée : saisis le code affiché sous le QR du joueur."
          />
        )
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

      {/* Sans caméra (ordinateur du comptoir, accès refusé) : code à 6 chiffres sous le QR du joueur (LKO-160) */}
      {busy ? null : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Ou code du joueur"
              placeholder="482 913"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={7}
              onSubmitEditing={submitCode}
            />
          </View>
          <Button label="Valider" disabled={!MANUAL_CODE.test(code)} onPress={submitCode} />
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
