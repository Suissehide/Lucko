import { MobileScreen, ScreenHeader, TextLink, WebScreen } from '@lucko/design-system'
import { ArrowLeft } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { goBack } from '@/lib/navigation'
import { PlayerNav } from './PlayerNav'

const WIDE = 900

/**
 * Fiche (lieu, événement) : en-tête avec retour et actions en pied fixe sur téléphone ;
 * sur desktop, barre de navigation, colonne centrée et actions sous le contenu.
 */
export function DetailScreen({
  title,
  footer,
  children,
}: {
  title: string
  footer?: ReactNode
  children: ReactNode
}) {
  const wide = useWindowDimensions().width >= WIDE
  const insets = useSafeAreaInsets()

  if (!wide) {
    return (
      <MobileScreen
        insets={insets}
        header={<ScreenHeader title={title} onBack={goBack} />}
        footer={footer}
      >
        {children}
      </MobileScreen>
    )
  }

  return (
    <WebScreen nav={<PlayerNav active="" create={false} />}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: 28 }}>
        <View style={{ alignSelf: 'flex-start' }}>
          <TextLink icon={ArrowLeft} label="Retour" onPress={goBack} />
        </View>
        {children}
        {footer ? <View style={{ alignSelf: 'flex-start', gap: 12 }}>{footer}</View> : null}
      </View>
    </WebScreen>
  )
}
