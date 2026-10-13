import {
  MobileScreen,
  PageTitle,
  ScreenHeader,
  Sidebar,
  TextLink,
  WebSidebarLayout,
} from '@lucko/design-system'
import { ArrowLeft } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ADMIN_KICKERS,
  ADMIN_TITLES,
  type AdminSection,
  adminSidebarItems,
  openAdmin,
} from '@/lib/admin'
import { openHome } from '@/lib/navigation'
import { useAdminDashboardQuery } from '@/queries/useAdminModeration'

const WIDE = 900

/**
 * Écran du back-office : barre latérale sombre et en-tête de section sur desktop ; sur téléphone,
 * en-tête avec retour (vers le tableau de bord, ou l'app depuis le tableau de bord). `subpage` : page
 * dans une section (nouveau lieu), avec son titre et un retour vers la section.
 */
export function AdminScreen({
  section,
  title = ADMIN_TITLES[section],
  kicker = ADMIN_KICKERS[section],
  note,
  subpage,
  children,
}: {
  section: AdminSection
  title?: string
  kicker?: string
  note?: string
  subpage?: boolean
  children: ReactNode
}) {
  const wide = useWindowDimensions().width >= WIDE
  const insets = useSafeAreaInsets()
  const dashboard = useAdminDashboardQuery().data

  if (!wide) {
    const onBack = subpage
      ? () => openAdmin(section)
      : section === 'dashboard'
        ? openHome
        : () => openAdmin('dashboard')
    return (
      <MobileScreen
        insets={insets}
        siteFooter={false}
        header={<ScreenHeader title={subpage ? title : ADMIN_TITLES[section]} onBack={onBack} />}
      >
        {children}
      </MobileScreen>
    )
  }

  return (
    <WebSidebarLayout
      sidebar={
        <Sidebar
          dark
          title="Back-office"
          items={adminSidebarItems(dashboard)}
          active={section}
          onSelect={openAdmin}
          footer={<TextLink onDark icon={ArrowLeft} label="Retour à l’app" onPress={openHome} />}
        />
      }
    >
      <View style={{ width: '100%', maxWidth: 1112, gap: 28, paddingBottom: 16 }}>
        <PageTitle eyebrow={kicker || undefined} title={title} big note={note} />
        {children}
      </View>
    </WebSidebarLayout>
  )
}
