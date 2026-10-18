import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo'
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black'
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useFonts } from 'expo-font'
import { Stack, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { trackPage } from '@/lib/analytics'
import { usePush } from '@/lib/push'
import { persistOptions, queryClient } from '@/lib/queryClient'
import { Sentry } from '@/lib/sentry'
import { useMeQuery } from '@/queries/useMe'

const TAB_SCREENS = ['index', 'agenda/index', 'my-games', 'messages', 'profile/index']

function PushSetup() {
  usePush(useMeQuery()?.id)
  return null
}

function PageViews() {
  const path = usePathname()
  useEffect(() => trackPage(path), [path])
  return null
}

function RootLayout() {
  // Noms identiques à ceux du design system (tokens `font()`)
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    ArchivoBlack_400Regular,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  })
  if (!fontsLoaded) return null

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <PushSetup />
      <PageViews />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Onglets : chaque écran porte sa barre d'onglets, un glissement ferait défiler la barre avec la page */}
        {TAB_SCREENS.map((name) => (
          <Stack.Screen key={name} name={name} options={{ animation: 'none' }} />
        ))}
        {/* Créer une room : popup par-dessus la page en cours sur le web, plein écran sur téléphone */}
        <Stack.Screen
          name="rooms/new"
          options={
            Platform.OS === 'web'
              ? { presentation: 'transparentModal', animation: 'fade' }
              : { presentation: 'fullScreenModal' }
          }
        />
      </Stack>
      <StatusBar style="auto" />
    </PersistQueryClientProvider>
  )
}

// Erreurs de rendu et plantages remontés à GlitchTip (LKO-36)
export default Sentry.wrap(RootLayout)
