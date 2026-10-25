import {
  Banner,
  Button,
  font,
  InlineLink,
  Logo,
  Note,
  Segmented,
  SITE_URL,
  TextLink,
  Typography,
} from '@lucko/design-system'
import {
  type AgeRegime,
  ageRegime,
  emailSchema,
  MIN_AGE,
  PASSWORD_MIN,
  parseBirthDate,
  passwordSchema,
} from '@lucko/shared'
import * as Linking from 'expo-linking'
import { router, useLocalSearchParams } from 'expo-router'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { type TextInput, useWindowDimensions, View } from 'react-native'
import { Frame, StepAction, StepButton, StepLayout, WIDE, Wide } from '@/components/StepFrame'
import { TableScene } from '@/components/TableScene'
import { useAppForm } from '@/hooks/formConfig'
import { authClient } from '@/lib/auth'
import { ApiError, queryClient } from '@/lib/queryClient'
import { forgetMe, meQueryOptions, useMeMutations } from '@/queries/useMe'

type Step = 'welcome' | 'email' | 'forgot' | 'birth' | AgeRegime

/** Page à rouvrir après la connexion (`/auth?next=/consent/…`), seulement un chemin de l'app. */
const afterAuth = { next: '/' }
const goNext = () => router.replace(afterAuth.next as '/')

/**
 * Accueil (A1), e-mail (A2) et date de naissance obligatoire (A3, LKO-44), branchés sur Better Auth (LKO-9).
 * Téléphone et navigateur desktop.
 */
