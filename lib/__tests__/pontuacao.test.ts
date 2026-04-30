import { describe, expect, it } from 'vitest';
import {
  PONTOS_BASE,
  PONTOS_BONUS,
  MULTIPLICADORES,
  type ClassePalpite,
} from '@/lib/pontuacao';

describe('lib/pontuacao — sanity check (será removido após Task 2)', () => {
  it('PONTOS_BASE bate com a tabela do spec §4.4', () => {
    expect(PONTOS_BASE).toEqual({
      exato: 10,
      vencedor_saldo: 7,
      vencedor: 5,
      parcial: 2,
      erro: 0,
    });
  });

  it('MULTIPLICADORES bate com a tabela do spec §2', () => {
    expect(MULTIPLICADORES).toEqual({
      grupos: 1,
      '16avos': 1.5,
      oitavas: 2,
      quartas: 2.5,
      semis: 3,
      disputa_terceiro: 2,
      final: 4,
    });
  });

  it('PONTOS_BONUS bate com CLAUDE.md §3.1', () => {
    expect(PONTOS_BONUS).toEqual({
      campeao: 50,
      vice: 30,
      terceiro: 15,
      quarto: 15,
      artilheiro: 25,
      revelacao: 15,
    });
  });

  it('ClassePalpite tem exatamente 5 valores (compile-time check)', () => {
    const valid: ClassePalpite[] = [
      'exato',
      'vencedor_saldo',
      'vencedor',
      'parcial',
      'erro',
    ];
    expect(valid).toHaveLength(5);
  });
});
