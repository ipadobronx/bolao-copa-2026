import { describe, expect, it } from 'vitest';
import {
  CASHBACK_VALOR_MINIMO,
  SELECOES_ELEGIVEIS,
  calcularValorCashback,
  elegivelCashback,
  isMultiplicadorValido,
  type CashbackMultiplicador,
} from '@/lib/cashback';

describe('lib/cashback — constantes', () => {
  it('CASHBACK_VALOR_MINIMO === 100', () => {
    expect(CASHBACK_VALOR_MINIMO).toBe(100);
  });

  it('SELECOES_ELEGIVEIS bate com CLAUDE.md §3.3', () => {
    expect(SELECOES_ELEGIVEIS).toEqual({
      1.0: ['FRA', 'ESP', 'ENG'],
      2.0: ['BRA', 'ARG'],
      3.0: ['POR', 'GER', 'NED'],
      5.0: ['NOR', 'SUI', 'BEL', 'COL', 'URU'],
    });
  });

  it('SELECOES_ELEGIVEIS soma 13 ao todo', () => {
    const total = Object.values(SELECOES_ELEGIVEIS).flat().length;
    expect(total).toBe(13);
  });
});

describe('lib/cashback — calcularValorCashback', () => {
  it('100 × 5.0 === 500 (Colômbia 5×)', () => {
    expect(calcularValorCashback(100, 5.0)).toBe(500);
  });

  it('100 × 3.0 === 300 (Portugal 3×)', () => {
    expect(calcularValorCashback(100, 3.0)).toBe(300);
  });

  it('100 × 2.0 === 200 (Brasil 2×)', () => {
    expect(calcularValorCashback(100, 2.0)).toBe(200);
  });

  it('100 × 1.0 === 100 (França 1×)', () => {
    expect(calcularValorCashback(100, 1.0)).toBe(100);
  });

  it('80 × 2.0 === 160 (qualquer valor maior que zero)', () => {
    expect(calcularValorCashback(80, 2.0)).toBe(160);
  });

  it('multiplicador 0 → cashback 0', () => {
    expect(calcularValorCashback(100, 0)).toBe(0);
  });

  it('33.33 × 3.0 === 99.99 (preserva 2 casas decimais)', () => {
    expect(calcularValorCashback(33.33, 3.0)).toBe(99.99);
  });

  it('arredonda 0.005 pra cima (consistência com Math.round)', () => {
    expect(calcularValorCashback(33.335, 3.0)).toBe(100.01);
  });

  it('lança em valor_pago negativo', () => {
    expect(() => calcularValorCashback(-1, 1.0)).toThrow('valor_pago não pode ser negativo');
  });
});

describe('lib/cashback — elegivelCashback', () => {
  it('100.00 → true (exato no threshold)', () => {
    expect(elegivelCashback(100.0)).toBe(true);
  });

  it('99.99 → false', () => {
    expect(elegivelCashback(99.99)).toBe(false);
  });

  it('200 → true', () => {
    expect(elegivelCashback(200)).toBe(true);
  });

  it('0 → false', () => {
    expect(elegivelCashback(0)).toBe(false);
  });
});

describe('lib/cashback — isMultiplicadorValido', () => {
  it.each([0, 1.0, 2.0, 3.0, 5.0])('aceita %s', (n) => {
    expect(isMultiplicadorValido(n)).toBe(true);
  });

  it.each([0.5, 1.5, 4.0, 6.0, -1, 10, NaN])('rejeita %s', (n) => {
    expect(isMultiplicadorValido(n)).toBe(false);
  });

  it('estreita o tipo (compile-time check)', () => {
    const x: number = 5.0;
    if (isMultiplicadorValido(x)) {
      const y: CashbackMultiplicador = x;
      expect(y).toBe(5.0);
    }
  });
});
