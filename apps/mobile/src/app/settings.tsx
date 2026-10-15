import {
  Banner,
  Button,
  CONTACT_EMAIL,
  ConfirmDialog,
  colors,
  font,
  LinkCard,
  PageTitle,
  ScreenHeader,
  SettingsCard,
  SettingsField,
  SettingsGroup,
  SettingsIdentity,
  SettingsNav,
  SettingsNotice,
  SettingsRow,
  SettingsSection,
  SkeletonCard,
  TextLink,
  Typography,
} from '@lucko/design-system'
import {
  NOTIFICATION_TOPIC_DESCRIPTIONS,
  NOTIFICATION_TOPIC_LABELS,
  NOTIFICATION_TOPICS,
} from '@lucko/shared'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import { ChevronRight, ExternalLink, Mail } from 'lucide-react-native'
import { type ReactNode, useEffect, useState } from 'react'
import { Linking, Platform, useWindowDimensions, View } from 'react-native'
import { PlayerScreen } from '@/components/PlayerScreen'
import { openSite } from '@/lib/navigation'
import { visibleAvatar } from '@/lib/profile'
import { registerPush } from '@/lib/push'
import { useSectionNav } from '@/lib/sectionNav'
import { useBlocksQuery } from '@/queries/useBlocks'
import { signOut, useMeMutations, useMeQuery } from '@/queries/useMe'

const WIDE = 900

const backToProfile = () => (router.canGoBack() ? router.back() : router.replace('/profile'))

// ponytail: mot de passe, fournisseur lié et langue attendent leurs écrans (section Compte)
const LUCKO_LINKS = [
  {
    label: 'Aide',
    description: 'Questions fréquentes',
    icon: ExternalLink,
    onPress: () => openSite('/help'),
  },
  // Contact du support exigé par Apple et Google (LKO-19)
  {
    label: 'Nous contacter',
    description: CONTACT_EMAIL,
    icon: Mail,
    onPress: () => Linking.openURL(`mailto:${CONTACT_EMAIL}`),
  },
  {
    label: "Conditions d'utilisation",
    description: 'Règles de la communauté',
    icon: ExternalLink,
    onPress: () => openSite('/terms'),
  },
  {
    label: 'Politique de confidentialité',
    description: 'Tes données et tes droits',
    icon: ExternalLink,
    onPress: () => openSite('/privacy'),
  },
]

const SECTIONS = ['Compte', 'Notifications', 'Lucko', 'Session']
const SECTION_IDS = ['compte', 'notifications', 'lucko', 'session'] as const

const version = `Lucko ${Constants.expoConfig?.version ?? ''}`
const versionStyle = { ...font('mono', 400), fontSize: 12, color: colors.muted }

