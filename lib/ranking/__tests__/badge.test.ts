import { describe, it, expect } from 'vitest'
import { emojiDoResultado } from '../badge'

describe('emojiDoResultado', () => {
  it('mapeia cada classe do último jogo', () => {
    expect(emojiDoResultado('exato', 0)).toBe('🔥')
    expect(emojiDoResultado('vencedor_saldo', 0)).toBe('👍')
    expect(emojiDoResultado('vencedor', 0)).toBe('😭')
    expect(emojiDoResultado('parcial', 0)).toBe('😭')
    expect(emojiDoResultado('erro', 0)).toBe('🦄')
  })
  it('sem palpite no último jogo (classe null) = 🦄', () => {
    expect(emojiDoResultado(null, 0)).toBe('🦄')
  })
  it('💎 quando somou ≥25 no dia, sobrepondo a classe', () => {
    expect(emojiDoResultado('erro', 25)).toBe('💎')
    expect(emojiDoResultado(null, 30)).toBe('💎')
    expect(emojiDoResultado('exato', 24)).toBe('🔥')
  })
})
