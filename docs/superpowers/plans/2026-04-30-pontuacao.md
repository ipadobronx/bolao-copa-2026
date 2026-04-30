# Lógica de pontuação + tiebreakers do ranking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar (a) a lib pura `lib/pontuacao.ts` com 5 funções públicas em camadas (`classificarPalpite`, `pontosBase`, `multiplicadorFase`, `calcularPontosPalpite`, `calcularPontosBonus`) + 7 tipos exportados + 3 mapas de constantes (`PONTOS_BASE`, `MULTIPLICADORES`, `PONTOS_BONUS`), com bateria de ~55 testes Vitest e cobertura ≥95% escopada nessa lib; e (b) a migration `20260430120000_ranking_tiebreakers.sql` que substitui a view `ranking` da F2 por uma versão com novos tiebreakers (acertou_campeao, pontos_mata_mata) preservando a ordem das colunas 1-8.

**Architecture:** Lib pura sem I/O — define seus próprios tipos (`PalpiteInput`, `JogoInput`, etc.) sem importar `Database` do Supabase pra evitar coupling; caller faz o map de `Row` → input. Algoritmo em camadas: `classificarPalpite` retorna um enum de 5 valores (`exato | vencedor_saldo | vencedor | parcial | erro`); `pontosBase` mapeia enum → 0/2/5/7/10; `multiplicadorFase` mapeia fase → 1/1.5/2/2.5/3/4; `calcularPontosPalpite` compõe via `Math.round(base * multiplicador)`. Bônus separados (sem multiplicador, valores flat). View `ranking` atualizada via `CREATE OR REPLACE` (preserva grants, anexa colunas novas no fim).

**Tech Stack:** TypeScript estrito, Vitest (com `@vitest/coverage-v8`), Postgres 15+ (Supabase). Sem React, sem Tailwind, sem Supabase JS — toda a lib é pura. Migration é SQL puro.

**Spec:** `docs/superpowers/specs/2026-04-30-pontuacao-design.md` (commit `0a7dda7` em `main`).

**Estratégia de testes neste plano:**

- **TDD obrigatório** em `lib/pontuacao.ts` (lib pura, alvo ≥95% de cobertura em linhas/branches/functions/statements). Cada função pública ganha sua própria seção de testes; falha-primeiro em todos os ciclos.
- **Sem testes SQL automatizados** pra migration. Verificação é manual via `supabase db reset` + inspeção de `information_schema.columns` + smoke de tiebreaker com 3 bilhetes seedados (Tasks 8 e 9). Justificativa: F2 não trouxe pgTAP e adicionar agora é scope creep — view tem 0 dependentes hoje.
- **Os 15 casos canônicos da §4.4 do spec** viram testes nomeados, distribuídos: cases 1-10 (todos em `grupos`, sem multiplicador) dentro dos `describe` de `classificarPalpite`; cases 11-15 (com multiplicador) dentro dos testes de `calcularPontosPalpite`.

**Prerequisites for the developer (verify before starting):**

- [ ] Worktree configurado em branch `feat/pontuacao` (controller cria via using-git-worktrees skill antes de dispatchar tasks).
- [ ] HEAD da branch é `0a7dda7` ou descendente (inclui §3.5 do CLAUDE.md + spec).
- [ ] `pnpm install` rodou e está atualizado.
- [ ] Quality gates passam no estado inicial:
  - `pnpm typecheck` (zero errors)
  - `pnpm lint` (zero warnings)
  - `pnpm format:check` (no formatting issues)
  - `pnpm test:run` (todos os testes existentes passam)
- [ ] `.env.local` existe no worktree com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` populados (preservados de F1-F4).
- [ ] Supabase CLI está instalado e linkado (`supabase link --project-ref <ref>` ou local stack via `supabase start`). Necessário pra Tasks 8 e 9.

---

## Task 1: Foundation — instalar coverage provider + scaffold de `lib/pontuacao.ts` e arquivo de testes

**Goal:** Setup mínimo: instalar `@vitest/coverage-v8` (precisa pra o threshold da Task 7), criar `lib/pontuacao.ts` com **apenas os tipos e constantes** (sem funções ainda), e criar `lib/__tests__/pontuacao.test.ts` vazio. Garante que typecheck e import compilam antes de começar a escrever testes/funções.

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (via `pnpm add`)
- Create: `lib/pontuacao.ts`
- Create: `lib/__tests__/pontuacao.test.ts`

- [ ] **Step 1: Install `@vitest/coverage-v8`**

Run:

```bash
pnpm add -D @vitest/coverage-v8@^2.1.8
```

The `^2.1.8` matches the existing `vitest` version pinned in `package.json` (line 58). Mismatch entre vitest e o coverage provider gera warnings em runtime.

- [ ] **Step 2: Verify install**

Run:

```bash
pnpm list @vitest/coverage-v8
```

Expected: a single line showing `@vitest/coverage-v8 2.1.x` under devDependencies.

- [ ] **Step 3: Create `lib/pontuacao.ts` with types and constants only**

Create `lib/pontuacao.ts` with this exact content:

```ts
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
```

- [ ] **Step 4: Create `lib/__tests__/pontuacao.test.ts` with empty shell**

Create `lib/__tests__/pontuacao.test.ts` with this content:

```ts
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
```

(Esses 4 sanity checks ficam permanentes — eles guardam os 3 mapas contra mudança acidental e listam todas as classes pra forçar erro de typecheck se alguém adicionar/remover.)

- [ ] **Step 5: Verify the file compiles and tests pass**

Run:

```bash
pnpm typecheck
```

Expected: zero errors.

Run:

```bash
pnpm test:run lib/__tests__/pontuacao.test.ts
```

Expected: 4 testes passando.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml lib/pontuacao.ts lib/__tests__/pontuacao.test.ts
git commit -m "chore(pontuacao): scaffold types, constants, coverage dep"
```

---

## Task 2: `multiplicadorFase` — TDD cycle

**Goal:** Função simples que mapeia `FaseJogo` → multiplicador. 7 testes (um por fase). Anti-regressão pra mudança acidental do mapa.

**Files:**
- Modify: `lib/pontuacao.ts`
- Modify: `lib/__tests__/pontuacao.test.ts`

- [ ] **Step 1: Write 7 failing tests**

Append to `lib/__tests__/pontuacao.test.ts` (depois do último `describe`):

```ts
import { multiplicadorFase } from '@/lib/pontuacao';

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
```

Mover o `import { multiplicadorFase } from '@/lib/pontuacao';` pra o bloco de imports no topo do arquivo (junto com os imports já existentes), substituindo o import já existente. O bloco final no topo deve ficar:

```ts
import { describe, expect, it } from 'vitest';
import {
  PONTOS_BASE,
  PONTOS_BONUS,
  MULTIPLICADORES,
  multiplicadorFase,
  type ClassePalpite,
} from '@/lib/pontuacao';
```

- [ ] **Step 2: Run tests to confirm they fail**

Run:

```bash
pnpm test:run lib/__tests__/pontuacao.test.ts
```

Expected: 7 testes falhando com "ReferenceError: multiplicadorFase is not exported" ou TypeError equivalente.

- [ ] **Step 3: Implement `multiplicadorFase` em `lib/pontuacao.ts`**

Append depois do bloco de constantes (`PONTOS_BONUS`):

```ts
// ============================================================================
// Funções públicas — Camada 3: multiplicador
// ============================================================================

/** Retorna o multiplicador da fase. CLAUDE.md §3.1. */
export function multiplicadorFase(fase: FaseJogo): 1 | 1.5 | 2 | 2.5 | 3 | 4 {
  return MULTIPLICADORES[fase];
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run:

```bash
pnpm test:run lib/__tests__/pontuacao.test.ts
```

Expected: 11 testes passando (4 sanity + 7 multiplicadorFase).

- [ ] **Step 5: Commit**

```bash
git add lib/pontuacao.ts lib/__tests__/pontuacao.test.ts
git commit -m "feat(pontuacao): add multiplicadorFase with full test coverage"
```

---

## Task 3: `pontosBase` — TDD cycle

**Goal:** Função que mapeia `ClassePalpite` → pontos base (0/2/5/7/10). 5 testes.

**Files:**
- Modify: `lib/pontuacao.ts`
- Modify: `lib/__tests__/pontuacao.test.ts`

- [ ] **Step 1: Write 5 failing tests**

Append to `lib/__tests__/pontuacao.test.ts`:

```ts
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
```

Adicionar `pontosBase` ao bloco de imports no topo do arquivo:

```ts
import {
  PONTOS_BASE,
  PONTOS_BONUS,
  MULTIPLICADORES,
  multiplicadorFase,
  pontosBase,
  type ClassePalpite,
} from '@/lib/pontuacao';
```

- [ ] **Step 2: Run tests to confirm they fail**

Run:

```bash
pnpm test:run lib/__tests__/pontuacao.test.ts
```

Expected: 5 testes falhando.

- [ ] **Step 3: Implement `pontosBase` em `lib/pontuacao.ts`**

Append depois de `multiplicadorFase`:

```ts
// ============================================================================
// Funções públicas — Camada 2: pontuação base por classe
// ============================================================================

/** Retorna os pontos base por classe de acerto. CLAUDE.md §3.1. */
export function pontosBase(classe: ClassePalpite): 0 | 2 | 5 | 7 | 10 {
  return PONTOS_BASE[classe];
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test:run lib/__tests__/pontuacao.test.ts
```

Expected: 16 testes passando.

- [ ] **Step 5: Commit**

```bash
git add lib/pontuacao.ts lib/__tests__/pontuacao.test.ts
git commit -m "feat(pontuacao): add pontosBase with full test coverage"
```

---

## Task 4: `classificarPalpite` — TDD cycle (coração da lib, 23 testes)

**Goal:** A função mais crítica do sistema. Recebe palpite + jogo finalizado, retorna a classe de acerto. 23 testes organizados em 7 `describe` blocks cobrindo: placar exato, vencedor com saldo, apenas vencedor não-empate, empates, parcial, erro, precondição.

**Files:**
- Modify: `lib/pontuacao.ts`
- Modify: `lib/__tests__/pontuacao.test.ts`

- [ ] **Step 1: Write all 23 failing tests**

Append to `lib/__tests__/pontuacao.test.ts`:

```ts
describe('classificarPalpite', () => {
  // Helper pra montar o JogoInput de forma legível em todos os testes.
  const jogo = (
    gols_casa: number,
    gols_fora: number,
    fase: FaseJogo = 'grupos',
  ): JogoInput => ({
    fase,
    finalizado: true,
    gols_casa,
    gols_fora,
  });

  describe('placar exato', () => {
    it('case #1 — 2×0 vs 2×0 → exato', () => {
      expect(classificarPalpite({ gols_casa: 2, gols_fora: 0 }, jogo(2, 0))).toBe(
        'exato',
      );
    });

    it('case #6 — 1×1 vs 1×1 → exato', () => {
      expect(classificarPalpite({ gols_casa: 1, gols_fora: 1 }, jogo(1, 1))).toBe(
        'exato',
      );
    });

    it('0×0 vs 0×0 → exato', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 0 }, jogo(0, 0))).toBe(
        'exato',
      );
    });

    it('3×2 vs 3×2 → exato', () => {
      expect(classificarPalpite({ gols_casa: 3, gols_fora: 2 }, jogo(3, 2))).toBe(
        'exato',
      );
    });
  });

  describe('vencedor + saldo (vitórias apenas)', () => {
    it('case #2 — 2×0 vs 3×1 → vencedor_saldo (saldo +2 ambos)', () => {
      expect(classificarPalpite({ gols_casa: 3, gols_fora: 1 }, jogo(2, 0))).toBe(
        'vencedor_saldo',
      );
    });

    it('vitória de fora com saldo +1 — 0×2 vs 1×3 → vencedor_saldo', () => {
      expect(classificarPalpite({ gols_casa: 1, gols_fora: 3 }, jogo(0, 2))).toBe(
        'vencedor_saldo',
      );
    });

    it('vitória de casa com saldo +3 — 4×1 vs 5×2 → vencedor_saldo', () => {
      expect(classificarPalpite({ gols_casa: 5, gols_fora: 2 }, jogo(4, 1))).toBe(
        'vencedor_saldo',
      );
    });

    it('vitória de fora com saldo -2 — real 1×3 vs palpite 2×4 → vencedor_saldo', () => {
      expect(classificarPalpite({ gols_casa: 2, gols_fora: 4 }, jogo(1, 3))).toBe(
        'vencedor_saldo',
      );
    });
  });

  describe('apenas vencedor não-empate (saldo errado, sem +2 acumulando)', () => {
    it('case #3 — 2×0 vs 1×0 → vencedor (acertou casa-zero não conta como +2 porque acertou vencedor)', () => {
      expect(classificarPalpite({ gols_casa: 1, gols_fora: 0 }, jogo(2, 0))).toBe(
        'vencedor',
      );
    });

    it('case #12 — 3×2 vs 3×0 → vencedor (acertou casa-3 não acumula +2)', () => {
      expect(classificarPalpite({ gols_casa: 3, gols_fora: 0 }, jogo(3, 2))).toBe(
        'vencedor',
      );
    });

    it('vitória de fora com saldo errado — 0×2 vs 0×3 → vencedor', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 3 }, jogo(0, 2))).toBe(
        'vencedor',
      );
    });

    it('vencedor certo, saldo +1 vs +3, ambos zero em casa — 0×1 vs 0×3 → vencedor', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 3 }, jogo(0, 1))).toBe(
        'vencedor',
      );
    });
  });

  describe('empate não-exato sempre = vencedor (Q3-A do spec)', () => {
    it('case #7 — 1×1 vs 2×2 → vencedor (saldo trivial 0 não conta como vencedor_saldo)', () => {
      expect(classificarPalpite({ gols_casa: 2, gols_fora: 2 }, jogo(1, 1))).toBe(
        'vencedor',
      );
    });

    it('case #8 — 1×1 vs 0×0 → vencedor', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 0 }, jogo(1, 1))).toBe(
        'vencedor',
      );
    });

    it('2×2 vs 1×1 → vencedor', () => {
      expect(classificarPalpite({ gols_casa: 1, gols_fora: 1 }, jogo(2, 2))).toBe(
        'vencedor',
      );
    });
  });

  describe('parcial (errou vencedor + acertou gols de 1 time)', () => {
    it('case #5 — 2×0 vs 0×0 → parcial (acertou fora=0, errou vencedor)', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 0 }, jogo(2, 0))).toBe(
        'parcial',
      );
    });

    it('vencedor errado em vitória — 2×0 vs 2×3 → parcial (acertou casa=2)', () => {
      expect(classificarPalpite({ gols_casa: 2, gols_fora: 3 }, jogo(2, 0))).toBe(
        'parcial',
      );
    });

    it('case #9 — 1×1 vs 1×0 → parcial (errou vencedor empate vs vitória, acertou casa=1)', () => {
      expect(classificarPalpite({ gols_casa: 1, gols_fora: 0 }, jogo(1, 1))).toBe(
        'parcial',
      );
    });

    it('vencedor errado, acertou apenas fora — 1×1 vs 0×1 → parcial', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 1 }, jogo(1, 1))).toBe(
        'parcial',
      );
    });
  });

  describe('erro (errou tudo)', () => {
    it('case #4 — 2×0 vs 0×2 → erro (saldo invertido, gols ambos errados)', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 2 }, jogo(2, 0))).toBe(
        'erro',
      );
    });

    it('case #10 — 1×1 vs 2×0 → erro (errou empate predito vitória + ambos gols errados)', () => {
      expect(classificarPalpite({ gols_casa: 2, gols_fora: 0 }, jogo(1, 1))).toBe(
        'erro',
      );
    });

    it('saldo invertido, ambos errados — 3×1 vs 0×4 → erro', () => {
      expect(classificarPalpite({ gols_casa: 0, gols_fora: 4 }, jogo(3, 1))).toBe(
        'erro',
      );
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

      expect(() =>
        classificarPalpite({ gols_casa: 2, gols_fora: 0 }, jogoNaoFinalizado),
      ).toThrow('Jogo não finalizado: classificação inválida');
    });
  });
});
```

Atualizar o bloco de imports no topo:

```ts
import {
  PONTOS_BASE,
  PONTOS_BONUS,
  MULTIPLICADORES,
  multiplicadorFase,
  pontosBase,
  classificarPalpite,
  type ClassePalpite,
  type FaseJogo,
  type JogoInput,
} from '@/lib/pontuacao';
```

- [ ] **Step 2: Run tests to confirm they fail**

Run:

```bash
pnpm test:run lib/__tests__/pontuacao.test.ts
```

Expected: 23 novos testes falhando, 16 anteriores passando. Mensagem de erro: "ReferenceError: classificarPalpite is not exported".

- [ ] **Step 3: Implement `classificarPalpite` em `lib/pontuacao.ts`**

Append depois de `pontosBase`:

```ts
// ============================================================================
// Funções públicas — Camada 1: classificação
// ============================================================================