export default function AuthScreen() {
  const { width } = useWindowDimensions()
  const [step, setStep] = useState<Step>('welcome')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<AccountMode>('login')
  /** Connecté par Apple / Google, il ne manque que la date de naissance (le compte existe déjà). */
  const [social, setSocial] = useState(false)
  const [providerError, setProviderError] = useState(false)
  const { signedOut, next } = useLocalSearchParams<{ signedOut?: string; next?: string }>()
  afterAuth.next = next?.startsWith('/') && !next.startsWith('//') ? next : '/'
  const wide = width >= WIDE
  const { setBirthDate } = useMeMutations()

  /** Après une connexion : accueil, ou date de naissance si Apple / Google vient de créer le compte. */
  const resume = useCallback(async () => {
    const { data: session } = await authClient.getSession()
    if (!session) return
    const me = await queryClient.fetchQuery(meQueryOptions).catch(() => null)
    if (!me) return
    if (me.hasBirthDate) return goNext()
    setSocial(true)
    setStep('birth')
  }, [])

  // Retour d'Apple / Google sur le web (la page est rechargée sur /auth), ou joueur déjà connecté.
  // Le profil gardé en mémoire peut être celui d'un autre compte : on l'oublie
  useEffect(() => {
    forgetMe()
    void resume()
  }, [resume])

  const signInWith = async (provider: 'apple' | 'google') => {
    setProviderError(false)
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: Linking.createURL('/auth'),
    })
    if (error) return setProviderError(true)
    // Téléphone : le navigateur système est refermé, la session est là
    await resume()
  }

  /** Fin de l'étape date de naissance : crée le compte e-mail, ou complète celui d'Apple / Google. */
  const finishBirth = async (date: Date): Promise<string | undefined> => {
    const regime = ageRegime(date)
    const birthDate = date.toISOString().slice(0, 10)
    if (social) {
      const error = await setBirthDate
        .mutateAsync(birthDate)
        .then(() => null)
        .catch((e: unknown) => e)
      // 403 : trop jeune, l'API a supprimé le compte créé par Apple / Google
      if (error instanceof ApiError && error.status === 403)
        await authClient.signOut().catch(() => undefined)
      else if (error) return 'Impossible d’enregistrer ta date de naissance. Réessaie.'
    } else if (regime !== 'too-young') {
      const { error } = await authClient.signUp.email({ email, password, name: '', birthDate })
      if (error?.code?.startsWith('USER_ALREADY_EXISTS'))
        return 'Un compte existe déjà avec cet e-mail. Reviens en arrière pour te connecter.'
      if (error) return 'Impossible de créer ton compte pour l’instant. Réessaie.'
    }
    setStep(regime)
  }

  let content: ReactNode
  if (step === 'welcome') {
    content = (
      <Frame
        title="Connexion"
        phoneTitle={false}
        footer={
          <>
            {/* Desktop : le trio prend la largeur du plus long bouton, pas toute la carte */}
            <View style={wide ? { alignSelf: 'flex-start', gap: 12 } : { gap: 10 }}>
              <Button
                label="Continuer avec Apple"
                kind="ink"
                onPress={() => void signInWith('apple')}
              />
              <Button
                label="Continuer avec Google"
                kind="ghost"
                onPress={() => void signInWith('google')}
              />
              <Button label="Continuer avec un e-mail" onPress={() => setStep('email')} />
            </View>
            {providerError ? (
              <Note>
                La connexion avec Apple ou Google n’a pas marché. Réessaie, ou utilise ton e-mail.
              </Note>
            ) : null}
            <Typography variant="small" style={wide ? null : { textAlign: 'center' }}>
              En continuant, tu acceptes les{' '}
              <InlineLink href={`${SITE_URL}/terms`}>conditions d'utilisation</InlineLink> et la{' '}
              <InlineLink href={`${SITE_URL}/privacy`}>politique de confidentialité</InlineLink>.
            </Typography>
          </>
        }
      >
        {wide ? (
          <>
            {signedOut ? <Banner tone="ok" message="Tu es déconnecté·e." /> : null}
            <Typography>Connecte-toi ou crée ton compte Lucko.</Typography>
          </>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
            <Logo size={44} />
            <Typography variant="display">Lucko</Typography>
            <Typography style={{ ...font('body', 600), fontSize: 17, lineHeight: 24 }}>
              Trouve où jouer ce soir et avec qui.
            </Typography>
          </View>
        )}
      </Frame>
    )
  } else if (step === 'email') {
    content = (
      <AccountStep
        email={email}
        mode={mode}
        onMode={setMode}
        onBack={() => setStep('welcome')}
        onCreate={(e, p) => {
          setEmail(e)
          setPassword(p)
          setStep('birth')
        }}
        onForgot={(e) => {
          setEmail(e)
          setStep('forgot')
        }}
      />
    )
  } else if (step === 'forgot') {
    content = <ForgotStep email={email} onBack={() => setStep('email')} />
  } else if (step === 'birth') {
    content = (
      <BirthStep onBack={() => setStep(social ? 'welcome' : 'email')} onDone={finishBirth} />
    )
  } else {
    content = (
      <Outcome
        regime={step}
        onRestart={() => {
          setSocial(false)
          setStep('welcome')
        }}
      />
    )
  }

  return (
    <Wide.Provider value={wide}>
      {wide ? <WideLayout>{content}</WideLayout> : content}
    </Wide.Provider>
  )
}

/** Navigateur desktop : accroche et pièces 3D à gauche, étape à droite. */
function WideLayout({ children }: { children: ReactNode }) {
  return (
    <StepLayout
      aside={
        <>
          <Typography variant="hero" style={{ maxWidth: 560 }}>
            Trouve où jouer ce soir et avec qui.
          </Typography>
          <View style={{ height: 300, marginTop: 56 }}>
            <TableScene />
          </View>
        </>
      }
    >
      {children}
    </StepLayout>
  )
}

type AccountMode = 'login' | 'create'

