/**
 * Lógica de pontuação do bolão.
 *
 * Lib pura — sem I/O, sem importação de Database. Caller (Edge Function de
 * F10, UI de F7) faz o map de Row → input antes de chamar.
 *
 * Spec: docs/superpowers/specs/2026-04-30-pontuacao-design.md
 * Regras: CLAUDE.md §3.1 (pontuação), §3.5 (tiebreakers).
 */

// ============================================================================
// Tipos públicos
// ============================================================================

/** Espelha `Database['public']['Enums']['fase_jogo']`. */
export type FaseJogo =
  | 'grupos'
  | '16avos'
  | 'oitavas'
  | 'quartas'
  | 'semis'
  | 'disputa_terceiro'
  | 'final';

/** Espelha `Database['public']['Enums']['tipo_bonus']`. */
export type TipoBonus =
  | 'campeao'
  | 'vice'
  | 'terceiro'
  | 'quarto'
  | 'artilheiro'
  | 'revelacao';

/** Palpite de jogo. Gols são NOT NULL no banco (F2). */
export type PalpiteInput = {
  gols_casa: number;
  gols_fora: number;
};

/** Jogo finalizado. Lib lança em `finalizado !== true` — caller filtra. */
export type JogoInput = {
  fase: FaseJogo;
  finalizado: true;
  gols_casa: number;
  gols_fora: number;
};

/** Bônus do bilhete. Discriminated union pelo tipo. */
export type BonusInput =
  | { tipo: Exclude<TipoBonus, 'artilheiro'>; selecao_id: number }
  | { tipo: 'artilheiro'; jogador_nome: string };

/** Resultados oficiais da Copa. Campos podem ser null antes do fim. */
export type CopaResultadosInput = {
  campeao_id: number | null;
  vice_id: number | null;
  terceiro_id: number | null;
  quarto_id: number | null;
  artilheiro_nome: string | null;
  revelacao_id: number | null;
};

/** Classe de acerto de um palpite vs jogo finalizado. */
export type ClassePalpite =
  | 'exato'
  | 'vencedor_saldo'
  | 'vencedor'
  | 'parcial'
  | 'erro';

// ============================================================================
// Constantes exportadas (uso em F7 para preview "vale até X pts")
// ============================================================================

export const PONTOS_BASE = {
  exato: 10,
  vencedor_saldo: 7,
  vencedor: 5,
  parcial: 2,
  erro: 0,
} as const;

export const MULTIPLICADORES = {
  grupos: 1,
  '16avos': 1.5,
  oitavas: 2,
  quartas: 2.5,
  semis: 3,
  disputa_terceiro: 2,
  final: 4,
} as const;

export const PONTOS_BONUS = {
  campeao: 50,
  vice: 30,
  terceiro: 15,
  quarto: 15,
  artilheiro: 25,
  revelacao: 15,
} as const;

// ============================================================================
// Funções públicas — Camada 3: multiplicador
// ============================================================================

/** Retorna o multiplicador da fase. CLAUDE.md §3.1. */
export function multiplicadorFase(fase: FaseJogo): 1 | 1.5 | 2 | 2.5 | 3 | 4 {
  return MULTIPLICADORES[fase];
}