/**
 * Classifica o palpite vs jogo finalizado em uma das 5 classes.
 *
 * Mutuamente exclusivas:
 *   - exato: placar exato bate
 *   - vencedor_saldo: vitória com saldo idêntico (apenas vitórias, não empates)
 *   - vencedor: acertou vencedor (ou empate não-exato), mas saldo errado ou empate
 *   - parcial: errou vencedor, mas acertou os gols de UM dos times (+2 stand-alone)
 *   - erro: nada bate
 *
 * Lança Error se `jogo.finalizado !== true`. Caller filtra antes.
 */
export function classificarPalpite(
  palpite: PalpiteInput,
  jogo: JogoInput,
): ClassePalpite {
  if (jogo.finalizado !== true) {
    throw new Error('Jogo não finalizado: classificação inválida');
  }

  // 1. Placar exato
  if (
    palpite.gols_casa === jogo.gols_casa &&
    palpite.gols_fora === jogo.gols_fora
  ) {
    return 'exato';
  }

  const sinalReal = sinal(jogo.gols_casa - jogo.gols_fora);
  const sinalPalpite = sinal(palpite.gols_casa - palpite.gols_fora);
  const acertouVencedor = sinalReal === sinalPalpite;

  // 2. Errou vencedor → parcial ou erro
  if (!acertouVencedor) {
    const acertouCasa = palpite.gols_casa === jogo.gols_casa;
    const acertouFora = palpite.gols_fora === jogo.gols_fora;
    return acertouCasa || acertouFora ? 'parcial' : 'erro';
  }

  // 3. Acertou vencedor — distinguir empate / vencedor_saldo / vencedor
  const ehEmpate = sinalReal === 0;
  if (ehEmpate) {
    // Q3-A do spec: empate não-exato sempre cai em vencedor (5 pts).
    // Saldo "trivial" de 0 NÃO qualifica para vencedor_saldo.
    return 'vencedor';
  }

  const saldoReal = jogo.gols_casa - jogo.gols_fora;
  const saldoPalpite = palpite.gols_casa - palpite.gols_fora;
  return saldoReal === saldoPalpite ? 'vencedor_saldo' : 'vencedor';
}