/** E-mail + mot de passe : connexion à un compte existant, ou début de la création (suivie de la date de naissance). */
function AccountStep({
  email,
  mode,
  onMode,
  onBack,
  onCreate,
  onForgot,
}: {
  email: string
  mode: AccountMode
  onMode: (mode: AccountMode) => void
  onBack: () => void
  onCreate: (email: string, password: string) => void
  onForgot: (email: string) => void
}) {
  const passwordRef = useRef<TextInput>(null)
  const create = mode === 'create'
  const form = useAppForm({
    defaultValues: { email, password: '' },
    onSubmit: async ({ value, formApi }) => {
      const address = emailSchema.parse(value.email)
      // Création : le compte n'est créé qu'après la date de naissance (âge vérifié par l'API)
      if (create) return onCreate(address, value.password)
      const { error } = await authClient.signIn.email({ email: address, password: value.password })
      if (error)
        return formApi.setErrorMap({
          onSubmit: { fields: { password: 'E-mail ou mot de passe incorrect.' } },
        })
      goNext()
    },
  })

  return (
    <Frame
      title={create ? 'Créer un compte' : 'Se connecter'}
      onBack={onBack}
      progress={create ? 1 : undefined}
      footer={
        <form.AppForm>
          <StepAction>
            <form.SubmitButton label={create ? 'Continuer' : 'Se connecter'} />
          </StepAction>
        </form.AppForm>
      }
    >
      <Segmented
        items={['Se connecter', 'Créer un compte']}
        value={create ? 1 : 0}
        onChange={(i) => {
          onMode(i ? 'create' : 'login')
          // Les erreurs de l'autre mode ne valent plus : on garde la saisie
          form.reset(form.state.values)
        }}
      />
      <form.AppField
        name="email"
        validators={{
          onSubmit: ({ value }) =>
            emailSchema.safeParse(value).success
              ? undefined
              : 'Cette adresse e-mail ne semble pas valide. Vérifie-la.',
        }}
      >
        {(field) => (
          <field.Text
            label="Adresse e-mail"
            placeholder="toi@exemple.fr"
            autoFocus
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        )}
      </form.AppField>
      <form.AppField
        name="password"
        validators={{
          onSubmit: ({ value }) =>
            create
              ? passwordSchema.safeParse(value).error?.issues[0]?.message
              : value
                ? undefined
                : 'Saisis ton mot de passe.',
        }}
      >
        {(field) => (
          <field.Text
            ref={passwordRef}
            label="Mot de passe"
            help={create ? `${PASSWORD_MIN} caractères minimum` : undefined}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={create ? 'new-password' : 'current-password'}
            returnKeyType="done"
            onSubmitEditing={() => void form.handleSubmit()}
          />
        )}
      </form.AppField>
      {create ? null : (
        <TextLink
          muted
          label="Mot de passe oublié ?"
          onPress={() => onForgot(form.state.values.email.trim())}
        />
      )}
    </Frame>
  )
}

/**
 * Mot de passe oublié (LKO-138) : Better Auth envoie un lien valable une heure, qui rouvre l'app sur
 * /reset-password. Même réponse que le compte existe ou non (pas de fuite des e-mails inscrits).
 */
function ForgotStep({ email, onBack }: { email: string; onBack: () => void }) {
  const [sent, setSent] = useState(false)
  const form = useAppForm({
    defaultValues: { email },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.requestPasswordReset({
        email: emailSchema.parse(value.email),
        redirectTo: Linking.createURL('/reset-password'),
      })
      if (error)
        return formApi.setErrorMap({
          onSubmit: { form: 'Impossible d’envoyer le lien pour l’instant. Réessaie.', fields: {} },
        })
      setSent(true)
    },
  })

  return (
    <Frame
      title="Mot de passe oublié"
      onBack={onBack}
      footer={
        sent ? (
          <StepButton label="Revenir à la connexion" kind="ghost" onPress={onBack} />
        ) : (
          <form.AppForm>
            <StepAction>
              <form.SubmitButton label="Recevoir le lien" />
            </StepAction>
          </form.AppForm>
        )
      }
    >
      {sent ? (
        <Banner
          tone="info"
          message="Si un compte existe avec cette adresse, tu vas recevoir un e-mail avec un lien pour choisir un nouveau mot de passe. Pense à regarder tes spams."
        />
      ) : (
        <>
          <Typography>
            Indique l’adresse de ton compte : on t’envoie un lien pour choisir un nouveau mot de
            passe.
          </Typography>
          <form.AppField
            name="email"
            validators={{
              onSubmit: ({ value }) =>
                emailSchema.safeParse(value).success
                  ? undefined
                  : 'Cette adresse e-mail ne semble pas valide. Vérifie-la.',
            }}
          >
            {(field) => (
              <field.Text
                label="Adresse e-mail"
                placeholder="toi@exemple.fr"
                autoFocus
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="send"
                onSubmitEditing={() => void form.handleSubmit()}
              />
            )}
          </form.AppField>
          <form.AppForm>
            <form.FormError />
          </form.AppForm>
        </>
      )}
    </Frame>
  )
}

