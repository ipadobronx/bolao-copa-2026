import { describe, it, expect } from 'vitest'
import { resumoPalpites } from './resumo-jogo'

describe('resumoPalpites', () => {
  it('conta tendência casa/empate/fora e top 3 placares', () => {
    const r = resumoPalpites([
      { gols_casa: 1, gols_fora: 0 },
      { gols_casa: 1, gols_fora: 0 },
      { gols_casa: 2, gols_fora: 0 },
      { gols_casa: 1, gols_fora: 1 },
      { gols_casa: 0, gols_fora: 2 },
    ])
    expect(r.total).toBe(5)
    expect(r.tendencia).toEqual({ casa: 3, empate: 1, fora: 1 })
    expect(r.topPlacares[0]).toEqual({ gc: 1, gf: 0, count: 2 })
    expect(r.topPlacares.length).toBe(3)
  })

  it('desempate determinístico: count desc, depois gc desc, gf desc', () => {
    const r = resumoPalpites([
      { gols_casa: 0, gols_fora: 0 },
      { gols_casa: 2, gols_fora: 1 },
    ])
    expect(r.topPlacares.map((p) => `${p.gc}x${p.gf}`)).toEqual(['2x1', '0x0'])
  })

  it('lista vazia', () => {
    expect(resumoPalpites([])).toEqual({
      total: 0,
      tendencia: { casa: 0, empate: 0, fora: 0 },
      topPlacares: [],
    })
  })
})
