/**
 * Cálculos de cashback. Lib pura — sem I/O, sem importação de Database.
 *
 * Spec: docs/superpowers/specs/2026-04-30-checkout-mercadopago-design.md §3.2
 * Regras: CLAUDE.md §3.3 (cashback diferenciado).
 */

/** Multiplicadores válidos do pool de 13 elegíveis + 0 pra fora-do-pool. */
export type CashbackMultiplicador = 0 | 1.0 | 2.0 | 3.0 | 5.0;

/** Threshold mínimo pra cashback ser ofertado. CLAUDE.md §3.3. */
export const CASHBACK_VALOR_MINIMO = 100.0 as const;

/** Lista hardcoded dos códigos ISO elegíveis por tier. Espelha o seed da migration. */
export const SELECOES_ELEGIVEIS = {
  1.0: ['FRA', 'ESP', 'ENG'] as const,
  2.0: ['BRA', 'ARG'] as const,
  3.0: ['POR', 'GER', 'NED'] as const,
  5.0: ['NOR', 'SUI', 'BEL', 'COL', 'URU'] as const,
} as const;

/**
 * Calcula o valor a devolver se a seleção do cashback for campeã.
 * Usa o snapshot armazenado no bilhete (não busca em selecoes).
 *
 * Retorna número arredondado a 2 casas decimais.
 */
export function calcularValorCashback(
  valor_pago: number,
  multiplicador: CashbackMultiplicador,
): number {
  if (valor_pago < 0) {
    throw new Error('valor_pago não pode ser negativo');
  }
  return Math.round(valor_pago * multiplicador * 100) / 100;
}

/** Verifica se um valor de compra qualifica para o cashback (>= R$100). */
export function elegivelCashback(valor_pago: number): boolean {
  return valor_pago >= CASHBACK_VALOR_MINIMO;
}

/**
 * Type guard pro multiplicador. Útil em validações vindas do banco
 * (numeric → number) onde TS não estreita o tipo automaticamente.
 */
export function isMultiplicadorValido(n: number): n is CashbackMultiplicador {
  return n === 0 || n === 1.0 || n === 2.0 || n === 3.0 || n === 5.0;
}
