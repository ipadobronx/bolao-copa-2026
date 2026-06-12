import { describe, it, expect } from 'vitest'
import { tituloDesempenho } from '../titulo'

describe('tituloDesempenho', () => {
  it('top 10% = Bruxo', () => {
    expect(tituloDesempenho(1, 100)).toEqual({ emoji: '🧙', label: 'Bruxo' })
    expect(tituloDesempenho(10, 100)).toEqual({ emoji: '🧙', label: 'Bruxo' })
  })
  it('top 33% = Embalado', () => {
    expect(tituloDesempenho(20, 100)).toEqual({ emoji: '🔥', label: 'Embalado' })
  })
  it('meio = Na média', () => {
    expect(tituloDesempenho(50, 100)).toEqual({ emoji: '😎', label: 'Na média' })
  })
  it('fundo 33% = Pé-frio', () => {
    expect(tituloDesempenho(80, 100)).toEqual({ emoji: '🥶', label: 'Pé-frio' })
  })
  it('fundo 10% = Chutador', () => {
    expect(tituloDesempenho(95, 100)).toEqual({ emoji: '🤡', label: 'Chutador' })
  })
  it('total inválido = Na média', () => {
    expect(tituloDesempenho(1, 0)).toEqual({ emoji: '😎', label: 'Na média' })
  })
})
