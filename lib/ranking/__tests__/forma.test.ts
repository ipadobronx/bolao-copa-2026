import { describe, it, expect } from 'vitest'
import { corDaForma } from '../forma'

describe('corDaForma', () => {
  it('placar exato = verde', () => {
    expect(corDaForma('exato')).toBe('verde')
  })
  it('acertou o vencedor (com/sem saldo) = cinza', () => {
    expect(corDaForma('vencedor')).toBe('cinza')
    expect(corDaForma('vencedor_saldo')).toBe('cinza')
  })
  it('errou ou parcial (0 ou 2 pts) = vermelho', () => {
    expect(corDaForma('parcial')).toBe('vermelho')
    expect(corDaForma('erro')).toBe('vermelho')
  })
  it('sem palpite (null) = vazio', () => {
    expect(corDaForma(null)).toBe('vazio')
  })
})