// Helper privado.
function sinal(n: number): -1 | 0 | 1 {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run:

```bash
pnpm test:run lib/__tests__/pontuacao.test.ts
```

Expected: 39 testes passando (16 + 23).

- [ ] **Step 5: Commit**

```bash
git add lib/pontuacao.ts lib/__tests__/pontuacao.test.ts
git commit -m "feat(pontuacao): add classificarPalpite with 23 tests covering all classes"
```

---

## Task 5: `calcularPontosPalpite` — composição (8 testes)

**Goal:** Função que compõe `classificarPalpite` + `pontosBase` + `multiplicadorFase` + `Math.round`. Cobre os cases #11-15 do spec §4.4 + 3 cases adicionais que exercitam multiplicadores e arredondamento half-up.

**Files:**
- Modify: `lib/pontuacao.ts`
- Modify: `lib/__tests__/pontuacao.test.ts`

- [ ] **Step 1: Write 8 failing tests**

Append to `lib/__tests__/pontuacao.test.ts`:

```ts
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
```

Atualizar imports:

```ts
import {
  PONTOS_BASE,
  PONTOS_BONUS,
  MULTIPLICADORES,
  multiplicadorFase,
  pontosBase,
  classificarPalpite,
  calcularPontosPalpite,
  type ClassePalpite,
  type FaseJogo,
  type JogoInput,
} from '@/lib/pontuacao';
```

- [ ] **Step 2: Run tests to confirm they fail**

Run:

```bash
pnpm test:run lib/__tests__/pontuacao.test.ts
```

Expected: 8 testes falhando.

- [ ] **Step 3: Implement `calcularPontosPalpite` em `lib/pontuacao.ts`**

Append depois de `classificarPalpite` (e antes do helper `sinal`, ou depois — ordem é livre, mas fica mais legível agrupar com as funções públicas):

```ts
// ============================================================================
// Funções públicas — Camada 4: composição (chamada principal de F10)
// ============================================================================

/** Compõe classificação + base + multiplicador + arredondamento. */
export function calcularPontosPalpite(
  palpite: PalpiteInput,
  jogo: JogoInput,
): {
  classe: ClassePalpite;
  base: number;
  multiplicador: number;
  total: number;
} {
  const classe = classificarPalpite(palpite, jogo);
  const base = pontosBase(classe);
  const multiplicador = multiplicadorFase(jogo.fase);
  const total = Math.round(base * multiplicador);
  return { classe, base, multiplicador, total };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test:run lib/__tests__/pontuacao.test.ts
```

Expected: 47 testes passando.

- [ ] **Step 5: Commit**

```bash
git add lib/pontuacao.ts lib/__tests__/pontuacao.test.ts
git commit -m "feat(pontuacao): add calcularPontosPalpite composing all 4 layers"
```

---

## Task 6: `calcularPontosBonus` + `normalizar` — TDD cycle (12 testes)

**Goal:** Função que pontua bônus (campeao/vice/terceiro/quarto/revelacao via `selecao_id`; artilheiro via `jogador_nome` com normalização agressiva). 12 testes: 5 acertos por tipo + 1 errou + 1 null + 5 normalização de artilheiro.

**Files:**
- Modify: `lib/pontuacao.ts`
- Modify: `lib/__tests__/pontuacao.test.ts`

- [ ] **Step 1: Write 12 failing tests**

Append to `lib/__tests__/pontuacao.test.ts`:

```ts
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
      expect(
        calcularPontosBonus({ tipo: 'campeao', selecao_id: 9 }, resultadosCheios),
      ).toEqual({ acertou: true, pontos: 50 });
    });

    it('vice acertou → 30 pts', () => {
      expect(
        calcularPontosBonus({ tipo: 'vice', selecao_id: 11 }, resultadosCheios),
      ).toEqual({ acertou: true, pontos: 30 });
    });

    it('terceiro acertou → 15 pts', () => {
      expect(
        calcularPontosBonus({ tipo: 'terceiro', selecao_id: 5 }, resultadosCheios),
      ).toEqual({ acertou: true, pontos: 15 });
    });

    it('quarto acertou → 15 pts', () => {
      expect(
        calcularPontosBonus({ tipo: 'quarto', selecao_id: 7 }, resultadosCheios),
      ).toEqual({ acertou: true, pontos: 15 });
    });

    it('revelacao acertou → 15 pts', () => {
      expect(
        calcularPontosBonus(
          { tipo: 'revelacao', selecao_id: 12 },
          resultadosCheios,
        ),
      ).toEqual({ acertou: true, pontos: 15 });
    });

    it('campeao errou (selecao_id ≠ campeao_id) → 0 pts', () => {
      expect(
        calcularPontosBonus({ tipo: 'campeao', selecao_id: 99 }, resultadosCheios),
      ).toEqual({ acertou: false, pontos: 0 });
    });

    it('campeao com resultados.campeao_id=null (Copa em andamento) → 0 pts', () => {
      const semCampeao = { ...resultadosCheios, campeao_id: null };
      expect(
        calcularPontosBonus({ tipo: 'campeao', selecao_id: 9 }, semCampeao),
      ).toEqual({ acertou: false, pontos: 0 });
    });
  });

  describe('artilheiro (jogador_nome com normalização)', () => {
    it('match exato — "Mbappé" === "Mbappé" → 25 pts', () => {
      expect(
        calcularPontosBonus(
          { tipo: 'artilheiro', jogador_nome: 'Mbappé' },
          resultadosCheios,
        ),
      ).toEqual({ acertou: true, pontos: 25 });
    });

    it('case + acento ignorados — "MBAPPE" === "Mbappé" → 25 pts', () => {
      expect(
        calcularPontosBonus(
          { tipo: 'artilheiro', jogador_nome: 'MBAPPE' },
          resultadosCheios,
        ),
      ).toEqual({ acertou: true, pontos: 25 });
    });

    it('whitespace nas pontas — "  Mbappé  " === "Mbappé" → 25 pts', () => {
      expect(
        calcularPontosBonus(
          { tipo: 'artilheiro', jogador_nome: '  Mbappé  ' },
          resultadosCheios,
        ),
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
        calcularPontosBonus(
          { tipo: 'artilheiro', jogador_nome: 'Mbappé' },
          resultadosKylian,
        ),
      ).toEqual({ acertou: false, pontos: 0 });
    });
  });
});
```

Atualizar imports:

```ts
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
```

- [ ] **Step 2: Run tests to confirm they fail**

Run:

```bash
pnpm test:run lib/__tests__/pontuacao.test.ts
```

Expected: 12 testes falhando.

- [ ] **Step 3: Implement `calcularPontosBonus` + `normalizar` em `lib/pontuacao.ts`**

Append depois de `calcularPontosPalpite` (mas antes ou depois do helper `sinal`):

```ts
// ============================================================================
// Funções públicas — Bônus (sem multiplicador, valores flat)
// ============================================================================

/** Pontuação dos bônus de Copa. CLAUDE.md §3.1. */
export function calcularPontosBonus(
  bonus: BonusInput,
  resultados: CopaResultadosInput,
): { acertou: boolean; pontos: number } {
  if (bonus.tipo === 'artilheiro') {
    if (!resultados.artilheiro_nome) {
      return { acertou: false, pontos: 0 };
    }
    const acertou =
      normalizar(bonus.jogador_nome) === normalizar(resultados.artilheiro_nome);
    return { acertou, pontos: acertou ? PONTOS_BONUS.artilheiro : 0 };
  }

  // bonus.tipo é 'campeao' | 'vice' | 'terceiro' | 'quarto' | 'revelacao'
  // (TS estreita pelo discriminated union).
  const oficialId = {
    campeao: resultados.campeao_id,
    vice: resultados.vice_id,
    terceiro: resultados.terceiro_id,
    quarto: resultados.quarto_id,
    revelacao: resultados.revelacao_id,
  }[bonus.tipo];

  if (oficialId == null) {
    return { acertou: false, pontos: 0 };
  }

  const acertou = bonus.selecao_id === oficialId;
  return { acertou, pontos: acertou ? PONTOS_BONUS[bonus.tipo] : 0 };
}

// Helper privado — normalização de nome de jogador.
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/g, ' ');
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm test:run lib/__tests__/pontuacao.test.ts
```

Expected: 59 testes passando (47 + 12).

- [ ] **Step 5: Commit**

```bash
git add lib/pontuacao.ts lib/__tests__/pontuacao.test.ts
git commit -m "feat(pontuacao): add calcularPontosBonus with normalizar helper"
```

---

## Task 7: Cobertura ≥95% escopada em `lib/pontuacao.ts`

**Goal:** Configurar threshold de cobertura no `vitest.config.mts` escopado a `lib/pontuacao.ts`. Verificar que rodar `pnpm test:run --coverage` reporta ≥95% em linhas, branches, functions e statements.

**Files:**
- Modify: `vitest.config.mts`

- [ ] **Step 1: Open `vitest.config.mts` and replace the `test` block**

O arquivo atual tem 14 linhas. Substituir o conteúdo todo por:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '.next', 'e2e', 'supabase', '.worktrees/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/pontuacao.ts'],
      thresholds: {
        lines: 95,
        branches: 95,
        functions: 95,
        statements: 95,
      },
    },
  },
});
```

- [ ] **Step 2: Run coverage report**

Run:

```bash
pnpm test:run --coverage
```

Expected:
- Todos os 59 testes passam.
- Output do v8 reporter mostra uma tabela com `lib/pontuacao.ts` e percentages ≥95% em todas as 4 colunas (Statements, Branches, Functions, Lines).
- Comando termina com exit code 0 (threshold passou).

If coverage falla abaixo de 95% em alguma métrica, identificar a linha não-coberta no relatório e adicionar 1-2 testes específicos. Linhas mais prováveis de ficarem descobertas:

- Branch `acertouCasa || acertouFora` no `classificarPalpite` — testes existentes cobrem ambos lados (case #5 acerta fora, "vencedor errado, acertou apenas fora" acerta fora também). Verificar que tem teste que cobre `acertouCasa=true && acertouFora=false` E vice-versa.
- Branch `oficialId == null` em `calcularPontosBonus` — coberto pelo teste "campeao com resultados.campeao_id=null".
- Branch `!resultados.artilheiro_nome` — adicionar teste explícito se faltar:

```ts
it('artilheiro com resultados.artilheiro_nome=null → 0 pts', () => {
  const semArtilheiro = { ...resultadosCheios, artilheiro_nome: null };
  expect(
    calcularPontosBonus(
      { tipo: 'artilheiro', jogador_nome: 'Mbappé' },
      semArtilheiro,
    ),
  ).toEqual({ acertou: false, pontos: 0 });
});
```

(Este teste deveria ser parte da Task 6; se já estiver lá, não duplicar.)

- [ ] **Step 3: Commit**

```bash
git add vitest.config.mts
git commit -m "chore(test): add v8 coverage threshold (≥95%) for lib/pontuacao.ts"
```

---

## Task 8: Migration `ranking_tiebreakers` — apply + verify column shape

**Goal:** Criar `supabase/migrations/20260430120000_ranking_tiebreakers.sql` que substitui a view `ranking` da F2 por uma versão que usa os tiebreakers de §3.5 (acertou_campeao + pontos_mata_mata + numero_bilhete) preservando colunas 1-8 da F2 e anexando colunas 9 e 10. Verificar via `supabase db reset` + inspeção de `information_schema.columns`.

**Files:**
- Create: `supabase/migrations/20260430120000_ranking_tiebreakers.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260430120000_ranking_tiebreakers.sql` with this exact content:

```sql
-- ============================================================================
-- Bolão Copa 2026 — Atualiza view `ranking` com tiebreakers de §3.5
-- ============================================================================
-- Feature 5 (lib/pontuacao + view tiebreakers)
-- Spec: docs/superpowers/specs/2026-04-30-pontuacao-design.md
--
-- Mudanças vs F2:
--   1. Adiciona coluna `pontos_mata_mata` (soma de pontos_calculados em
--      jogos com fase <> 'grupos'). Usada no critério #3 de desempate.
--   2. Adiciona coluna `acertou_campeao` (boolean: bilhete tem palpite_bonus
--      tipo='campeao' batendo com copa_resultados.campeao_id). Usada no #2.
--   3. Remove `acertos_parciais` da chain de empate (mantida como display).
--   4. Ordem final: pontos_totais > acertos_exatos > acertou_campeao
--                   > pontos_mata_mata > numero_bilhete ASC
--
-- CREATE OR REPLACE preserva grants (anon/authenticated) e ordem 1-8 das
-- colunas existentes; novas colunas aparecem em 9 e 10.
-- ============================================================================

