import { describe, it, expect } from 'vitest'
import { agruparPorDia, type PalpiteJogo } from '../agruparPorDia'

const mk = (numeroJogo: number, dataHora: string): PalpiteJogo => ({
  numeroJogo,
  dataHora,
  casa: 'A',
  fora: 'B',
  bandeiraCasa: null,
  bandeiraFora: null,
  palpiteCasa: 1,
  palpiteFora: 0,
  realCasa: null,
  realFora: null,
  finalizado: false,
  pontos: null,
})

describe('agruparPorDia', () => {
  it('agrupa por dia BRT; dias e jogos do mais recente pro mais antigo', () => {
    const r = agruparPorDia([
      mk(1, '2026-06-14T16:00:00Z'), // 14/06 13:00 BRT
      mk(2, '2026-06-15T19:00:00Z'), // 15/06 16:00 BRT
      mk(3, '2026-06-15T22:00:00Z'), // 15/06 19:00 BRT
    ])
    expect(r.map((g) => g.dia)).toEqual(['2026-06-15', '2026-06-14'])
    expect(r[0]!.jogos.map((j) => j.numeroJogo)).toEqual([3, 2])
  })

  it('usa o fuso BRT pra decidir o dia (jogo de madrugada cai no dia anterior)', () => {
    // 2026-06-15T02:00:00Z = 14/06 23:00 BRT
    const r = agruparPorDia([mk(9, '2026-06-15T02:00:00Z')])
    expect(r[0]!.dia).toBe('2026-06-14')
  })

  it('lista vazia → []', () => {
    expect(agruparPorDia([])).toEqual([])
  })
})
