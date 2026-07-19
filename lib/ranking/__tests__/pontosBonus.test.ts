import { describe, it, expect } from 'vitest'
import { pontosBonusExibicao } from '../pontosBonus'

const oficial = {
  campeao_id: 1,
  vice_id: 2,
  terceiro_id: 3,
  quarto_id: 4,
  artilheiro_nome: 'Kylian Mbappé',
  revelacao_id: null,
}

describe('pontosBonusExibicao', () => {
  it('retorna os pontos quando o resultado oficial do tipo está definido', () => {
    expect(pontosBonusExibicao('campeao', 50, oficial)).toBe(50)
    expect(pontosBonusExibicao('vice', 0, oficial)).toBe(0)
    expect(pontosBonusExibicao('artilheiro', 25, oficial)).toBe(25)
  })

  it('trata pontos_calculados null como 0 quando o resultado está definido', () => {
    expect(pontosBonusExibicao('quarto', null, oficial)).toBe(0)
  })

  it('retorna null quando o resultado oficial do tipo ainda não saiu', () => {
    expect(pontosBonusExibicao('revelacao', 0, oficial)).toBeNull()
    expect(pontosBonusExibicao('revelacao', null, oficial)).toBeNull()
  })

  it('retorna null quando copa_resultados não existe', () => {
    expect(pontosBonusExibicao('campeao', 50, null)).toBeNull()
  })
})
