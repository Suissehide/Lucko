import type { ReactNode } from 'react'
import { Platform, ScrollView, Text, View } from 'react-native'
import { SITE_URL, SiteFooter } from '../organisms/SiteFooter'
import { border, colors, font, space } from '../tokens'

/**
 * Squelette d'écran mobile : fond cream, pastille « MODE LIEU » optionnelle, en-tête,
 * contenu (défilant par défaut, suivi du pied de page du site), pied fixe (actions) et barre d'onglets.
 * Les marges de sécurité viennent de l'app (react-native-safe-area-context) via `insets`.
 */
export function MobileScreen({
  header,
  hero,
  children,
  footer,
  siteFooter = Platform.OS === 'web',
  tabBar,
  venueMode,
  scroll = true,
  insets = { top: 0, bottom: 0 },
}: {
  header?: ReactNode
  /** Pleine largeur en haut du contenu défilant (photo d'une fiche), sans marge ni encoche. */
  hero?: ReactNode
  children: ReactNode
  /** Pied fixe (boutons d'action), au-dessus de la barre d'onglets. */
  footer?: ReactNode
  /** Pied de page du site en fin de contenu défilant, sur le web seulement ; `false` sur les parcours (auth…). */
  siteFooter?: boolean
  tabBar?: ReactNode
  /** Nom du lieu : affiche la pastille « MODE LIEU · <nom> ». */
  venueMode?: string
  scroll?: boolean
  insets?: { top: number; bottom: number }
}) {
  const body = { paddingHorizontal: space.screen, paddingTop: 4, paddingBottom: 16, gap: 14 }
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: hero ? 0 : insets.top }}>
      {venueMode ? (
        <View style={{ alignItems: 'center', marginBottom: 6 }}>
          <Text
            style={{
              ...font('mono', 700),
              fontSize: 10,
              textTransform: 'uppercase',
              backgroundColor: colors.venue,
              color: colors.white,
              borderWidth: border.thin,
              borderColor: colors.ink,
              borderRadius: 99,
              paddingVertical: 2,
              paddingHorizontal: 10,
            }}
          >
            Mode lieu · {venueMode}
          </Text>
        </View>
      ) : null}
      {header}
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
          {hero}
          <View style={[{ flexGrow: 1 }, body, hero ? { paddingTop: space.screen } : null]}>
            {children}
          </View>
          {siteFooter ? <SiteFooter compact siteUrl={SITE_URL} /> : null}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, body]}>{children}</View>
      )}
      {footer ? (
        <View
          style={{
            paddingTop: 12,
            paddingHorizontal: space.screen,
            paddingBottom: tabBar ? 18 : 18 + insets.bottom,
            gap: 10,
            borderTopWidth: border.base,
            borderColor: colors.ink,
            backgroundColor: colors.white,
          }}
        >
          {footer}
        </View>
      ) : null}
      {tabBar}
    </View>
  )
}
