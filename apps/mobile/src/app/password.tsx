import { Banner, Typography } from '@lucko/design-system'
import { PASSWORD_MIN, passwordSchema } from '@lucko/shared'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { type TextInput, useWindowDimensions } from 'react-native'
import { Frame, StepAction, StepButton, StepLayout, WIDE, Wide } from '@/components/StepFrame'
import { useAppForm } from '@/hooks/formConfig'
import { authClient } from '@/lib/auth'
import { useMeQuery } from '@/queries/useMe'

const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'))

/** Changer de mot de passe depuis les réglages (LKO-138) ; les autres appareils sont déconnectés. */
export default function PasswordScreen() {
  const wide = useWindowDimensions().width >= WIDE
  useMeQuery({ required: true })
  const nextRef = useRef<TextInput>(null)
  const [done, setDone] = useState(false)
  const form = useAppForm({
    defaultValues: { current: '', next: '' },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.changePassword({
        currentPassword: value.current,
        newPassword: value.next,
        revokeOtherSessions: true,
      })
      if (error?.code === 'INVALID_PASSWORD')
        return formApi.setErrorMap({
          onSubmit: { fields: { current: 'Mot de passe actuel incorrect.' } },
        })
      if (error?.code === 'CREDENTIAL_ACCOUNT_NOT_FOUND')
        return formApi.setErrorMap({
          onSubmit: {
            form: 'Tu te connectes avec Apple ou Google : ton compte n’a pas de mot de passe Lucko.',
            fields: {},
          },
        })
      if (error)
        return formApi.setErrorMap({
          onSubmit: { form: 'Impossible de changer ton mot de passe pour l’instant.', fields: {} },
        })
      setDone(true)
    },
  })

  const content = (
    <Frame
      title="Mot de passe"
      onBack={back}
      footer={
        done ? (
          <StepButton label="Revenir aux réglages" onPress={back} />
        ) : (
          <form.AppForm>
            <StepAction>
              <form.SubmitButton label="Changer le mot de passe" />
            </StepAction>
          </form.AppForm>
        )
      }
    >
      {done ? (
        <Banner
          tone="info"
          message="Mot de passe changé. Tes autres appareils ont été déconnectés."
        />
      ) : (
        <>
          <form.AppField
            name="current"
            validators={{
              onSubmit: ({ value }) => (value ? undefined : 'Saisis ton mot de passe actuel.'),
            }}
          >
            {(field) => (
              <field.Text
                label="Mot de passe actuel"
                secureTextEntry
                autoFocus
                autoCapitalize="none"
                autoComplete="current-password"
                returnKeyType="next"
                onSubmitEditing={() => nextRef.current?.focus()}
              />
            )}
          </form.AppField>
          <form.AppField
            name="next"
            validators={{
              onSubmit: ({ value }) => passwordSchema.safeParse(value).error?.issues[0]?.message,
            }}
          >
            {(field) => (
              <field.Text
                ref={nextRef}
                label="Nouveau mot de passe"
                help={`${PASSWORD_MIN} caractères minimum`}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="done"
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

  return (
    <Wide.Provider value={wide}>
      {wide ? (
        <StepLayout
          aside={
            <Typography variant="hero" style={{ maxWidth: 560 }}>
              Ton compte, bien gardé.
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