/** Réglages du compte : e-mail, joueurs bloqués, liens Lucko et contact, déconnexion et suppression (LKO-18), notifications (LKO-108). */
export default function SettingsScreen() {
  const wide = useWindowDimensions().width >= WIDE
  const me = useMeQuery({ required: true })
  const blocked = useBlocksQuery().data?.length
  const { deleteAccount, updateProfile } = useMeMutations()
  const [confirm, setConfirm] = useState<'signOut' | 'delete' | null>(null)
  const nav = useSectionNav(SECTION_IDS, wide && !!me)
  // Notifications sur ce téléphone : null tant qu'on ne sait pas
  const [phonePush, setPhonePush] = useState<boolean | null>(null)
  useEffect(() => {
    if (Platform.OS !== 'web') void registerPush().then(setPhonePush, () => setPhonePush(false))
  }, [])

  // Refusées une fois, la demande système ne revient plus : on renvoie vers les réglages du téléphone
  const enablePhonePush = async () => {
    const enabled = await registerPush(true).catch(() => false)
    setPhonePush(enabled)
    if (!enabled) void Linking.openSettings()
  }

  const confirmDelete = () => {
    setConfirm(null)
    deleteAccount.mutate(undefined, { onSuccess: () => router.replace('/auth') })
  }

  const dialogs = (
    <>
      <ConfirmDialog
        visible={confirm === 'signOut'}
        sheet={!wide}
        title="Se déconnecter de Lucko ?"
        message="Tu pourras te reconnecter quand tu veux."
        confirmLabel="Se déconnecter"
        cancelLabel="Annuler"
        onConfirm={() => {
          setConfirm(null)
          void signOut()
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        visible={confirm === 'delete'}
        sheet={!wide}
        title="Supprimer ton compte ?"
        message="Toutes tes données seront effacées. Tu ne pourras pas revenir en arrière."
        confirmLabel={wide ? 'Supprimer' : 'Supprimer définitivement'}
        cancelLabel="Annuler"
        onConfirm={confirmDelete}
        onCancel={() => setConfirm(null)}
      />
    </>
  )

  const screen = (children: ReactNode) => (
    <PlayerScreen
      tab="profil"
      wide={wide}
      pushed
      header={<ScreenHeader title="Réglages" onBack={backToProfile} />}
    >
      {children}
      {dialogs}
    </PlayerScreen>
  )

  if (!me) return screen(<SkeletonCard />)

  // Affichage optimiste : la bascule en cours d'envoi l'emporte sur la valeur du serveur
  const notificationsOff =
    (updateProfile.isPending && updateProfile.variables.notificationsOff) || me.notificationsOff
  const topicRows = NOTIFICATION_TOPICS.map((topic) => {
    const on = !notificationsOff.includes(topic)
    return {
      label: NOTIFICATION_TOPIC_LABELS[topic],
      description: NOTIFICATION_TOPIC_DESCRIPTIONS[topic][wide ? 'long' : 'short'],
      toggle: {
        value: on,
        onChange: () =>
          updateProfile.mutate({
            notificationsOff: on
              ? [...notificationsOff, topic]
              : notificationsOff.filter((t) => t !== topic),
          }),
      },
    }
  })
  const webPushInfo =
    Platform.OS === 'web' ? (
      <Banner
        tone="info"
        message="Les notifications arrivent sur l'app mobile. Ces réglages s'appliquent à tous tes téléphones connectés."
      />
    ) : null
  const deleteError = deleteAccount.isError ? (
    <Banner tone="err" message="La suppression a échoué. Réessaie dans un instant." />
  ) : null

  if (!wide) {
    return screen(
      <View style={{ gap: 12 }}>
        <SettingsCard raised>
          <SettingsIdentity
            pseudo={me.pseudo ?? ''}
            avatarUri={visibleAvatar(me)}
            detail={me.email ?? ''}
            aside={
              <TextLink
                label="Profil"
                icon={ChevronRight}
                iconAfter
                onPress={() => router.push('/profile')}
              />
            }
          />
        </SettingsCard>
        <SettingsGroup
          title="Compte"
          rows={[
            {
              label: 'Joueurs bloqués',
              value: blocked === undefined ? undefined : blocked ? String(blocked) : 'Aucun',
              onPress: () => router.push('/blocked'),
            },
            ...(me.childCount
              ? [
                  {
                    label: 'Mes enfants',
                    value: String(me.childCount),
                    onPress: () => router.push('/children'),
                  },
                ]
              : []),
            ...(me.role === 'ADMIN'
              ? [{ label: 'Back-office', onPress: () => router.push('/admin') }]
              : []),
          ]}
        />
        <SettingsGroup
          title="Notifications"
          notice={
            phonePush === false ? (
              <SettingsNotice
                title="Notifications coupées sur ce téléphone"
                message="Tu ne recevras rien tant qu'elles sont coupées dans les réglages du téléphone."
                action="Activer"
                onAction={enablePhonePush}
              />
            ) : null
          }
          rows={topicRows.map((row) => ({ ...row, dimmed: phonePush === false }))}
        />
        {webPushInfo}
        <SettingsGroup
          title="Lucko"
          rows={LUCKO_LINKS.map(({ label, icon, onPress }) => ({ label, icon, onPress }))}
        />
        <View style={{ marginTop: 20 }}>
          <Button kind="danger" label="Se déconnecter" onPress={() => setConfirm('signOut')} />
        </View>
        {deleteError}
        <View style={{ alignItems: 'center', gap: 8, marginTop: 10 }}>
          <View style={{ minHeight: 44, justifyContent: 'center' }}>
            <TextLink muted label="Supprimer mon compte" onPress={() => setConfirm('delete')} />
          </View>
          <Typography style={versionStyle}>{version}</Typography>
        </View>
      </View>,
    )
  }

  return screen(
    <View
      style={{
        width: '100%',
        maxWidth: 1016,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 56,
        paddingBottom: 24,
      }}
    >
      <SettingsNav
        back="Profil"
        onBack={backToProfile}
        items={SECTIONS}
        active={nav.active}
        onSelect={nav.select}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 40 }}>
        <PageTitle eyebrow="Ton compte" title="Réglages" hero />

        <SettingsSection
          id="compte"
          title="Compte"
          description="Ce qui t'identifie sur Lucko. Seul ton pseudo est visible des autres joueurs."
        >
          <SettingsCard raised>
            <SettingsIdentity
              pseudo={me.pseudo ?? ''}
              avatarUri={visibleAvatar(me)}
              detail="Pseudo, photo, ville et disponibilités"
              size={52}
              aside={
                <Button
                  small
                  kind="ghost"
                  label="Modifier le profil"
                  onPress={() => router.push('/profile/edit')}
                />
              }
            />
            {me.email ? <SettingsField label="E-mail de connexion" value={me.email} /> : null}
            <SettingsRow
              wide
              label="Joueurs bloqués"
              description="Ils ne voient plus tes rooms et ne peuvent plus t'écrire."
              value={
                blocked === undefined
                  ? undefined
                  : blocked
                    ? `${blocked} joueur${blocked > 1 ? 's' : ''}`
                    : 'Aucun'
              }
              onPress={() => router.push('/blocked')}
            />
            {me.childCount ? (
              <SettingsRow
                wide
                label="Mes enfants"
                description="Leur activité sur Lucko, et le retrait de ton accord."
                value={`${me.childCount} enfant${me.childCount > 1 ? 's' : ''}`}
                onPress={() => router.push('/children')}
              />
            ) : null}
            {me.role === 'ADMIN' ? (
              <SettingsRow
                wide
                label="Back-office"
                description="Modération, lieux, événements et journal d'audit."
                onPress={() => router.push('/admin')}
              />
            ) : null}
          </SettingsCard>
        </SettingsSection>

        <SettingsSection
          id="notifications"
          title="Notifications"
          description="Choisis ce qui mérite de faire vibrer ton téléphone."
        >
          {webPushInfo}
          <SettingsCard>
            {topicRows.map((row) => (
              <SettingsRow key={row.label} wide {...row} />
            ))}
          </SettingsCard>
        </SettingsSection>

        <SettingsSection id="lucko" title="Lucko">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {LUCKO_LINKS.map((link) => (
              <View key={link.label} style={{ flexBasis: '40%', flexGrow: 1 }}>
                <LinkCard {...link} />
              </View>
            ))}
          </View>
        </SettingsSection>

        <SettingsSection id="session" title="Session">
          <SettingsCard>
            {/* Desktop : pas de confirmation, comme dans le menu du compte */}
            <SettingsRow
              wide
              label="Se déconnecter"
              description="Tu quittes Lucko sur ce navigateur. Tes parties et réglages sont conservés."
              aside={
                <Button small kind="danger" label="Se déconnecter" onPress={() => void signOut()} />
              }
            />
            <SettingsRow
              wide
              danger
              label="Supprimer mon compte"
              description="Toutes tes données seront effacées : profil, LK, historique et messages. C'est définitif."
              aside={
                <Button
                  small
                  kind="ghost"
                  label="Supprimer…"
                  onPress={() => setConfirm('delete')}
                />
              }
            />
          </SettingsCard>
          {deleteError}
          <Typography style={versionStyle}>{version}</Typography>
        </SettingsSection>
      </View>
    </View>,
  )
}
