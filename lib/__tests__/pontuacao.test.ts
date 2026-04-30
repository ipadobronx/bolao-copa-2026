import { describe, expect, it } from 'vitest';
import {
  PONTOS_BASE,
  PONTOS_BONUS,
  MULTIPLICADORES,
  multiplicadorFase,
  pontosBase,
  classificarPalpite,
  calcularPontosPalpite,
  calcularPontosBonus,
  type ClassePalpite,
  type CopaResultadosInput,
  type FaseJogo,
  type JogoInput,
} from '@/lib/pontuacao';

describe('lib/pontuacao — sanity check de constantes (permanente)', () => {
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
    const valid: ClassePalpite[] = ['exato', 'vencedor_saldo', 'vencedor', 'parcial', 'erro'];
    expect(valid).toHaveLength(5);
  });
});

describe('multiplicadorFase', () => {
  it('grupos → 1', () => {
    expect(multiplicadorFase('grupos')).toBe(1);
  });

  it('16avos → 1.5', () => {
    expect(multiplicadorFase('16avos')).toBe(1.5);
  });

  it('oitavas → 2', () => {
    expect(multiplicadorFase('oitavas')).toBe(2);
  });

  it('quartas → 2.5', () => {
    expect(multiplicadorFase('quartas')).toBe(2.5);
  });

  it('semis → 3', () => {
    expect(multiplicadorFase('semis')).toBe(3);
  });

  it('disputa_terceiro → 2', () => {
    expect(multiplicadorFase('disputa_terceiro')).toBe(2);
  });

  it('final → 4', () => {
    expect(multiplicadorFase('final')).toBe(4);
  });
});

describe('pontosBase', () => {
  it('exato → 10', () => {
    expect(pontosBase('exato')).toBe(10);
  });

  it('vencedor_saldo → 7', () => {
    expect(pontosBase('vencedor_saldo')).toBe(7);
  });

  it('vencedor → 5', () => {
    expect(pontosBase('vencedor')).toBe(5);
  });

  it('parcial → 2', () => {
    expect(pontosBase('parcial')).toBe(2);
  });

  it('erro → 0', () => {
    expect(pontosBase('erro')).toBe(0);
  });
});