CREATE OR REPLACE VIEW public.ranking
WITH (security_invoker = false) AS
WITH palpite_aggregates AS (
  SELECT
    p.bilhete_id,
    COALESCE(SUM(p.pontos_calculados), 0)::int AS pontos_palpites,
    COALESCE(
      SUM(p.pontos_calculados) FILTER (WHERE j.fase <> 'grupos'),
      0
    )::int AS pontos_mata_mata,
    COUNT(*) FILTER (
      WHERE j.finalizado = true
        AND p.gols_casa = j.gols_casa
        AND p.gols_fora = j.gols_fora
    )::int AS acertos_exatos,
    COUNT(*) FILTER (
      WHERE j.finalizado = true
        AND COALESCE(p.pontos_calculados, 0) > 0
        AND NOT (p.gols_casa = j.gols_casa AND p.gols_fora = j.gols_fora)
    )::int AS acertos_parciais
  FROM palpites p
  JOIN jogos j ON j.id = p.jogo_id
  GROUP BY p.bilhete_id
),
bonus_aggregates AS (
  SELECT
    bilhete_id,
    COALESCE(SUM(pontos_calculados), 0)::int AS pontos_bonus
  FROM palpites_bonus
  GROUP BY bilhete_id
),
campeao_hit AS (
  SELECT pb.bilhete_id
  FROM palpites_bonus pb
  CROSS JOIN copa_resultados cr
  WHERE cr.id = 1
    AND cr.campeao_id IS NOT NULL
    AND pb.tipo = 'campeao'
    AND pb.selecao_id = cr.campeao_id
)
SELECT
  b.id AS bilhete_id,                                                     -- col 1 (preservada)
  b.numero_bilhete,                                                       -- col 2
  b.user_id,                                                              -- col 3
  COALESCE(pr.nome, '') AS nome,                                          -- col 4
  COALESCE(pa.pontos_palpites, 0) + COALESCE(ba.pontos_bonus, 0)
    AS pontos_totais,                                                     -- col 5
  COALESCE(pa.acertos_exatos, 0) AS acertos_exatos,                       -- col 6
  COALESCE(pa.acertos_parciais, 0) AS acertos_parciais,                   -- col 7 (display)
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(pa.pontos_palpites, 0) + COALESCE(ba.pontos_bonus, 0) DESC,
      COALESCE(pa.acertos_exatos, 0) DESC,
      (ch.bilhete_id IS NOT NULL) DESC,            -- §3.5 #2: acertou campeão
      COALESCE(pa.pontos_mata_mata, 0) DESC,       -- §3.5 #3: pontos em mata-mata
      b.numero_bilhete ASC                         -- §3.5 #4: fallback determinístico
  )::int AS posicao,                                                      -- col 8 (preservada)
  COALESCE(pa.pontos_mata_mata, 0) AS pontos_mata_mata,                   -- col 9 (NOVA)
  (ch.bilhete_id IS NOT NULL) AS acertou_campeao                          -- col 10 (NOVA)