function BirthStep({
  onBack,
  onDone,
}: {
  onBack: () => void
  /** Renvoie un message d'erreur si le compte n'a pas pu être créé ou complété. */
  onDone: (date: Date) => Promise<string | undefined>
}) {
  const monthRef = useRef<TextInput>(null)
  const yearRef = useRef<TextInput>(null)
  const form = useAppForm({
    defaultValues: { day: '', month: '', year: '' },
    validators: {
      onSubmit: ({ value }) => {
        const date = parseBirthDate(value.day, value.month, value.year)
        return !date || date > new Date()
          ? 'Cette date n’existe pas. Saisis le jour, le mois et l’année, ex. 14 07 2004.'
          : undefined
      },
    },
    onSubmit: async ({ value, formApi }) => {
      const date = parseBirthDate(value.day, value.month, value.year)
      const failure = date ? await onDone(date) : undefined
      if (failure) formApi.setErrorMap({ onSubmit: { form: failure, fields: {} } })
    },
  })

  return (
    <Frame
      title="Ta date de naissance"
      onBack={onBack}
      progress={2}
      footer={
        <form.AppForm>
          <StepAction>
            <form.SubmitButton label="Continuer" />
          </StepAction>
        </form.AppForm>
      }
    >
      <Typography>
        Lucko est ouvert dès {MIN_AGE} ans. Ta date de naissance règle ce que ton compte permet,
        elle n’est jamais affichée.
      </Typography>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <form.AppField name="day">
            {(field) => <field.Digits label="Jour" placeholder="JJ" length={2} next={monthRef} />}
          </form.AppField>
        </View>
        <View style={{ flex: 1 }}>
          <form.AppField name="month">
            {(field) => (
              <field.Digits
                ref={monthRef}
                label="Mois"
                placeholder="MM"
                length={2}
                next={yearRef}
              />
            )}
          </form.AppField>
        </View>
        <View style={{ flex: 1.6 }}>
          <form.AppField name="year">
            {(field) => (
              <field.Digits
                ref={yearRef}
                label="Année"
                placeholder="AAAA"
                length={4}
                onSubmitEditing={() => void form.handleSubmit()}
              />
            )}
          </form.AppField>
        </View>
      </View>
      <form.AppForm>
        <form.FormError />
      </form.AppForm>
    </Frame>
  )
}

const OUTCOMES: Record<
  AgeRegime,
  { title: string; text: string; tone: 'rating' | 'room' | 'venue' }
> = {
  adult: {
    title: 'C’est parti',
    text: 'Il reste tes jeux, ta ville et ton pseudo. Ensuite, tu vois les parties près de chez toi.',
    tone: 'venue',
  },
  minor: {
    title: 'C’est parti',
    text: 'Ton compte est protégé : pas de messages privés d’adultes inconnus, pas de parties à domicile et ta ville exacte reste cachée.',
    tone: 'venue',
  },
  'parental-consent': {
    title: 'Un parent doit valider',
    text: 'Avant 15 ans, la loi demande l’accord d’un parent pour créer ton compte. À l’étape suivante, indique son e-mail : il recevra un lien pour valider.',
    tone: 'rating',
  },
  'too-young': {
    title: `Reviens à ${MIN_AGE} ans`,
    text: `Lucko est réservé aux joueurs de ${MIN_AGE} ans et plus. Aucun compte n’a été créé et ta date de naissance n’est pas conservée.`,
    tone: 'room',
  },
}

function Outcome({ regime, onRestart }: { regime: AgeRegime; onRestart: () => void }) {
  const o = OUTCOMES[regime]
  return (
    <Frame
      title={o.title}
      footer={
        regime === 'too-young' ? (
          <StepButton label="Revenir à l’accueil" kind="ghost" onPress={onRestart} />
        ) : (
          <StepButton
            label="Continuer"
            onPress={() =>
              regime === 'parental-consent' ? router.replace('/parental-consent') : goNext()
            }
          />
        )
      }
    >
      <Note tone={o.tone}>{o.text}</Note>
    </Frame>
  )
}