describe('classificarPalpite', () => {
  // Helper pra montar o JogoInput de forma legível em todos os testes.
  const jogo = (gols_casa: number, gols_fora: number, fase: FaseJogo = 'grupos'): JogoInput => ({
    fase,
    finalizado: true,
    gols_casa,
    gols_fora,
  });

  describe('placar exato', () => {
    it('case #1 — 2×0 vs 2×0 → exato', () => {
      expect(classificarPalpite({ gols_casa: 2, gols_fora: 0 }, jogo(2, 0))).toBe('exato');
    });

    it('case #6 — 1×1 vs 1×1 → exato', () => {
      expect(classificarPalpite({ gols_casa: 1, gols_fora: 1 }, jogo(1, 1))).toBe('exato');
    });

    it('0×0 vs 0×0 → exato', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 0 }, jogo(0, 0))).toBe('exato');
    });

    it('3×2 vs 3×2 → exato', () => {
      expect(classificarPalpite({ gols_casa: 3, gols_fora: 2 }, jogo(3, 2))).toBe('exato');
    });
  });

  describe('vencedor + saldo (vitórias apenas)', () => {
    it('case #2 — 2×0 vs 3×1 → vencedor_saldo (saldo +2 ambos)', () => {
      expect(classificarPalpite({ gols_casa: 3, gols_fora: 1 }, jogo(2, 0))).toBe('vencedor_saldo');
    });

    it('vitória de fora com saldo +1 — 0×2 vs 1×3 → vencedor_saldo', () => {
      expect(classificarPalpite({ gols_casa: 1, gols_fora: 3 }, jogo(0, 2))).toBe('vencedor_saldo');
    });

    it('vitória de casa com saldo +3 — 4×1 vs 5×2 → vencedor_saldo', () => {
      expect(classificarPalpite({ gols_casa: 5, gols_fora: 2 }, jogo(4, 1))).toBe('vencedor_saldo');
    });

    it('vitória de fora com saldo -2 — real 1×3 vs palpite 2×4 → vencedor_saldo', () => {
      expect(classificarPalpite({ gols_casa: 2, gols_fora: 4 }, jogo(1, 3))).toBe('vencedor_saldo');
    });
  });

  describe('apenas vencedor não-empate (saldo errado, sem +2 acumulando)', () => {
    it('case #3 — 2×0 vs 1×0 → vencedor (acertou casa-zero não conta como +2 porque acertou vencedor)', () => {
      expect(classificarPalpite({ gols_casa: 1, gols_fora: 0 }, jogo(2, 0))).toBe('vencedor');
    });

    it('case #12 — 3×2 vs 3×0 → vencedor (acertou casa-3 não acumula +2)', () => {
      expect(classificarPalpite({ gols_casa: 3, gols_fora: 0 }, jogo(3, 2))).toBe('vencedor');
    });

    it('vitória de fora com saldo errado — 0×2 vs 0×3 → vencedor', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 3 }, jogo(0, 2))).toBe('vencedor');
    });

    it('vencedor certo, saldo +1 vs +3, ambos zero em casa — 0×1 vs 0×3 → vencedor', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 3 }, jogo(0, 1))).toBe('vencedor');
    });
  });

  describe('empate não-exato sempre = vencedor (Q3-A do spec)', () => {
    it('case #7 — 1×1 vs 2×2 → vencedor (saldo trivial 0 não conta como vencedor_saldo)', () => {
      expect(classificarPalpite({ gols_casa: 2, gols_fora: 2 }, jogo(1, 1))).toBe('vencedor');
    });

    it('case #8 — 1×1 vs 0×0 → vencedor', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 0 }, jogo(1, 1))).toBe('vencedor');
    });

    it('2×2 vs 1×1 → vencedor', () => {
      expect(classificarPalpite({ gols_casa: 1, gols_fora: 1 }, jogo(2, 2))).toBe('vencedor');
    });
  });

  describe('parcial (errou vencedor + acertou gols de 1 time)', () => {
    it('case #5 — 2×0 vs 0×0 → parcial (acertou fora=0, errou vencedor)', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 0 }, jogo(2, 0))).toBe('parcial');
    });

    it('vencedor errado em vitória — 2×0 vs 2×3 → parcial (acertou casa=2)', () => {
      expect(classificarPalpite({ gols_casa: 2, gols_fora: 3 }, jogo(2, 0))).toBe('parcial');
    });

    it('case #9 — 1×1 vs 1×0 → parcial (errou vencedor empate vs vitória, acertou casa=1)', () => {
      expect(classificarPalpite({ gols_casa: 1, gols_fora: 0 }, jogo(1, 1))).toBe('parcial');
    });

    it('vencedor errado, acertou apenas fora — 1×1 vs 0×1 → parcial', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 1 }, jogo(1, 1))).toBe('parcial');
    });
  });

  describe('erro (errou tudo)', () => {
    it('case #4 — 2×0 vs 0×2 → erro (saldo invertido, gols ambos errados)', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 2 }, jogo(2, 0))).toBe('erro');
    });

    it('case #10 — 1×1 vs 2×0 → erro (errou empate predito vitória + ambos gols errados)', () => {
      expect(classificarPalpite({ gols_casa: 2, gols_fora: 0 }, jogo(1, 1))).toBe('erro');
    });

    it('saldo invertido, ambos errados — 3×1 vs 0×4 → erro', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 4 }, jogo(3, 1))).toBe('erro');
    });
  });

  describe('precondição', () => {
    it('jogo.finalizado=false → throws', () => {
      const jogoNaoFinalizado = {
        fase: 'grupos',
        finalizado: false,
        gols_casa: 2,
        gols_fora: 0,
      } as unknown as JogoInput;

      expect(() => classificarPalpite({ gols_casa: 2, gols_fora: 0 }, jogoNaoFinalizado)).toThrow(
        'Jogo não finalizado: classificação inválida',
      );
    });
  });
});

