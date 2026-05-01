import { describe, expect, it } from 'vitest'
import { determinarPeriodoAtual, type JogoParaPeriodo } from '../ranking'

function jogo(overrides: Partial<JogoParaPeriodo> & { id: number }): JogoParaPeriodo {
  return {
    fase: 'grupos',
    data_hora: new Date().toISOString(),
    finalizado: false,
    ...overrides,
  }
}

describe('determinarPeriodoAtual', () => {
  it('retorna null quando lista vazia', () => {
    expect(determinarPeriodoAtual([])).toBeNull()
  })

  it('fase grupos, nenhum jogo finalizado → periodoKey grupos_r1', () => {
    const jogos: JogoParaPeriodo[] = [
      jogo({ id: 1, fase: 'grupos', data_hora: '2026-06-11T19:00:00Z', finalizado: false }),
      jogo({ id: 2, fase: 'grupos', data_hora: '2026-06-12T19:00:00Z', finalizado: false }),
    ]
    const result = determinarPeriodoAtual(jogos)
    expect(result?.periodoKey).toBe('grupos_r1')
  })

  it('fase grupos, 1/3 das rodadas finalizadas → periodoKey grupos_r1', () => {
    const jogos: JogoParaPeriodo[] = [
      jogo({ id: 1, fase: 'grupos', data_hora: '2026-06-11T19:00:00Z', finalizado: true }),
      jogo({ id: 2, fase: 'grupos', data_hora: '2026-06-14T19:00:00Z', finalizado: false }),
      jogo({ id: 3, fase: 'grupos', data_hora: '2026-06-18T19:00:00Z', finalizado: false }),
    ]
    const result = determinarPeriodoAtual(jogos)
    expect(result?.periodoKey).toBe('grupos_r1')
  })

  it('fase oitavas → periodoKey oitavas, label "Oitavas de final"', () => {
    const jogos: JogoParaPeriodo[] = [
      jogo({ id: 1, fase: 'grupos', data_hora: '2026-06-11T19:00:00Z', finalizado: true }),
      jogo({ id: 2, fase: 'oitavas', data_hora: '2026-07-01T19:00:00Z', finalizado: false }),
    ]
    const result = determinarPeriodoAtual(jogos)
    expect(result?.periodoKey).toBe('oitavas')
    expect(result?.label).toBe('Oitavas de final')
  })

  it('final → periodoKey final, label "Final"', () => {
    const jogos: JogoParaPeriodo[] = [
      jogo({ id: 1, fase: 'final', data_hora: '2026-07-19T16:00:00Z', finalizado: false }),
    ]
    const result = determinarPeriodoAtual(jogos)
    expect(result?.periodoKey).toBe('final')
    expect(result?.label).toBe('Final')
  })

  it('retorna jogoIds corretos para a fase/rodada ativa', () => {
    const jogos: JogoParaPeriodo[] = [
      jogo({ id: 10, fase: 'oitavas', data_hora: '2026-07-01T19:00:00Z', finalizado: false }),
      jogo({ id: 11, fase: 'oitavas', data_hora: '2026-07-02T19:00:00Z', finalizado: false }),
      jogo({ id: 5, fase: 'grupos', data_hora: '2026-06-20T19:00:00Z', finalizado: true }),
    ]
    const result = determinarPeriodoAtual(jogos)
    expect(result?.jogoIds).toContain(10)
    expect(result?.jogoIds).toContain(11)
    expect(result?.jogoIds).not.toContain(5)
  })
})
