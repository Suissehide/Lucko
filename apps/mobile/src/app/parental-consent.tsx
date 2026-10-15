import { Banner, Button, Note, Typography } from '@lucko/design-system'
import { emailSchema, formatLongDay } from '@lucko/shared'
import { router } from 'expo-router'
import { type ReactNode, useEffect, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { Frame, StepAction, StepLayout, WIDE, Wide } from '@/components/StepFrame'
import { useAppForm } from '@/hooks/formConfig'
import { ApiError, queryClient } from '@/lib/queryClient'
import { meQueryOptions, signOut, useMeQuery } from '@/queries/useMe'
import {
  useMyParentalConsentQuery,
  useRequestParentalConsentMutation,
} from '@/queries/useParentalConsent'

/**
 * Accord parental des 13-14 ans (A7, LKO-49), côté enfant : e-mail du parent, puis attente.
 * Le compte reste en lecture seule jusqu'à l'accord ; l'écran s'ouvre sur l'accueil dès qu'il arrive.
 */
export default function ParentalConsentScreen() {
  const { width } = useWindowDimensions()
  const wide = width >= WIDE
  useMeQuery({ required: true })
  const { data: consent } = useMyParentalConsentQuery()
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!consent?.granted) return
    void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
    router.replace('/')
  }, [consent?.granted])

  let content: ReactNode = null
  if (consent?.parentEmail && !editing)
    content = (
      <Waiting
        parentEmail={consent.parentEmail}
        deadline={consent.deadline}
        onEdit={() => setEditing(true)}
      />
    )
  else if (consent)
    content = (
      <ParentEmailStep
        defaultEmail={consent.parentEmail ?? ''}
        deadline={consent.deadline}
        onBack={consent.parentEmail ? () => setEditing(false) : undefined}
        onSent={() => setEditing(false)}
      />
    )

  return (
    <Wide.Provider value={wide}>
      {wide ? (
        <StepLayout
          aside={
            <Typography variant="hero" style={{ maxWidth: 560 }}>
              Encore une étape avec un parent.
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

function ParentEmailStep({
  defaultEmail,
  deadline,
  onBack,
  onSent,
}: {
  defaultEmail: string
  deadline: string
  onBack?: () => void
  onSent: () => void
}) {
  const send = useRequestParentalConsentMutation()
  const form = useAppForm({
    defaultValues: { email: defaultEmail },
    onSubmit: async ({ value, formApi }) => {
      const error = await send
        .mutateAsync(emailSchema.parse(value.email))
        .then(() => null)
        .catch((e: unknown) => e)
      if (!error) return onSent()
      formApi.setErrorMap({
        onSubmit: {
          fields: {
            email:
              error instanceof ApiError
                ? error.message
                : 'Impossible d’envoyer l’e-mail pour l’instant. Réessaie.',
          },
        },
      })
    },
  })

  return (
    <Frame
      title="L’e-mail d’un parent"
      onBack={onBack}
      footer={
        <form.AppForm>
          <StepAction>
            <form.SubmitButton label="Envoyer la demande" />
          </StepAction>
        </form.AppForm>
      }
    >
      <Typography>
        Avant 15 ans, la loi demande l’accord d’un parent. Il ou elle recevra un e-mail avec un lien
        pour valider ton compte.
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
            label="E-mail de ton parent"
            placeholder="parent@exemple.fr"
            autoFocus
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="send"
            onSubmitEditing={() => void form.handleSubmit()}
          />
        )}
      </form.AppField>
      <Note>
        Sans accord avant le {formatLongDay(deadline)}, ton compte et tes données seront supprimés.
      </Note>
    </Frame>
  )
}

function Waiting({
  parentEmail,
  deadline,
  onEdit,
}: {
  parentEmail: string
  deadline: string
  onEdit: () => void
}) {
  const resend = useRequestParentalConsentMutation()
  return (
    <Frame
      title="En attente de ton parent"
      footer={
        <View style={{ gap: 10 }}>
          <StepAction>
            <Button
              label="Renvoyer l’e-mail"
              disabled={resend.isPending}
              onPress={() => resend.mutate(parentEmail)}
            />
          </StepAction>
          <StepAction>
            <Button label="Changer d’e-mail" kind="ghost" onPress={onEdit} />
          </StepAction>
          <StepAction>
            <Button label="Me déconnecter" kind="ghost" onPress={() => void signOut()} />
          </StepAction>
        </View>
      }
    >
      {resend.isSuccess ? <Banner tone="ok" message="E-mail renvoyé." /> : null}
      {resend.isError ? <Banner message={resend.error.message} /> : null}
      <Typography>
        On a envoyé un e-mail à {parentEmail}. Dès qu’il ou elle valide, ton compte s’ouvre ici.
      </Typography>
      <Note>
        Sans accord avant le {formatLongDay(deadline)}, ton compte et tes données seront supprimés.
      </Note>
    </Frame>
  )
}