FROM bilhetes b
LEFT JOIN palpite_aggregates pa ON pa.bilhete_id = b.id
LEFT JOIN bonus_aggregates    ba ON ba.bilhete_id = b.id
LEFT JOIN campeao_hit         ch ON ch.bilhete_id = b.id
LEFT JOIN profiles            pr ON pr.id = b.user_id
WHERE b.status_pagamento = 'confirmado';

-- Grants são preservados pelo CREATE OR REPLACE; não re-grantear.
```

- [ ] **Step 2: Reset the local Supabase DB to apply F2 + F5**

Run:

```bash
supabase db reset
```

Expected:
- "Resetting local database..."
- "Applying migration 20260429202547_initial_schema.sql..."
- "Applying migration 20260430120000_ranking_tiebreakers.sql..."
- "Seeding data from supabase/seed.sql..."
- Termina sem erro. Se o comando exigir `supabase start` antes, rodar primeiro.

> **If working against linked Supabase Cloud (não-local):** rodar `supabase db push` em vez de `supabase db reset`. Isso aplica apenas migrations não-aplicadas, sem re-rodar seed. Confirmar que `supabase migration list` lista a nova migration como "Applied".

- [ ] **Step 3: Verify column shape via psql**

Run:

```bash
supabase db shell <<'EOF'
SELECT column_name, ordinal_position, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ranking'
ORDER BY ordinal_position;
EOF
```

(Se `supabase db shell` não estiver disponível na versão do CLI, conectar via `psql "$(supabase status -o json | jq -r .DB_URL)"` e rodar o SELECT manualmente.)

Expected output (10 linhas, nesta ordem):

```
 column_name      | ordinal_position | data_type
------------------+------------------+-----------
 bilhete_id       |                1 | uuid
 numero_bilhete   |                2 | integer
 user_id          |                3 | uuid
 nome             |                4 | text
 pontos_totais    |                5 | integer
 acertos_exatos   |                6 | integer
 acertos_parciais |                7 | integer
 posicao          |                8 | integer
 pontos_mata_mata |                9 | integer
 acertou_campeao  |               10 | boolean
```

If qualquer coluna estiver fora de ordem ou com tipo diferente, abort and investigate. CRiAR OR REPLACE rejeita rename/reorder; qualquer divergência indica que F2 não está aplicada ou que a migration falhou silenciosamente.

- [ ] **Step 4: Verify view returns 0 rows on clean DB (sanity)**

Run:

```bash
supabase db shell -c "SELECT COUNT(*) FROM public.ranking;"
```

Expected: `count = 0` (seed só insere selecoes e jogos, nenhum bilhete confirmado).

- [ ] **Step 5: Verify idempotency (apply doesn't drift)**

Run:

```bash
supabase db diff --use-migra --schema public > /tmp/ranking_drift.txt
cat /tmp/ranking_drift.txt
```

Expected: arquivo vazio ou apenas comentários (`-- This script was generated by...`). Qualquer DDL real indica drift entre o que está no banco e o que está nas migrations.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260430120000_ranking_tiebreakers.sql
git commit -m "feat(db): update ranking view with §3.5 tiebreakers (campeao + mata_mata)"
```

---

## Task 9: Smoke manual de tiebreaker (3 bilhetes empatados)

**Goal:** Verificar empiricamente que a chain `pontos_totais > acertos_exatos > acertou_campeao > pontos_mata_mata > numero_bilhete` ordena corretamente. O smoke é tunado pra exercitar o critério `acertou_campeao` (separa C de A/B) e `pontos_mata_mata` (separa A de B).

**Cenário desejado:**

- **Bilhete A** (numero_bilhete=1): 100 pts em palpites, ACERTOU campeão, 30 pts em mata-mata.
- **Bilhete B** (numero_bilhete=2): 100 pts em palpites, ACERTOU campeão, 20 pts em mata-mata.
- **Bilhete C** (numero_bilhete=3): 100 pts em palpites, ERROU campeão, 50 pts em mata-mata.

Bônus do tipo `campeao` ficam com `pontos_calculados=NULL` por default (não somam nada). Logo, `pontos_totais = pontos_palpites = 100` pra todos os 3. Empate de pontos → cai pra `acertos_exatos` (todos zero, F2 seed não tem jogos finalizados) → cai pra `acertou_campeao` (A=true, B=true, C=false) → entre A e B cai pra `pontos_mata_mata` (30 vs 20) → A primeiro.

**Ordem esperada:** A (pos=1), B (pos=2), C (pos=3).

**Files:** sem arquivos commitados; o smoke é uma sequência manual de comandos `supabase` + `psql`.

> **Why not a real test:** F2 não tem infra de pgTAP e adicionar agora é scope creep (decisão registrada no spec §6.4). Quando F8 chegar e construir UI de ranking, vale considerar Playwright E2E. Por enquanto, este smoke é manual — um único execução; nenhum dado é commitado.

