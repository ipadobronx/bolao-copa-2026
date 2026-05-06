// lib/dashboard/estado.test.ts
import { describe, it, expect } from 'vitest'
import { determinarEstadoDashboard, type DeterminarEstadoInput } from './estado'

const COPA_INICIO = new Date('2026-06-11T00:00:00Z')

function baseInput(overrides: Partial<DeterminarEstadoInput> = {}): DeterminarEstadoInput {
  return {
    bilhetes: [],
    ranking: null,
    palpitesCount: 0,
    jogosFinalizadosCount: 0,
    copaInicio: COPA_INICIO,
    snapshot: null,
    totalParticipantes: 0,
    ...overrides,
  }
}

describe('determinarEstadoDashboard', () => {
  it('Estado A — sem-bilhete (zero bilhetes)', () => {
    const r = determinarEstadoDashboard(baseInput())
    expect(r).toEqual({ kind: 'sem-bilhete' })
  })

  it('Estado B — pendente-puro (1 pendente, sem confirmado)', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'pendente', created_at: '2026-05-06T10:00:00Z' },
        ],
      }),
    )
    expect(r).toEqual({
      kind: 'pendente-puro',
      pendente: { bilhete_id: 'b1', numero_bilhete: 100, valor_total_pendente: 20, qtd_pendentes: 1 },
    })
  })

  it('Estado B — pendente-puro com múltiplos pendentes (alvo = mais recente, soma todos)', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'pendente', created_at: '2026-05-06T10:00:00Z' },
          { id: 'b2', numero_bilhete: 101, valor_pago: 40, effective_status: 'pendente', created_at: '2026-05-06T11:00:00Z' },
        ],
      }),
    )
    expect(r.kind).toBe('pendente-puro')
    if (r.kind !== 'pendente-puro') throw new Error('expected pendente-puro')
    expect(r.pendente.bilhete_id).toBe('b2')           // mais recente
    expect(r.pendente.numero_bilhete).toBe(101)
    expect(r.pendente.valor_total_pendente).toBe(60)   // 20 + 40
    expect(r.pendente.qtd_pendentes).toBe(2)
  })

  it('Estado C — pre-copa (1 confirmado, sem jogos finalizados)', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'confirmado', created_at: '2026-05-06T10:00:00Z' },
        ],
        ranking: { melhor_bilhete_id: 'b1', melhor_numero_bilhete: 100, pontos_totais: 0, posicao: 1, total_bilhetes: 1 },
        palpitesCount: 50,
      }),
    )
    expect(r.kind).toBe('pre-copa')
    if (r.kind !== 'pre-copa') throw new Error('expected pre-copa')
    expect(r.pendente).toBeNull()
    expect(r.progresso).toEqual({ preenchidos: 50, total: 104, porcentagem: 48, totalBilhetes: 1 })
  })

  it('Estado C com banner — confirmado + pendente, Copa não começou', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'confirmado', created_at: '2026-05-06T10:00:00Z' },
          { id: 'b2', numero_bilhete: 101, valor_pago: 40, effective_status: 'pendente', created_at: '2026-05-06T11:00:00Z' },
        ],
        ranking: { melhor_bilhete_id: 'b1', melhor_numero_bilhete: 100, pontos_totais: 0, posicao: 1, total_bilhetes: 1 },
        palpitesCount: 0,
      }),
    )
    expect(r.kind).toBe('pre-copa')
    if (r.kind !== 'pre-copa') throw new Error('expected pre-copa')
    expect(r.pendente).not.toBeNull()
    expect(r.pendente!.bilhete_id).toBe('b2')
    expect(r.pendente!.qtd_pendentes).toBe(1)
    expect(r.progresso.totalBilhetes).toBe(1)
  })

  it('Estado D — em-andamento (1 confirmado + Copa em andamento)', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'confirmado', created_at: '2026-05-06T10:00:00Z' },
        ],
        ranking: { melhor_bilhete_id: 'b1', melhor_numero_bilhete: 100, pontos_totais: 234, posicao: 42, total_bilhetes: 1 },
        palpitesCount: 50,
        jogosFinalizadosCount: 12,
        snapshot: { posicao: 50, pontos_totais: 200 },
        totalParticipantes: 500,
      }),
    )
    expect(r.kind).toBe('em-andamento')
    if (r.kind !== 'em-andamento') throw new Error('expected em-andamento')
    expect(r.tendenciaPontos).toBe(34)        // 234 - 200
    expect(r.tendenciaPosicao).toBe(8)        // 50 - 42 (subiu 8)
    expect(r.totalParticipantes).toBe(500)
    expect(r.progresso.porcentagem).toBe(48)
  })

  it('Estado D sem snapshot — tendências = null', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'confirmado', created_at: '2026-05-06T10:00:00Z' },
        ],
        ranking: { melhor_bilhete_id: 'b1', melhor_numero_bilhete: 100, pontos_totais: 50, posicao: 30, total_bilhetes: 1 },
        jogosFinalizadosCount: 5,
        snapshot: null,
      }),
    )
    if (r.kind !== 'em-andamento') throw new Error('expected em-andamento')
    expect(r.tendenciaPontos).toBeNull()
    expect(r.tendenciaPosicao).toBeNull()
  })

  it('Edge graceful — confirmado mas ranking vazio: degrada pra pre-copa', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'confirmado', created_at: '2026-05-06T10:00:00Z' },
        ],
        ranking: null,
        jogosFinalizadosCount: 5,
      }),
    )
    expect(r.kind).toBe('pre-copa')
  })

  it('Bilhetes expirados/cancelados não contam em nenhum cálculo', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'expirado', created_at: '2026-05-06T10:00:00Z' },
          { id: 'b2', numero_bilhete: 101, valor_pago: 20, effective_status: 'cancelado', created_at: '2026-05-06T11:00:00Z' },
        ],
      }),
    )
    expect(r).toEqual({ kind: 'sem-bilhete' })
  })

  it('Pendente-puro tem precedência sobre cálculo de progresso (sem confirmados)', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'pendente', created_at: '2026-05-06T10:00:00Z' },
        ],
      }),
    )
    expect(r.kind).toBe('pendente-puro')
    // Não há progresso quando user só tem pendente; estado é determinado antes de progresso ser computado.
  })
})
