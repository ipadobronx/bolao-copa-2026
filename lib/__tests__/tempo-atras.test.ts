import { describe, it, expect } from 'vitest'
import { tempoAtras } from '@/lib/format/tempo-atras'

function t(segundosAtras: number) {
  const agora = new Date('2026-06-01T12:00:00Z')
  const data = new Date(agora.getTime() - segundosAtras * 1000)
  return tempoAtras(data, agora)
}

describe('tempoAtras', () => {
  it('retorna "agora" para menos de 60s', () => {
    expect(t(30)).toBe('agora')
    expect(t(59)).toBe('agora')
  })

  it('retorna minutos para 1-59 minutos', () => {
    expect(t(60)).toBe('1 min')
    expect(t(120)).toBe('2 min')
    expect(t(59 * 60)).toBe('59 min')
  })

  it('retorna horas para 1-23h', () => {
    expect(t(3600)).toBe('1h')
    expect(t(3 * 3600)).toBe('3h')
    expect(t(23 * 3600)).toBe('23h')
  })

  it('retorna "1 dia" para exatamente 24h', () => {
    expect(t(24 * 3600)).toBe('1 dia')
  })

  it('retorna dias plural para > 1 dia', () => {
    expect(t(48 * 3600)).toBe('2 dias')
    expect(t(7 * 24 * 3600)).toBe('7 dias')
  })

  it('aceita string de data', () => {
    const agora = new Date('2026-06-01T12:00:00Z')
    expect(tempoAtras('2026-06-01T11:58:00Z', agora)).toBe('2 min')
  })

  it('data no futuro retorna "agora"', () => {
    const agora = new Date('2026-06-01T12:00:00Z')
    expect(tempoAtras('2026-06-01T13:00:00Z', agora)).toBe('agora')
  })
})
