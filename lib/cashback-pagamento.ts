import { calcularValorCashback } from './cashback'
import type { CashbackMultiplicador } from './cashback'

export type BilheteElegibilidade = {
  valor_pago: number
  cashback_multiplicador_snapshot: number
  selecao_cashback_id: number | null
  cashback_pago: boolean
}

export type CopaResultadosElegibilidade = {
  finalizada: boolean
  campeao_id: number | null
}

export type ResultadoElegibilidade =
  | { elegivel: true }
  | {
      elegivel: false
      motivo:
        | 'copa_nao_finalizada'
        | 'selecao_nao_campea'
        | 'ja_pago'
        | 'valor_minimo_nao_atingido'
    }

/** Determina se um bilhete deve receber cashback.
 *  Ordem: falha rápida pela verificação mais restritiva. */
export function isElegivelPagamento(
  bilhete: BilheteElegibilidade,
  copa: CopaResultadosElegibilidade,
): ResultadoElegibilidade {
  if (!copa.finalizada) return { elegivel: false, motivo: 'copa_nao_finalizada' }
  if (bilhete.valor_pago < 100) return { elegivel: false, motivo: 'valor_minimo_nao_atingido' }
  if (bilhete.selecao_cashback_id !== copa.campeao_id)
    return { elegivel: false, motivo: 'selecao_nao_campea' }
  if (bilhete.cashback_pago) return { elegivel: false, motivo: 'ja_pago' }
  return { elegivel: true }
}

export type BilheteExposicao = {
  valor_pago: number
  cashback_multiplicador_snapshot: number
}

/** Agrega exposição financeira de uma lista de bilhetes de uma seleção. */
export function exposicaoSelecao(bilhetes: BilheteExposicao[]): {
  total: number
  count: number
} {
  return {
    total: bilhetes.reduce(
      (acc, b) =>
        acc +
        calcularValorCashback(
          b.valor_pago,
          b.cashback_multiplicador_snapshot as CashbackMultiplicador,
        ),
      0,
    ),
    count: bilhetes.length,
  }
}
