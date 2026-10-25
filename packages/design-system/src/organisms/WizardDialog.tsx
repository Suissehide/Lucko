import { ArrowLeft, X } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Button, type ButtonKind } from '../atoms/Button'
import { IconButton } from '../atoms/IconButton'
import { ProgressSteps } from '../atoms/ProgressSteps'
import { Raised } from '../atoms/Raised'
import { border, colors, font, shadow } from '../tokens'

export type WizardAction = {
  label: string
  kind: ButtonKind
  disabled?: boolean
  onPress: () => void
}

/**
 * Parcours en étapes (créer une room). `wide` : popup centrée sur un voile, étapes libellées,
 * colonne `aside` à droite, pied « Retour » · motif de blocage · action. Sinon plein écran :
 * ✕ puis ←, titre de l'étape, « n / total », pied à bouton pleine largeur.
 * `done` : contenu final sans pied ni étape (« Room créée »).
 */
export function WizardDialog({
  wide,
  title,
  steps,
  stepTitles,
  step,
  done,
  doneTitle,
  blocker,
  action,
  aside,
  insets = { top: 0, bottom: 0 },
  onStep,
  onBack,
  onClose,
  children,
}: {
  wide: boolean
  /** Titre de la popup (grand format). */
  title: string
  /** Libellés courts des étapes (« Le jeu »). */
  steps: string[]
  /** Titres des étapes sur téléphone (« Quel jeu ? »). */
  stepTitles: string[]
  step: number
  done?: boolean
  doneTitle?: string
  blocker?: string | null
  action: WizardAction
  aside?: ReactNode
  /** Marges de sécurité du téléphone (react-native-safe-area-context). */
  insets?: { top: number; bottom: number }
  onStep: (index: number) => void
  onBack: () => void
  onClose: () => void
  children: ReactNode
}) {
  const progress = done ? steps.length : step + 1
  const icon = (Icon: typeof X) => <Icon size={18} color={colors.ink} strokeWidth={2.5} />

  if (!wide) {
    const first = step === 0 || done
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, paddingTop: insets.top }}>
        <View
          style={{
            paddingTop: 6,
            paddingBottom: 12,
            paddingHorizontal: 20,
            gap: 12,
            borderBottomWidth: border.thin,
            borderColor: colors.line,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconButton
              label={first ? 'Fermer' : 'Étape précédente'}
              icon={icon(first ? X : ArrowLeft)}
              onPress={first ? onClose : onBack}
            />
            <Text
              role="heading"
              style={{
                flex: 1,
                ...font('display'),
                fontSize: 20,
                lineHeight: 21,
                textTransform: 'uppercase',
                color: colors.ink,
              }}
            >
              {done ? (doneTitle ?? title) : stepTitles[step]}
            </Text>
            {done ? null : (
              <Text style={{ ...font('mono', 700), fontSize: 12, color: colors.ink }}>
                {`${step + 1} / ${steps.length}`}
              </Text>
            )}
          </View>
          <ProgressSteps current={progress} total={steps.length} />
        </View>
        {/* Une étape par clé : chaque étape repart en haut, sans garder le défilement de la précédente (LKO-130) */}
        <ScrollView
          key={step}
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingVertical: 16,
            paddingHorizontal: 20,
            gap: 18,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        {done ? null : (
          <View
            style={{
              paddingTop: 12,
              paddingHorizontal: 20,
              paddingBottom: Math.max(insets.bottom, 12) + 8,
              gap: 6,
              backgroundColor: colors.white,
              borderTopWidth: border.base,
              borderColor: colors.ink,
            }}
          >
            {blocker ? <Blocker text={blocker} center /> : null}
            <Button {...action} />
          </View>
        )}
      </View>
    )
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.scrim,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Raised
        offset={shadow.xl}
        r={20}
        style={{ width: '100%', maxWidth: 1040, height: '100%', maxHeight: 820 }}
      >
        <View
          role="dialog"
          aria-modal
          aria-label={title}
          style={{
            flex: 1,
            flexDirection: 'row',
            backgroundColor: colors.cream,
            borderWidth: border.base,
            borderColor: colors.ink,
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{
                paddingTop: 22,
                paddingBottom: 16,
                paddingHorizontal: 28,
                gap: 14,
                borderBottomWidth: border.thin,
                borderColor: colors.line,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text
                  role="heading"
                  style={{
                    ...font('display'),
                    fontSize: 28,
                    lineHeight: 29,
                    textTransform: 'uppercase',
                    color: colors.ink,
                  }}
                >
                  {title}
                </Text>
                <IconButton label="Fermer" icon={icon(X)} onPress={onClose} />
              </View>
              <ProgressSteps
                current={progress}
                total={steps.length}
                labels={steps}
                onStep={done ? undefined : onStep}
              />
            </View>
            <ScrollView
              key={step}
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                paddingVertical: 22,
                paddingHorizontal: 28,
                gap: 22,
              }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            {done ? null : (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 28,
                  backgroundColor: colors.white,
                  borderTopWidth: border.base,
                  borderColor: colors.ink,
                }}
              >
                <View style={{ opacity: step ? 1 : 0 }} pointerEvents={step ? 'auto' : 'none'}>
                  <Button small kind="ghost" label="Retour" onPress={onBack} />
                </View>
                <View style={{ flex: 1 }}>{blocker ? <Blocker text={blocker} /> : null}</View>
                <Button {...action} />
              </View>
            )}
          </View>
          {aside ? (
            <View
              style={{
                width: 340,
                padding: 22,
                gap: 16,
                backgroundColor: colors.creamDark,
                borderLeftWidth: border.base,
                borderColor: colors.ink,
              }}
            >
              {aside}
            </View>
          ) : null}
        </View>
      </Raised>
    </View>
  )
}

function Blocker({ text, center }: { text: string; center?: boolean }) {
  return (
    <Text
      role="alert"
      style={{
        ...font('body', 500),
        fontSize: center ? 12 : 13,
        color: colors.muted,
        textAlign: center ? 'center' : 'right',
      }}
    >
      {text}
    </Text>
  )
}
