import { ConfirmDialog, Panel, ScreenHeader, TextLink, Typography } from '@lucko/design-system'
import { type Me, PLAY_VIBE_LABELS, PLAY_VIBES } from '@lucko/shared'
import { useStore } from '@tanstack/react-form'
import { router, useNavigation } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { ArrowLeft } from 'lucide-react-native'
import { type ReactNode, useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { MeLoading } from '@/components/MeLoading'
import { PlayerScreen } from '@/components/PlayerScreen'
import { IdentityFields } from '@/components/profile/IdentityFields'
import { WhereFields } from '@/components/profile/WhereFields'
import { profileBody, profileDefaults, profileFormOpts } from '@/forms/profile.form'
import { useAppForm } from '@/hooks/formConfig'
import { ApiError } from '@/lib/queryClient'
import { useMeMutations, useMeQuery } from '@/queries/useMe'

const WIDE = 900

const VIBE_OPTIONS = PLAY_VIBES.map((key) => ({ key, ...PLAY_VIBE_LABELS[key] }))

const backToProfile = () => (router.canGoBack() ? router.back() : router.replace('/profile'))

/** Modifier le profil (F3) : pseudo, prénom et nom privés, ville et rayon, disponibilités, ambiance. */
export default function EditProfileScreen() {
  const wide = useWindowDimensions().width >= WIDE
  const me = useMeQuery({ required: true })
  if (me) return <EditForm me={me} wide={wide} />
  return (
    <PlayerScreen
      tab="profil"
      wide={wide}
      pushed
      header={<ScreenHeader title="Modifier" onBack={backToProfile} />}
    >
      <MeLoading />
    </PlayerScreen>
  )
}

function EditForm({ me, wide }: { me: Me; wide: boolean }) {
  const navigation = useNavigation()
  const { updateProfile } = useMeMutations()
  const [done, setDone] = useState(false)
  const [leaving, setLeaving] = useState<(() => void) | null>(null)

  const form = useAppForm({
    ...profileFormOpts,
    defaultValues: profileDefaults(me),
    onSubmit: async ({ value, formApi }) => {
      try {
        const saved = await updateProfile.mutateAsync(await profileBody(value))
        // Les valeurs enregistrées deviennent la référence : plus de « modifications non enregistrées »
        formApi.reset(profileDefaults(saved))
        setDone(true)
      } catch (error) {
        formApi.setErrorMap({
          onSubmit:
            error instanceof ApiError && error.status === 409
              ? { fields: { pseudo: 'Ce pseudo est déjà pris.' } }
              : { form: 'L’enregistrement a échoué. Réessaie dans un instant.', fields: {} },
        })
      }
    },
  })
  const dirty = !useStore(form.store, (state) => state.isDefaultValue)
  const slots = useStore(form.store, (state) => state.values.availability.length)

  usePreventRemove(dirty, ({ data }) => setLeaving(() => () => navigation.dispatch(data.action)))
  // Une fois enregistré (dirty repassé à false), on peut revenir au profil
  useEffect(() => {
    if (done) backToProfile()
  }, [done])

  const identity = (
    <IdentityFields
      form={form}
      compact={!wide}
      avatarUri={me.avatarUrl}
      avatarStatus={me.avatarStatus}
      withName
    />
  )
  const where = <WhereFields form={form} compact={!wide} />
  const slotCount = (
    <Typography variant="label">
      {slots} créneau{slots > 1 ? 'x' : ''}
    </Typography>
  )
  const error = (
    <form.AppForm>
      <form.FormError />
    </form.AppForm>
  )
  const confirm = (
    <ConfirmDialog
      visible={!!leaving}
      title={'Quitter sans enregistrer\u00a0?'}
      message="Tes modifications seront perdues."
      confirmLabel="Quitter"
      cancelLabel="Rester"
      onConfirm={() => {
        const go = leaving
        setLeaving(null)
        go?.()
      }}
      onCancel={() => setLeaving(null)}
    />
  )

  if (!wide) {
    return (
      <PlayerScreen
        tab="profil"
        wide={false}
        pushed
        header={
          <ScreenHeader
            title="Modifier"
            onBack={backToProfile}
            right={
              <form.AppForm>
                <form.SubmitButton small kind={dirty ? 'room' : 'ghost'} label="Enregistrer" />
              </form.AppForm>
            }
          />
        }
      >
        {error}
        <Panel compact>{identity}</Panel>
        <Typography variant="h2">Où tu joues</Typography>
        <Panel compact>{where}</Panel>
        <Heading title="Disponibilités" right={slotCount} />
        <form.AppField name="availability">
          {(field) => <field.Availability compact />}
        </form.AppField>
        <Typography variant="h2">Ambiance</Typography>
        <form.AppField name="vibes">
          {(field) => <field.MultiChoice compact options={VIBE_OPTIONS} />}
        </form.AppField>
        {confirm}
      </PlayerScreen>
    )
  }

  return (
    <PlayerScreen tab="profil" wide>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 24 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 12, alignItems: 'flex-start' }}>
          <TextLink icon={ArrowLeft} label="Profil" onPress={backToProfile} />
          <Typography variant="hero">Modifier le profil</Typography>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {dirty ? <Typography variant="small">Modifications non enregistrées</Typography> : null}
          <form.AppForm>
            <form.SubmitButton label="Enregistrer" />
          </form.AppForm>
        </View>
      </View>
      {error}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 40 }}>
        <View style={{ flex: 5, minWidth: 0, gap: 40 }}>
          <Panel title="Identité">{identity}</Panel>
          <Panel title="Où tu joues">{where}</Panel>
        </View>
        <View style={{ flex: 7, minWidth: 0, gap: 40 }}>
          <Panel title="Disponibilités" right={slotCount}>
            <Typography variant="small">
              Touche les créneaux où tu peux jouer. On te propose les rooms et soirées qui tombent
              dedans.
            </Typography>
            <form.AppField name="availability">{(field) => <field.Availability />}</form.AppField>
            <Typography variant="label">
              Matin 9 h – 12 h · Après-midi 12 h – 18 h · Soir 18 h – minuit
            </Typography>
          </Panel>
          <Panel title="Ambiance">
            <Typography variant="small">
              Comment tu aimes jouer. Affiché sur ton profil et utilisé pour te proposer des tables.
            </Typography>
            <form.AppField name="vibes">
              {(field) => <field.MultiChoice options={VIBE_OPTIONS} />}
            </form.AppField>
          </Panel>
        </View>
      </View>
      {confirm}
    </PlayerScreen>
  )
}

function Heading({ title, right }: { title: string; right: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Typography variant="h2">{title}</Typography>
      {right}
    </View>
  )
}
