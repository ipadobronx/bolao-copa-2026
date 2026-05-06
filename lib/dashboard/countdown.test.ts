import { describe, it, expect } from 'vitest'
import { formatDiasHoras } from './countdown'

describe('formatDiasHoras', () => {
  it('retorna 0/0 quando datas iguais', () => {
    const d = new Date('2026-06-11T00:00:00Z')
    expect(formatDiasHoras(d, d)).toEqual({ dias: 0, horas: 0 })
  })

  it('retorna 0/1 pra 1 hora de diferença', () => {
    const de = new Date('2026-06-11T00:00:00Z')
    const ate = new Date('2026-06-11T01:00:00Z')
    expect(formatDiasHoras(de, ate)).toEqual({ dias: 0, horas: 1 })
  })

  it('retorna 30/0 pra 30 dias exatos', () => {
    const de = new Date('2026-05-12T00:00:00Z')
    const ate = new Date('2026-06-11T00:00:00Z')
    expect(formatDiasHoras(de, ate)).toEqual({ dias: 30, horas: 0 })
  })

  it('arredonda pra baixo na contagem de horas (5 dias 12h)', () => {
    const de = new Date('2026-06-06T12:00:00Z')
    const ate = new Date('2026-06-12T00:00:00Z')
    expect(formatDiasHoras(de, ate)).toEqual({ dias: 5, horas: 12 })
  })

  it('retorna 0/0 quando ate < de (data passada)', () => {
    const de = new Date('2026-06-12T00:00:00Z')
    const ate = new Date('2026-06-11T00:00:00Z')
    expect(formatDiasHoras(de, ate)).toEqual({ dias: 0, horas: 0 })
  })
})
