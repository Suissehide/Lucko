import {
  Banner,
  Button,
  Checkbox,
  CONTACT_EMAIL,
  InlineLink,
  Note,
  SITE_URL,
  Typography,
} from '@lucko/design-system'
import { formatLongDay } from '@lucko/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { type ReactNode, useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { Frame, StepAction, StepLayout, WIDE, Wide } from '@/components/StepFrame'
import { openHome } from '@/lib/navigation'
import { queryClient } from '@/lib/queryClient'
import { meQueryOptions, useMeQuery } from '@/queries/useMe'
import {
  useGrantParentalConsentMutation,
  useParentalConsentRequestQuery,
} from '@/queries/useParentalConsent'

const DATA = [
  'Son e-mail et sa date de naissance, pour son compte et les règles liées à son âge.',
  'Son pseudo, sa photo (vérifiée avant d’être visible), sa ville et ses jeux : jamais sa ville exacte pour les autres joueurs.',
  'Les parties qu’il ou elle rejoint, sa présence et ses points d’expérience.',
  'Les messages du chat des parties auxquelles il ou elle participe.',
]

const PROTECTIONS = [
  'Pas de messages privés avec des adultes inconnus.',
  'Pas de parties à domicile, ni de parties réservées aux adultes, sauf avec vous.',
  'Pas de notifications la nuit.',
]

/**
 * Accord parental (LKO-49), côté parent : ouvert depuis le lien de l'e-mail. Le parent lit ce que
 * Lucko traite, se connecte ou crée son compte (majeur), puis valide : son compte est lié à l'enfant.
 */
export default function ConsentScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const { width } = useWindowDimensions()
  const wide = width >= WIDE
  const request = useParentalConsentRequestQuery(token)
  const me = useMeQuery()
  const grant = useGrantParentalConsentMutation(token)
  const [checked, setChecked] = useState(false)

  // Le profil gardé en cache peut être celui de l'enfant, sur le même appareil : on revérifie la session
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
  }, [])

  let content: ReactNode = null
  if (request.isError)
    content = (
      <Frame title="Lien plus valable" footer={<Home />}>
        <Note tone="room">{request.error.message}</Note>
      </Frame>
    )
  else if (request.data?.status === 'GRANTED' || grant.isSuccess)
    content = (
      <Frame title="Accord enregistré" footer={<Home />}>
        <Note tone="venue">
          Merci : le compte de votre enfant est activé et lié au vôtre. Il ou elle peut maintenant
          jouer sur Lucko.
        </Note>
      </Frame>
    )
  else if (request.data) {
    const { childEmail, parentEmail, childAge, deadline } = request.data
    // L'accord se donne avec le compte de l'adresse qui a reçu le lien (LKO-154)
    const otherAccount =
      !!me?.email && me.email.trim().toLowerCase() !== parentEmail.trim().toLowerCase()
    content = (
      <Frame
        title="Accord parental"
        footer={
          <View style={{ gap: 10 }}>
            {grant.isError ? <Banner message={grant.error.message} /> : null}
            <StepAction>
              {me ? (
                <Button
                  label="Donner mon accord"
                  disabled={!checked || grant.isPending || otherAccount}
                  onPress={() => grant.mutate()}
                />
              ) : (
                <Button
                  label="Me connecter pour donner mon accord"
                  disabled={!checked}
                  onPress={() =>
                    router.push({ pathname: '/auth', params: { next: `/consent/${token}` } })
                  }
                />
              )}
            </StepAction>
          </View>
        }
      >
        <Typography>
          Le compte {childEmail} ({childAge} ans) attend votre accord pour utiliser Lucko, une app
          pour trouver où jouer à des jeux de société et de cartes près de chez soi.
        </Typography>
        <List title="Ce que Lucko traite" items={DATA} />
        <List title="Ses protections" items={PROTECTIONS} />
        <Typography variant="small">
          Détail et durées de conservation dans la{' '}
          <InlineLink href={`${SITE_URL}/privacy`}>politique de confidentialité</InlineLink>. Vous
          suivrez son activité et pourrez retirer votre accord à tout moment depuis Réglages, Mes
          enfants. Questions : {CONTACT_EMAIL}.
        </Typography>
        {otherAccount ? (
          <Note tone="room">
            Vous êtes connecté avec {me?.email}. Connectez-vous (ou créez votre compte) avec{' '}
            {parentEmail}, l’adresse qui a reçu ce lien, pour donner votre accord.
          </Note>
        ) : null}
        <Note>
          {me
            ? 'Votre compte Lucko sera lié au sien.'
            : `Il vous faut un compte Lucko avec l’adresse ${parentEmail}, celle qui a reçu ce lien : il sera lié au sien.`}{' '}
          Sans accord avant le {formatLongDay(deadline)}, son compte sera supprimé.
        </Note>
        <Checkbox
          value={checked}
          onChange={setChecked}
          label="Je suis son parent ou responsable légal et j’accepte qu’il ou elle utilise Lucko."
        />
      </Frame>
    )
  }

  return (
    <Wide.Provider value={wide}>
      {wide ? (
        <StepLayout
          aside={
            <Typography variant="hero" style={{ maxWidth: 560 }}>
              Votre enfant veut rejoindre Lucko.
            </Typography>
          }
        >
          {content}
        </StepLayout>
      ) : (
        content
      )}
    </Wide.Provider>
  )
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={{ gap: 6 }}>
      <Typography variant="title">{title}</Typography>
      {items.map((item) => (
        <Typography key={item}>· {item}</Typography>
      ))}
    </View>
  )
}

function Home() {
  return (
    <StepAction>
      <Button label="Aller à l’accueil" kind="ghost" onPress={openHome} />
    </StepAction>
  )
}