- [ ] **Step 1: Garantir que o stack local está rodando**

Run:

```bash
supabase status
```

Expected: status mostra `API URL`, `DB URL`, etc. Se aparecer "supabase local development setup is not running", rodar `supabase start` antes.

- [ ] **Step 2: Criar 3 usuários reais via Supabase Studio (UI local)**

Abrir `http://localhost:54323` no browser → "Authentication" → "Users" → "Add user" → "Create new user". Criar 3 usuários, anotando os UUIDs gerados:

| Slot | Email             | Nome (em "user metadata", chave `full_name`) |
| ---- | ----------------- | -------------------------------------------- |
| A    | a@smoke.local     | Apostador A                                  |
| B    | b@smoke.local     | Apostador B                                  |
| C    | c@smoke.local     | Apostador C                                  |

Senha: qualquer (ex: `smoke123!`). O trigger `handle_new_user` (F2) cria automaticamente as rows em `public.profiles` com `nome` baseado no `full_name`.

> **Alternativa via CLI** (se preferir):
>
> ```bash
> supabase auth admin create-user --email=a@smoke.local --password=smoke123! --user-metadata='{"full_name":"Apostador A"}'
> supabase auth admin create-user --email=b@smoke.local --password=smoke123! --user-metadata='{"full_name":"Apostador B"}'
> supabase auth admin create-user --email=c@smoke.local --password=smoke123! --user-metadata='{"full_name":"Apostador C"}'
> ```
>
> Cada comando imprime o UUID criado.

Anotar os 3 UUIDs (vamos referenciar como `$UUID_A`, `$UUID_B`, `$UUID_C` nos passos seguintes).

- [ ] **Step 3: Capturar a connection string do banco local**

Run:

```bash
supabase status -o json | jq -r '.["DB URL"]'
```

Expected: algo como `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Salvar em variável `PGURL`:

```bash
PGURL="$(supabase status -o json | jq -r '.["DB URL"]')"
```

- [ ] **Step 4: Rodar o smoke seed via psql (com rollback automático)**

Substituir os 3 placeholders `<UUID_A>`, `<UUID_B>`, `<UUID_C>` pelos UUIDs reais antes de rodar:

```bash
psql "$PGURL" <<'EOF'
BEGIN;

-- 0. Definir Brasil como campeão (id=9 no seed F2 — Grupo C)
UPDATE copa_resultados SET campeao_id = 9 WHERE id = 1;

-- 1. Criar 3 bilhetes confirmados.
--    numero_bilhete vem do serial em ordem de INSERT → 1, 2, 3 (assumindo
--    que o smoke roda em DB pós-`db reset`, sem outros bilhetes).
INSERT INTO bilhetes (id, user_id, status_pagamento, valor_pago) VALUES
  ('a0000000-0000-0000-0000-00000000000a', '<UUID_A>', 'confirmado', 20),
  ('b0000000-0000-0000-0000-00000000000b', '<UUID_B>', 'confirmado', 20),
  ('c0000000-0000-0000-0000-00000000000c', '<UUID_C>', 'confirmado', 20);

-- 2. Capturar IDs de 4 jogos: 2 de grupos + 2 de 16avos
WITH jogos_alvo AS (
  SELECT id, fase,
         row_number() OVER (PARTITION BY fase ORDER BY id) AS rn
  FROM jogos
  WHERE fase IN ('grupos', '16avos')
),
g1 AS (SELECT id FROM jogos_alvo WHERE fase = 'grupos' AND rn = 1),
g2 AS (SELECT id FROM jogos_alvo WHERE fase = 'grupos' AND rn = 2),
m1 AS (SELECT id FROM jogos_alvo WHERE fase = '16avos' AND rn = 1),
m2 AS (SELECT id FROM jogos_alvo WHERE fase = '16avos' AND rn = 2)
INSERT INTO palpites (bilhete_id, jogo_id, gols_casa, gols_fora)
SELECT 'a0000000-0000-0000-0000-00000000000a', id, 1, 0 FROM g1
UNION ALL SELECT 'a0000000-0000-0000-0000-00000000000a', id, 2, 0 FROM g2
UNION ALL SELECT 'a0000000-0000-0000-0000-00000000000a', id, 1, 0 FROM m1
UNION ALL SELECT 'a0000000-0000-0000-0000-00000000000a', id, 2, 0 FROM m2
UNION ALL SELECT 'b0000000-0000-0000-0000-00000000000b', id, 1, 0 FROM g1
UNION ALL SELECT 'b0000000-0000-0000-0000-00000000000b', id, 2, 0 FROM g2
UNION ALL SELECT 'b0000000-0000-0000-0000-00000000000b', id, 1, 0 FROM m1
UNION ALL SELECT 'b0000000-0000-0000-0000-00000000000b', id, 2, 0 FROM m2
UNION ALL SELECT 'c0000000-0000-0000-0000-00000000000c', id, 1, 0 FROM g1
UNION ALL SELECT 'c0000000-0000-0000-0000-00000000000c', id, 2, 0 FROM g2
UNION ALL SELECT 'c0000000-0000-0000-0000-00000000000c', id, 1, 0 FROM m1
UNION ALL SELECT 'c0000000-0000-0000-0000-00000000000c', id, 2, 0 FROM m2;

-- 3. Forjar pontos_calculados via service_role (psql conecta como service_role
--    por default no DB local da Supabase CLI).
--    A: g1=35, g2=35 (grupos=70), m1=15, m2=15 (mata=30) → total 100
--    B: g1=40, g2=40 (grupos=80), m1=10, m2=10 (mata=20) → total 100
--    C: g1=25, g2=25 (grupos=50), m1=25, m2=25 (mata=50) → total 100
--    Os jogos g1/g2/m1/m2 são distintos por bilhete, mas usamos os mesmos
--    IDs porque os palpites são de bilhetes diferentes (UNIQUE só por
--    bilhete_id+jogo_id).
UPDATE palpites SET pontos_calculados = CASE
  WHEN bilhete_id = 'a0000000-0000-0000-0000-00000000000a' AND
       jogo_id IN (SELECT id FROM jogos WHERE fase='grupos' ORDER BY id LIMIT 2) THEN 35
  WHEN bilhete_id = 'a0000000-0000-0000-0000-00000000000a' THEN 15
  WHEN bilhete_id = 'b0000000-0000-0000-0000-00000000000b' AND
       jogo_id IN (SELECT id FROM jogos WHERE fase='grupos' ORDER BY id LIMIT 2) THEN 40
  WHEN bilhete_id = 'b0000000-0000-0000-0000-00000000000b' THEN 10
  WHEN bilhete_id = 'c0000000-0000-0000-0000-00000000000c' THEN 25
