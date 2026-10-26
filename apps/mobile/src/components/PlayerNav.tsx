import { Button, playerNavItems, TopNav } from '@lucko/design-system'
import { router } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { openCreateRoom, openHome, openSettings, openSite, openTab } from '@/lib/navigation'
import { visibleAvatar } from '@/lib/profile'
import { useTabBadges } from '@/queries/useChat'
import { signOut, useMeQuery } from '@/queries/useMe'

/** Barre du site des écrans joueur (desktop) : onglets, création de room et menu du compte. */
export function PlayerNav({ active, create = true }: { active: string; create?: boolean }) {
  const me = useMeQuery()
  const badges = useTabBadges()
  return (
    <TopNav
      items={playerNavItems.map((item) => ({ ...item, badge: badges[item.key as 'messages'] }))}
      active={active}
      onSelect={openTab}
      onHome={openHome}
      right={
        create ? (
          <Button
            small
            kind="rating"
            icon={Plus}
            label="Créer une room"
            onPress={() => openCreateRoom()}
          />
        ) : null
      }
      account={
        me
          ? {
              pseudo: me.pseudo ?? '',
              email: me.email,
              avatarUri: visibleAvatar(me),
              items: [
                { label: 'Mon profil', onPress: () => openTab('profil') },
                { label: 'Réglages du compte', onPress: openSettings },
                { label: 'Aide', onPress: () => openSite('/help') },
                ...(me.role === 'ADMIN'
                  ? [{ label: 'Back-office', onPress: () => router.push('/admin') }]
                  : []),
              ],
              onSignOut: () => void signOut(),
            }
          : undefined
      }
    />
  )
}
