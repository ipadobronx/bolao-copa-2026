import { describe, it, expect } from 'vitest'
import { abaInicial } from '@/lib/palpites'

describe('abaInicial', () => {
  it('jogo-alvo manda: usa a fase do jogo', () => {
    expect(abaInicial('grupos', null)).toBe('grupos')
    expect(abaInicial('16avos', 'bonus')).toBe('16avos')
    expect(abaInicial('final', null)).toBe('final')
    expect(abaInicial('disputa_terceiro', null)).toBe('disputa_terceiro')
  })
  it('sem alvo: respeita ?tab=bonus, senão grupos', () => {
    expect(abaInicial(null, 'bonus')).toBe('bonus')
    expect(abaInicial(null, null)).toBe('grupos')
    expect(abaInicial(null, 'qualquer')).toBe('grupos')
  })
})
