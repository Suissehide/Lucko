import { Banner, Typography } from '@lucko/design-system'
import { PASSWORD_MIN, passwordSchema } from '@lucko/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { Frame, StepAction, StepButton, StepLayout, WIDE, Wide } from '@/components/StepFrame'
import { useAppForm } from '@/hooks/formConfig'
import { authClient } from '@/lib/auth'

const toLogin = () => router.replace('/auth')

/**
 * Nouveau mot de passe (LKO-138), ouvert par le lien de l'e-mail « Mot de passe oublié » : Better Auth
 * renvoie ici avec `?token=…`, ou `?error=INVALID_TOKEN` si le lien a expiré ou a déjà servi.
 */
export default function ResetPasswordScreen() {
  const wide = useWindowDimensions().width >= WIDE
  const { token, error } = useLocalSearchParams<{ token?: string; error?: string }>()
  const [done, setDone] = useState(false)
  const form = useAppForm({
    defaultValues: { password: '' },
    onSubmit: async ({ value, formApi }) => {
      const { error: failed } = await authClient.resetPassword({
        newPassword: value.password,
        token: token ?? '',
      })
      if (failed)
        return formApi.setErrorMap({
          onSubmit: {
            form: 'Ce lien a expiré ou a déjà servi. Redemande un lien depuis la connexion.',
            fields: {},
          },
        })
      setDone(true)
    },
  })

  const invalid = !!error || !token
  const content = (
    <Frame
      title="Nouveau mot de passe"
      footer={
        done || invalid ? (
          <StepButton label="Aller à la connexion" onPress={toLogin} />
        ) : (
          <form.AppForm>
            <StepAction>
              <form.SubmitButton label="Enregistrer" />
            </StepAction>
          </form.AppForm>
        )
      }
    >
      {done ? (
        <Banner
          tone="info"
          message="C’est fait : connecte-toi avec ton nouveau mot de passe. Tes autres appareils ont été déconnectés."
        />
      ) : invalid ? (
        <Banner
          tone="err"
          message="Ce lien a expiré ou a déjà servi. Redemande un lien depuis « Mot de passe oublié »."
        />
      ) : (
        <>
          <Typography>Choisis le nouveau mot de passe de ton compte Lucko.</Typography>
          <form.AppField
            name="password"
            validators={{
              onSubmit: ({ value }) => passwordSchema.safeParse(value).error?.issues[0]?.message,
            }}
          >
            {(field) => (
              <field.Text
                label="Nouveau mot de passe"
                help={`${PASSWORD_MIN} caractères minimum`}
                secureTextEntry
                autoFocus
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
              Un nouveau mot de passe, et on retourne jouer.
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
