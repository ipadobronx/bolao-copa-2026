import { describe, it, expect } from 'vitest'
import { countdownState, formatCountdown, URGENT_THRESHOLD_MS } from '../countdown'

describe('countdownState', () => {
  it('passado (<= 0) → closed', () => {
    expect(countdownState(0)).toBe('closed')
    expect(countdownState(-1000)).toBe('closed')
  })

  it('dentro de 24h → urgent', () => {
    expect(countdownState(8 * 3600 * 1000)).toBe('urgent')
    expect(countdownState(1000)).toBe('urgent')
  })

  it('exatamente 24h → urgent (limite inclusivo)', () => {
    expect(countdownState(URGENT_THRESHOLD_MS)).toBe('urgent')
  })

  it('mais de 24h → normal', () => {
    expect(countdownState(URGENT_THRESHOLD_MS + 1)).toBe('normal')
    expect(countdownState(48 * 3600 * 1000)).toBe('normal')
  })
})

describe('formatCountdown', () => {
  it('formata h/m/s com zero-pad', () => {
    expect(formatCountdown(8 * 3600 * 1000 + 5 * 60 * 1000 + 3 * 1000)).toEqual({
      h: '08',
      m: '05',
      s: '03',
    })
  })

  it('clampa negativo para 00:00:00', () => {
    expect(formatCountdown(-5000)).toEqual({ h: '00', m: '00', s: '00' })
  })

  it('horas acima de 99 não truncam', () => {
    expect(formatCountdown(100 * 3600 * 1000).h).toBe('100')
  })
})
