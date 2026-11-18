import { Banner, Typography } from '@lucko/design-system'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_MESSAGE_MAX,
  type FeedbackCategory,
  type FeedbackPlatform,
  sendFeedbackSchema,
} from '@lucko/shared'
import Constants from 'expo-constants'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Platform, useWindowDimensions } from 'react-native'
import { Frame, StepAction, StepButton, StepLayout, WIDE, Wide } from '@/components/StepFrame'
import { useAppForm } from '@/hooks/formConfig'
import { ApiError } from '@/lib/queryClient'
import { useFeedbackMutations } from '@/queries/useFeedback'
import { useMeQuery } from '@/queries/useMe'

const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'))

const PLATFORM: FeedbackPlatform =
  Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB'

const CATEGORY_OPTIONS = FEEDBACK_CATEGORIES.map((key) => ({
  key,
  label: FEEDBACK_CATEGORY_LABELS[key],
}))

const PLACEHOLDERS: Record<FeedbackCategory, string> = {
  BUG: 'Ce que tu faisais, ce qui s’est passé, ce que tu attendais…',
  IDEA: 'Ce qui te manque, ce qui te simplifierait la vie…',
  OTHER: 'Dis-nous tout…',
}

/**
 * Envoyer un retour à l'équipe (LKO-166) : catégorie et message ; l'écran d'origine, la version de
 * l'app et la plateforme sont joints sans rien demander. Lu dans le back-office (/admin/feedback).
 */
export default function FeedbackScreen() {
  const wide = useWindowDimensions().width >= WIDE
  useMeQuery({ required: true })
  const { from } = useLocalSearchParams<{ from?: string }>()
  const { send } = useFeedbackMutations()
  const [done, setDone] = useState(false)
  const form = useAppForm({
    defaultValues: { category: 'BUG' as FeedbackCategory, message: '' },
    onSubmit: async ({ value, formApi }) => {
      try {
        await send.mutateAsync({
          ...value,
          screen: from ?? '',
          appVersion: Constants.expoConfig?.version ?? '',
          platform: PLATFORM,
        })
        setDone(true)
      } catch (error) {
        formApi.setErrorMap({
          onSubmit: {
            form:
              error instanceof ApiError
                ? error.message
                : 'Impossible d’envoyer ton retour pour l’instant.',
            fields: {},
          },
        })
      }
    },
  })

  const content = (
    <Frame
      title="Envoyer un retour"
      onBack={back}
      footer={
        done ? (
          <StepButton label="Revenir" onPress={back} />
        ) : (
          <form.AppForm>
            <StepAction>
              <form.SubmitButton label="Envoyer" />
            </StepAction>
          </form.AppForm>
        )
      }
    >
      {done ? (
        <Banner tone="info" message="Merci ! Ton retour est bien arrivé chez l’équipe Lucko." />
      ) : (
        <>
          <Typography variant="small">
            Un bug, une idée, quelque chose qui coince ? L’équipe lit chaque retour.
          </Typography>
          <form.AppField name="category">
            {(field) => <field.Choice label="C’est plutôt…" options={CATEGORY_OPTIONS} />}
          </form.AppField>
          <form.Subscribe selector={(s) => s.values.category}>
            {(category) => (
              <form.AppField
                name="message"
                validators={{ onSubmit: sendFeedbackSchema.shape.message }}
              >
                {(field) => (
                  <field.Text
                    label="Ton message"
                    placeholder={PLACEHOLDERS[category]}
                    multiline
                    autoFocus
                    maxLength={FEEDBACK_MESSAGE_MAX}
                  />
                )}
              </form.AppField>
            )}
          </form.Subscribe>
          <Typography variant="small">
            On joint la version de l’app et l’écran d’où tu écris, pour retrouver le problème.
          </Typography>
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
              Lucko se construit avec toi.
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