describe('calcularPontosPalpite (composição: classe × multiplicador × Math.round)', () => {
  it('case #1 — 2×0 vs 2×0 grupos → 10 pts (exato × 1)', () => {
    expect(
      calcularPontosPalpite(
        { gols_casa: 2, gols_fora: 0 },
        { fase: 'grupos', finalizado: true, gols_casa: 2, gols_fora: 0 },
      ),
    ).toEqual({ classe: 'exato', base: 10, multiplicador: 1, total: 10 });
  });

  it('case #11 — 3×2 vs 1×0 final → 28 pts (vencedor_saldo × 4)', () => {
    expect(
      calcularPontosPalpite(
        { gols_casa: 1, gols_fora: 0 },
        { fase: 'final', finalizado: true, gols_casa: 3, gols_fora: 2 },
      ),
    ).toEqual({ classe: 'vencedor_saldo', base: 7, multiplicador: 4, total: 28 });
  });

  it('case #13 — 0×0 vs 0×0 semis → 30 pts (exato × 3)', () => {
    expect(
      calcularPontosPalpite(
        { gols_casa: 0, gols_fora: 0 },
        { fase: 'semis', finalizado: true, gols_casa: 0, gols_fora: 0 },
      ),
    ).toEqual({ classe: 'exato', base: 10, multiplicador: 3, total: 30 });
  });

  it('1×1 vs 2×2 quartas → 13 pts (vencedor empate × 2.5, half-up)', () => {
    expect(
      calcularPontosPalpite(
        { gols_casa: 2, gols_fora: 2 },
        { fase: 'quartas', finalizado: true, gols_casa: 1, gols_fora: 1 },
      ),
    ).toEqual({ classe: 'vencedor', base: 5, multiplicador: 2.5, total: 13 });
  });

  it('case #14 — 1×0 vs 0×0 16avos → 3 pts (parcial × 1.5, sem rounding)', () => {
    expect(
      calcularPontosPalpite(
        { gols_casa: 0, gols_fora: 0 },
        { fase: '16avos', finalizado: true, gols_casa: 1, gols_fora: 0 },
      ),
    ).toEqual({ classe: 'parcial', base: 2, multiplicador: 1.5, total: 3 });
  });

  it('1×0 vs 0×1 16avos → 0 pts (erro × 1.5 = 0)', () => {
    expect(
      calcularPontosPalpite(
        { gols_casa: 0, gols_fora: 1 },
        { fase: '16avos', finalizado: true, gols_casa: 1, gols_fora: 0 },
      ),
    ).toEqual({ classe: 'erro', base: 0, multiplicador: 1.5, total: 0 });
  });

  it('5×0 vs 5×0 disputa_terceiro → 20 pts (exato × 2)', () => {
    expect(
      calcularPontosPalpite(
        { gols_casa: 5, gols_fora: 0 },
        {
          fase: 'disputa_terceiro',
          finalizado: true,
          gols_casa: 5,
          gols_fora: 0,
        },
      ),
    ).toEqual({ classe: 'exato', base: 10, multiplicador: 2, total: 20 });
  });

  it('case #15 — 2×1 vs 3×2 16avos → 11 pts (vencedor_saldo × 1.5, Math.round half-up: 10.5 → 11)', () => {
    expect(
      calcularPontosPalpite(
        { gols_casa: 3, gols_fora: 2 },
        { fase: '16avos', finalizado: true, gols_casa: 2, gols_fora: 1 },
      ),
    ).toEqual({ classe: 'vencedor_saldo', base: 7, multiplicador: 1.5, total: 11 });
  });
});

