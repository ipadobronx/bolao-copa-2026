import { describe, it, expect } from 'vitest'
import { faseDestaque } from '../fase-destaque'
import { MULTIPLICADORES } from '@/lib/pontuacao'

describe('faseDestaque', () => {
  it('retorna null para grupos (1×, sem destaque)', () => {
    expect(faseDestaque('grupos')).toBeNull()
  })

  it('retorna null para as rodadas de grupos (periodoKey grupos_rN)', () => {
    expect(faseDestaque('grupos_r1')).toBeNull()
    expect(faseDestaque('grupos_r2')).toBeNull()
    expect(faseDestaque('grupos_r3')).toBeNull()
  })

  it('retorna null para chave inesperada', () => {
    expect(faseDestaque('foo')).toBeNull()
    expect(faseDestaque('')).toBeNull()
  })

  it('16avos → título, multiplicador 1.5 e label "1.5×"', () => {
    expect(faseDestaque('16avos')).toMatchObject({
      titulo: '16avos de final',
      multiplicador: 1.5,
      multiplicadorLabel: '1.5×',
    })
  })

  it('oitavas → 2× ', () => {
    expect(faseDestaque('oitavas')).toMatchObject({
      titulo: 'Oitavas de final',
      multiplicador: 2,
      multiplicadorLabel: '2×',
    })
  })

  it('quartas → 2.5×', () => {
    expect(faseDestaque('quartas')).toMatchObject({
      titulo: 'Quartas de final',
      multiplicador: 2.5,
      multiplicadorLabel: '2.5×',
    })
  })

  it('semis → 3×', () => {
    expect(faseDestaque('semis')).toMatchObject({
      titulo: 'Semifinais',
      multiplicador: 3,
      multiplicadorLabel: '3×',
    })
  })

  it('disputa_terceiro → 2×', () => {
    expect(faseDestaque('disputa_terceiro')).toMatchObject({
      multiplicador: 2,
      multiplicadorLabel: '2×',
    })
  })

  it('final → 4×', () => {
    expect(faseDestaque('final')).toMatchObject({
      titulo: 'Final',
      multiplicador: 4,
      multiplicadorLabel: '4×',
    })
  })

  it('o multiplicador vem de MULTIPLICADORES (fonte única)', () => {
    for (const fase of ['16avos', 'oitavas', 'quartas', 'semis', 'disputa_terceiro', 'final'] as const) {
      expect(faseDestaque(fase)?.multiplicador).toBe(MULTIPLICADORES[fase])
    }
  })

  it('inclui um gradient não-vazio para mata-mata', () => {
    expect(faseDestaque('16avos')?.gradient).toBeTruthy()
    expect(typeof faseDestaque('final')?.gradient).toBe('string')
  })
})
