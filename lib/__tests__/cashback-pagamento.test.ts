import { describe, expect, it } from 'vitest'
import {
  isElegivelPagamento,
  exposicaoSelecao,
  type BilheteElegibilidade,
  type CopaResultadosElegibilidade,
} from '@/lib/cashback-pagamento'

const copaFinalizada: CopaResultadosElegibilidade = { finalizada: true, campeao_id: 10 }
const copaNaoFinalizada: CopaResultadosElegibilidade = { finalizada: false, campeao_id: null }

const bilheteOk: BilheteElegibilidade = {
  valor_pago: 100,
  cashback_multiplicador_snapshot: 2.0,
  selecao_cashback_id: 10,
  cashback_pago: false,
}

describe('isElegivelPagamento', () => {
  it('copa não finalizada → copa_nao_finalizada', () => {
    const r = isElegivelPagamento(bilheteOk, copaNaoFinalizada)
    expect(r).toEqual({ elegivel: false, motivo: 'copa_nao_finalizada' })
  })

  it('valor_pago 99 < 100 → valor_minimo_nao_atingido', () => {
    const r = isElegivelPagamento({ ...bilheteOk, valor_pago: 99 }, copaFinalizada)
    expect(r).toEqual({ elegivel: false, motivo: 'valor_minimo_nao_atingido' })
  })

  it('valor_pago exato 100 → não rejeita por valor', () => {
    const r = isElegivelPagamento({ ...bilheteOk, valor_pago: 100 }, copaFinalizada)
    expect(r).toEqual({ elegivel: true })
  })

  it('selecao_cashback_id diferente do campeão → selecao_nao_campea', () => {
    const r = isElegivelPagamento({ ...bilheteOk, selecao_cashback_id: 5 }, copaFinalizada)
    expect(r).toEqual({ elegivel: false, motivo: 'selecao_nao_campea' })
  })

  it('campeao_id null mesmo finalizada → selecao_nao_campea', () => {
    const r = isElegivelPagamento(bilheteOk, { finalizada: true, campeao_id: null })
    expect(r).toEqual({ elegivel: false, motivo: 'selecao_nao_campea' })
  })

  it('cashback_pago true → ja_pago', () => {
    const r = isElegivelPagamento({ ...bilheteOk, cashback_pago: true }, copaFinalizada)
    expect(r).toEqual({ elegivel: false, motivo: 'ja_pago' })
  })

  it('todos os critérios OK → elegivel true', () => {
    const r = isElegivelPagamento(bilheteOk, copaFinalizada)
    expect(r).toEqual({ elegivel: true })
  })

  it('ordem de verificação: copa_nao_finalizada antes de valor_minimo', () => {
    const r = isElegivelPagamento({ ...bilheteOk, valor_pago: 50 }, copaNaoFinalizada)
    expect(r).toEqual({ elegivel: false, motivo: 'copa_nao_finalizada' })
  })

  it('selecao_cashback_id null → selecao_nao_campea', () => {
    const r = isElegivelPagamento({ ...bilheteOk, selecao_cashback_id: null }, copaFinalizada)
    expect(r).toEqual({ elegivel: false, motivo: 'selecao_nao_campea' })
  })
})

describe('exposicaoSelecao', () => {
  it('lista vazia → total 0, count 0', () => {
    expect(exposicaoSelecao([])).toEqual({ total: 0, count: 0 })
  })

  it('1 bilhete R$100 mult 2× → total 200', () => {
    expect(
      exposicaoSelecao([{ valor_pago: 100, cashback_multiplicador_snapshot: 2.0 }]),
    ).toEqual({ total: 200, count: 1 })
  })

  it('mult zero não contribui para total', () => {
    expect(
      exposicaoSelecao([{ valor_pago: 100, cashback_multiplicador_snapshot: 0 }]),
    ).toEqual({ total: 0, count: 1 })
  })

  it('3 bilhetes variados — soma correta', () => {
    const bilhetes = [
      { valor_pago: 100, cashback_multiplicador_snapshot: 1.0 }, // 100
      { valor_pago: 200, cashback_multiplicador_snapshot: 2.0 }, // 400
      { valor_pago: 100, cashback_multiplicador_snapshot: 5.0 }, // 500
    ]
    expect(exposicaoSelecao(bilhetes)).toEqual({ total: 1000, count: 3 })
  })

  it('tier 5× R$100 → total 500', () => {
    expect(
      exposicaoSelecao([{ valor_pago: 100, cashback_multiplicador_snapshot: 5.0 }]),
    ).toEqual({ total: 500, count: 1 })
  })

  it('tier 3× R$150 → total 450', () => {
    expect(
      exposicaoSelecao([{ valor_pago: 150, cashback_multiplicador_snapshot: 3.0 }]),
    ).toEqual({ total: 450, count: 1 })
  })
})