describe('calcularPontosBonus', () => {
  // Helper para resultados oficiais "default" (todos preenchidos).
  const resultadosCheios: CopaResultadosInput = {
    campeao_id: 9, // Brasil (id 9 conforme seed F2 — Grupo C)
    vice_id: 11,
    terceiro_id: 5,
    quarto_id: 7,
    artilheiro_nome: 'Mbappé',
    revelacao_id: 12,
  };

  describe('tipos com selecao_id (campeao, vice, terceiro, quarto, revelacao)', () => {
    it('campeao acertou (selecao_id === campeao_id) → 50 pts', () => {
      expect(calcularPontosBonus({ tipo: 'campeao', selecao_id: 9 }, resultadosCheios)).toEqual({
        acertou: true,
        pontos: 50,
      });
    });

    it('vice acertou → 30 pts', () => {
      expect(calcularPontosBonus({ tipo: 'vice', selecao_id: 11 }, resultadosCheios)).toEqual({
        acertou: true,
        pontos: 30,
      });
    });

    it('terceiro acertou → 15 pts', () => {
      expect(calcularPontosBonus({ tipo: 'terceiro', selecao_id: 5 }, resultadosCheios)).toEqual({
        acertou: true,
        pontos: 15,
      });
    });

    it('quarto acertou → 15 pts', () => {
      expect(calcularPontosBonus({ tipo: 'quarto', selecao_id: 7 }, resultadosCheios)).toEqual({
        acertou: true,
        pontos: 15,
      });
    });

    it('revelacao acertou → 15 pts', () => {
      expect(calcularPontosBonus({ tipo: 'revelacao', selecao_id: 12 }, resultadosCheios)).toEqual({
        acertou: true,
        pontos: 15,
      });
    });

    it('campeao errou (selecao_id ≠ campeao_id) → 0 pts', () => {
      expect(calcularPontosBonus({ tipo: 'campeao', selecao_id: 99 }, resultadosCheios)).toEqual({
        acertou: false,
        pontos: 0,
      });
    });

    it('campeao com resultados.campeao_id=null (Copa em andamento) → 0 pts', () => {
      const semCampeao = { ...resultadosCheios, campeao_id: null };
      expect(calcularPontosBonus({ tipo: 'campeao', selecao_id: 9 }, semCampeao)).toEqual({
        acertou: false,
        pontos: 0,
      });
    });
  });

  describe('artilheiro (jogador_nome com normalização)', () => {
    it('match exato — "Mbappé" === "Mbappé" → 25 pts', () => {
      expect(
        calcularPontosBonus({ tipo: 'artilheiro', jogador_nome: 'Mbappé' }, resultadosCheios),
      ).toEqual({ acertou: true, pontos: 25 });
    });

    it('case + acento ignorados — "MBAPPE" === "Mbappé" → 25 pts', () => {
      expect(
        calcularPontosBonus({ tipo: 'artilheiro', jogador_nome: 'MBAPPE' }, resultadosCheios),
      ).toEqual({ acertou: true, pontos: 25 });
    });

    it('whitespace nas pontas — "  Mbappé  " === "Mbappé" → 25 pts', () => {
      expect(
        calcularPontosBonus({ tipo: 'artilheiro', jogador_nome: '  Mbappé  ' }, resultadosCheios),
      ).toEqual({ acertou: true, pontos: 25 });
    });

    it('whitespace interno colapsado — "Kylian  Mbappé" === "Kylian Mbappé"', () => {
      const resultadosKylian = {
        ...resultadosCheios,
        artilheiro_nome: 'Kylian Mbappé',
      };
      expect(
        calcularPontosBonus(
          { tipo: 'artilheiro', jogador_nome: 'Kylian  Mbappé' },
          resultadosKylian,
        ),
      ).toEqual({ acertou: true, pontos: 25 });
    });

    it('match parcial NÃO bate — "Mbappé" ≠ "Kylian Mbappé" → 0 pts (decisão consciente)', () => {
      const resultadosKylian = {
        ...resultadosCheios,
        artilheiro_nome: 'Kylian Mbappé',
      };
      expect(
        calcularPontosBonus({ tipo: 'artilheiro', jogador_nome: 'Mbappé' }, resultadosKylian),
      ).toEqual({ acertou: false, pontos: 0 });
    });

    it('artilheiro com resultados.artilheiro_nome=null → 0 pts (Copa em andamento)', () => {
      const semArtilheiro = {
        ...resultadosCheios,
        artilheiro_nome: null,
      };
      expect(
        calcularPontosBonus({ tipo: 'artilheiro', jogador_nome: 'Mbappé' }, semArtilheiro),
      ).toEqual({ acertou: false, pontos: 0 });
    });
  });
});