END;

-- 4. Bônus de campeão: A e B acertam (selecao_id=9, Brasil), C erra (id=11).
INSERT INTO palpites_bonus (bilhete_id, tipo, selecao_id) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'campeao', 9),
  ('b0000000-0000-0000-0000-00000000000b', 'campeao', 9),
  ('c0000000-0000-0000-0000-00000000000c', 'campeao', 11);

-- 5. Inspecionar a ordem do ranking pros 3 bilhetes.
SELECT
  numero_bilhete,
  nome,
  pontos_totais,
  acertos_exatos,
  acertou_campeao,
  pontos_mata_mata,
  posicao
FROM ranking
WHERE numero_bilhete IN (1, 2, 3)
ORDER BY posicao;

ROLLBACK;
EOF
```

> **Sobre `pontos_bonus`:** as rows de `palpites_bonus` ficam com `pontos_calculados=NULL` (não inserimos valor). NULL não soma na CTE `bonus_aggregates`, então `pontos_totais` permanece igual a `pontos_palpites=100` para os 3. Isso é **intencional** — o smoke quer testar empate de pontos.

- [ ] **Step 5: Verificar a saída**

Expected output do `SELECT` final:

```
 numero_bilhete |     nome     | pontos_totais | acertos_exatos | acertou_campeao | pontos_mata_mata | posicao
----------------+--------------+---------------+----------------+-----------------+------------------+---------
              1 | Apostador A  |           100 |              0 | t               |               30 |       1
              2 | Apostador B  |           100 |              0 | t               |               20 |       2
              3 | Apostador C  |           100 |              0 | f               |               50 |       3
```

Validações:
- ✅ Os 3 estão empatados em `pontos_totais=100` e `acertos_exatos=0`.
- ✅ A e B aparecem antes de C porque `acertou_campeao=true` > `false` (apesar de C ter `pontos_mata_mata=50`).
- ✅ Entre A e B (empatados também em `acertou_campeao`), A vem antes porque `pontos_mata_mata=30 > 20`.
- ✅ `posicao` é 1, 2, 3.

Se a ordem estiver errada:
- A e B na ordem errada → investigar `pontos_mata_mata` (cálculo da CTE `palpite_aggregates` com `FILTER (WHERE j.fase <> 'grupos')`).
- C antes de A/B → investigar `campeao_hit` CTE (provavelmente o `selecao_id=9` no bônus de A/B não casou com `copa_resultados.campeao_id=9`).
- Algum bilhete sumiu → checar `WHERE b.status_pagamento = 'confirmado'` na view (deveria pegar todos os 3).

- [ ] **Step 6: Cleanup**

O `ROLLBACK` no fim do bloco SQL desfaz tudo automaticamente. Confirmar com:

```bash
psql "$PGURL" -c "SELECT COUNT(*) FROM bilhetes;"
```

Expected: `count = 0`.

Os 3 usuários criados em auth.users via Studio/CLI **persistem** (foram criados fora da transação). Pra removê-los:

```bash
supabase auth admin delete-user --email a@smoke.local
supabase auth admin delete-user --email b@smoke.local
supabase auth admin delete-user --email c@smoke.local
```

(Opcional, mas recomendado pra deixar o ambiente limpo.)

- [ ] **Step 7: Skip commit**

Esta task não modifica nenhum arquivo do repo. Confirmar:

```bash
git status
```

Expected: working tree clean (nenhuma alteração desde o commit da Task 8).

---

## Task 10: Quality gates final + smoke completo

**Goal:** Verificar que toda a feature passa nos quality gates do projeto antes de pedir review/merge.

**Files:** sem alterações.

- [ ] **Step 1: Typecheck**

```bash
pnpm typecheck
```

Expected: zero errors. Se aparecer algum, geralmente vem de `as unknown as` ou `any` — investigar e corrigir.

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

Expected: zero warnings.

- [ ] **Step 3: Format check**

```bash
pnpm format:check
```

Expected: nenhum arquivo precisa de formatação. Se algum precisar, rodar `pnpm format` e commitar:

```bash
pnpm format
git add -u
git commit -m "chore: apply prettier formatting"
```

- [ ] **Step 4: Run all tests**

```bash
pnpm test:run
```

Expected: todos os testes passam (incluindo os 59 da F5 + os existentes de F1-F4).

- [ ] **Step 5: Run coverage**

```bash
pnpm test:run --coverage
```

Expected: thresholds (≥95%) passam em `lib/pontuacao.ts`.

- [ ] **Step 6: Review do diff completo do worktree**

```bash
git log --oneline main..HEAD
git diff main..HEAD --stat
```

Expected:
- 7-9 commits na branch `feat/pontuacao` (1 por task de TDD + bootstrap + coverage + migration).
- Arquivos modificados: `lib/pontuacao.ts` (NOVO), `lib/__tests__/pontuacao.test.ts` (NOVO), `vitest.config.mts` (modificado), `supabase/migrations/20260430120000_ranking_tiebreakers.sql` (NOVO), `package.json` + `pnpm-lock.yaml` (modificados pelo `@vitest/coverage-v8`).
- Nenhum arquivo de smoke commitado.

- [ ] **Step 7: Done**

A feature está pronta pra merge. Próximo passo (fora deste plano): abrir PR pra `main` ou usar `superpowers:finishing-a-development-branch`.

---

## Verificação final pós-task

Antes de marcar a feature como completa, double-check:

- [ ] `lib/pontuacao.ts` exporta exatamente: `FaseJogo`, `TipoBonus`, `PalpiteInput`, `JogoInput`, `BonusInput`, `CopaResultadosInput`, `ClassePalpite`, `PONTOS_BASE`, `MULTIPLICADORES`, `PONTOS_BONUS`, `multiplicadorFase`, `pontosBase`, `classificarPalpite`, `calcularPontosPalpite`, `calcularPontosBonus`. (15 exports.)
- [ ] `lib/__tests__/pontuacao.test.ts` tem 59 testes nomeados.
- [ ] Cases 1-15 do spec §4.4 estão todos presentes (cases 1-10 dentro de `classificarPalpite`, cases 11-15 dentro de `calcularPontosPalpite`).
- [ ] Migration aplicada confere com `information_schema.columns` (10 colunas, 9 e 10 são as novas).
- [ ] Smoke manual de tiebreaker rodou e a ordem A → B → C foi confirmada.
- [ ] Nenhum `any` ou `as unknown as` em `lib/pontuacao.ts`.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:run`, `pnpm test:run --coverage` todos verde.
