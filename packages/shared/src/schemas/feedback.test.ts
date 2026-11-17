import { describe, expect, it } from 'vitest'
import { sendFeedbackSchema, updateFeedbackSchema } from './feedback'

const valid = { category: 'BUG', message: "  L'agenda ne charge pas  ", platform: 'IOS' } as const

describe('sendFeedbackSchema', () => {
  it('nettoie le message et complète le contexte absent', () => {
    expect(sendFeedbackSchema.parse(valid)).toEqual({
      ...valid,
      message: "L'agenda ne charge pas",
      screen: '',
      appVersion: '',
    })
  })

  it('refuse un message trop court ou trop long, une catégorie ou une plateforme inconnue', () => {
    expect(sendFeedbackSchema.safeParse({ ...valid, message: ' ok ' }).success).toBe(false)
    expect(sendFeedbackSchema.safeParse({ ...valid, message: 'a'.repeat(2001) }).success).toBe(
      false,
    )
    expect(sendFeedbackSchema.safeParse({ ...valid, category: 'SPAM' }).success).toBe(false)
    expect(sendFeedbackSchema.safeParse({ ...valid, platform: 'linux' }).success).toBe(false)
  })
})

describe('updateFeedbackSchema', () => {
  it('accepte un statut seul ou une note seule', () => {
    expect(updateFeedbackSchema.parse({ status: 'DONE' })).toEqual({ status: 'DONE' })
    expect(updateFeedbackSchema.parse({ adminNote: ' corrigé en 1.2 ' })).toEqual({
      adminNote: 'corrigé en 1.2',
    })
    expect(updateFeedbackSchema.safeParse({ status: 'CLOSED' }).success).toBe(false)
  })
})
