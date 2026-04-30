# Feature 5 — Lógica de pontuação (`lib/pontuacao.ts`) + tiebreakers da view `ranking`

**Data:** 2026-04-30
**Status:** Aprovado para implementação
**Autor:** Brainstorm conduzido com Jonatas
**Próximo passo:** writing-plans → executing-plans em worktree separado

---

## 1. Contexto e motivação

Quinta feature da seção 5 do `CLAUDE.md`. Features 1-4 já mergeadas em `main`:

- **F1 (setup):** Next 14 App Router, Tailwind v4, Vitest configurado, supabase clients, middleware base.
- **F2 (schema):** 7 tabelas (`profiles`, `selecoes`, `jogos`, `bilhetes`, `palpites`, `palpites_bonus`, `copa_resultados`) + view `ranking` + 3 enums + RLS + seed (48 seleções, 104 jogos). View `ranking` atual usa tiebreaker chain `pontos DESC, acertos_exatos DESC, acertos_parciais DESC, numero_bilhete ASC`.
- **F3 (landing):** `/` com Hero/Features/Promo, header e footer.
- **F4 (auth + dashboard):** magic link puro, layout com sidebar/drawer/header, `/dashboard` com painel "Próximos jogos". Decisões registradas no spec da F4 que afetam F5: palpite ausente vale 0 pts (sem default); palpites são rodada-por-rodada; a lib de pontuação não opera em jogos não-finalizados.

Esta feature entrega a **regra de negócio mais crítica do sistema**: a função pura que calcula quantos pontos um palpite vale dado o resultado real. O `CLAUDE.md` §5 exige que ela venha como módulo isolado, com TDD e cobertura ≥95%, **antes** de qualquer UI ou Edge Function que dependa dela. F10 (admin → recalc) e F7 (tela de palpite com preview) consomem esta lib mais tarde.

A feature também atualiza a view `ranking` (F2) pra refletir os tiebreakers de **`CLAUDE.md` §3.5** (recém-adicionados nesta sessão): `acertou_campeao` e `pontos_mata_mata` substituem `acertos_parciais` na ordem de empate. A migration vem junto porque o tiebreaker é da mesma família que a lógica de pontuação — separar em features distintas deixaria §3.5 documentado mas não enforced no banco.

---

## 2. Decisões tomadas durante o brainstorming

| #   | Pergunta                                                                   | Escolha                                                                                                                                                     | Motivação                                                                                                                                                |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Escopo da feature                                                          | **B — Lib TS pura + atualização da view `ranking`** (sem Edge Function nesta feature)                                                                       | Tiebreaker é regra de negócio da mesma família; adiar deixa §3.5 num limbo. Edge Function fica com a F10 (responsável pelo painel admin que a aciona).   |
| Q2  | Regra do "+2 bônus" (acertou gols de 1 time)                               | **A — Stand-alone**: só é dado quando errou o vencedor. Não acumula com 5 ou 7 pts.                                                                         | Leitura literal de "sem acertar resultado" em §3.1. Mantém 4 categorias mutuamente exclusivas (10/7/5/2). Evita inflação do ranking por +2 quase grátis. |
| Q3  | Empate não-exato com qualquer placar de empate (ex: predito 2×2, real 1×1) | **A — Sempre 5 pts**: o tier de 7 pts ("vencedor + saldo") só vale para vitórias. Saldo "trivial" de 0 em empates não qualifica.                            | "(ou empate)" em §3.1 já posiciona empate no tier dos 5. Evita incentivo perverso de cravar empates esquisitos pra pegar 7 pts genericamente.            |
| Q4  | Comparação de `artilheiro_nome` (text livre)                               | Normalização agressiva: `trim` + `toLocaleLowerCase('pt-BR')` + remover diacríticos (`NFD` + `\p{Diacritic}`) + colapsar whitespace. **Sem match parcial.** | "Mbappé" === "mbappe" === " MBAPPE " — útil. "Mbappé" ≠ "Kylian Mbappé" — match parcial é cilada (Silva pega múltiplos jogadores).                       |
| Q5  | Forma da API                                                               | **B — Camadas expostas**: `classificarPalpite`, `pontosBase`, `multiplicadorFase` separados + `calcularPontosPalpite` como composição.                      | TDD vira cascata natural; cobertura ≥95% sai sem combinatória explosiva. F7 reusa `pontosBase`/`multiplicadorFase` pra preview "vale até X pts".         |

### Tabela de pontuação consolidada (referência)

| Categoria        | Pts base | Quando se aplica                                                                 | Mutuamente exclusivo? |
| ---------------- | -------- | -------------------------------------------------------------------------------- | --------------------- |
| `exato`          | 10       | `palpite.gols_casa = real.gols_casa` E idem fora                                 | ✅                    |
| `vencedor_saldo` | 7        | Não-exato, vitória predita = vitória real, saldo idêntico (não-empate)           | ✅                    |
| `vencedor`       | 5        | Não-exato, "vencedor" certo (vitória OU empate), mas saldo diferente OU é empate | ✅                    |
| `parcial`        | 2        | Errou o vencedor, mas acertou os gols exatos de UM dos times                     | ✅                    |
| `erro`           | 0        | Resto                                                                            | ✅                    |

`pontos_total = Math.round(pontos_base × multiplicador_da_fase)`.

Multiplicadores (de `CLAUDE.md` §3.1):

| Fase               | Multiplicador |
| ------------------ | ------------- |
| `grupos`           | 1             |
| `16avos`           | 1.5           |
| `oitavas`          | 2             |
| `quartas`          | 2.5           |
| `semis`            | 3             |
| `disputa_terceiro` | 2             |
| `final`            | 4             |

Bônus (sem multiplicador, valores flat de `CLAUDE.md` §3.1):

| Tipo         | Pts | Como compara                                                                |
| ------------ | --- | --------------------------------------------------------------------------- |
| `campeao`    | 50  | `bonus.selecao_id === resultados.campeao_id`                                |
| `vice`       | 30  | `bonus.selecao_id === resultados.vice_id`                                   |
| `terceiro`   | 15  | `bonus.selecao_id === resultados.terceiro_id`                               |
| `quarto`     | 15  | `bonus.selecao_id === resultados.quarto_id`                                 |
| `artilheiro` | 25  | `normalizar(bonus.jogador_nome) === normalizar(resultados.artilheiro_nome)` |
| `revelacao`  | 15  | `bonus.selecao_id === resultados.revelacao_id`                              |

---

## 3. Tipos públicos e API

A lib **não importa** types do Supabase (`Database`) pra evitar coupling. Define seus próprios tipos mínimos. Custo: caller (F10 Edge Function, F7 UI) faz o map de `Row` → `PalpiteInput` antes de chamar. Ganho: testes não precisam mockar Supabase.

### 3.1 Tipos exportados

```ts
// lib/pontuacao.ts

/** Enum local — espelha Database['public']['Enums']['fase_jogo']. */
export type FaseJogo =
  | 'grupos'
  | '16avos'
  | 'oitavas'
  | 'quartas'
  | 'semis'
  | 'disputa_terceiro'
  | 'final';

/** Enum local — espelha Database['public']['Enums']['tipo_bonus']. */
export type TipoBonus = 'campeao' | 'vice' | 'terceiro' | 'quarto' | 'artilheiro' | 'revelacao';

/** Palpite de jogo (gols NOT NULL no banco). */
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

/** Bônus do bilhete. Discriminated union. */
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

/** Classificação de um palpite vs jogo finalizado. */
export type ClassePalpite = 'exato' | 'vencedor_saldo' | 'vencedor' | 'parcial' | 'erro';
```

### 3.2 Funções públicas

```ts
/** Camada 1 — classifica o palpite, sem aplicar fase. */
export function classificarPalpite(palpite: PalpiteInput, jogo: JogoInput): ClassePalpite;

/** Camada 2 — pontuação base por classe, sem fase. */
export function pontosBase(classe: ClassePalpite): 0 | 2 | 5 | 7 | 10;

/** Camada 3 — multiplicador por fase. */
export function multiplicadorFase(fase: FaseJogo): 1 | 1.5 | 2 | 2.5 | 3 | 4;

/** Camada 4 — composição (chamada principal de F10). */
export function calcularPontosPalpite(
  palpite: PalpiteInput,
  jogo: JogoInput,
): {
  classe: ClassePalpite;
  base: number; // 0..10
  multiplicador: number; // 1..4
  total: number; // Math.round(base * multiplicador)
};

/** Bônus — flat, sem multiplicador. */
export function calcularPontosBonus(
  bonus: BonusInput,
  resultados: CopaResultadosInput,
): {
  acertou: boolean;
  pontos: number; // 0, 15, 25, 30 ou 50
};
```

### 3.3 Constantes exportadas (uso em F7 para preview)

```ts
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

`pontosBase` e `multiplicadorFase` retornam diretamente desses mapas — uma fonte de verdade. F7 pode importar `PONTOS_BASE.exato * MULTIPLICADORES.final` pra mostrar "vale até 40 pts" sem reimplementar.

### 3.4 Política de erros

- `classificarPalpite`, `calcularPontosPalpite` lançam `Error('Jogo não finalizado: classificação inválida')` se `jogo.finalizado !== true`. **Caller deve filtrar antes** — input inválido é bug do caller.
- `calcularPontosBonus` aceita `resultados` com campos null (Copa em andamento) e retorna `{ acertou: false, pontos: 0 }` para o tipo correspondente. Estado válido, não erro.
- Inputs nunca são validados com Zod dentro da lib. Validação de form do usuário acontece no boundary (`lib/validators/`); banco já garante constraints (`gols_casa BETWEEN 0 AND 30`, `finalizado boolean NOT NULL`).

---

## 4. Implementação interna

### 4.1 Algoritmo de `classificarPalpite`

```ts
export function classificarPalpite(palpite: PalpiteInput, jogo: JogoInput): ClassePalpite {
  if (jogo.finalizado !== true) {
    throw new Error('Jogo não finalizado: classificação inválida');
  }

  // 1. Placar exato
  if (palpite.gols_casa === jogo.gols_casa && palpite.gols_fora === jogo.gols_fora) {
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
  if (ehEmpate) return 'vencedor'; // Q3-A: empate-não-exato sempre 5 pts

  const saldoReal = jogo.gols_casa - jogo.gols_fora;
  const saldoPalpite = palpite.gols_casa - palpite.gols_fora;
  return saldoReal === saldoPalpite ? 'vencedor_saldo' : 'vencedor';
}

// Helper privado (não exportado).
function sinal(n: number): -1 | 0 | 1 {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}
```

5 caminhos terminais:

- `exato` (curto-circuito)
- `parcial` (errou vencedor + acertou 1 time)
- `erro` (errou vencedor + errou ambos)
- `vencedor` (acertou vencedor, mas é empate OU saldo errado)
- `vencedor_saldo` (acertou vencedor não-empate + saldo idêntico)

### 4.2 Composição `calcularPontosPalpite`

```ts
export function calcularPontosPalpite(palpite: PalpiteInput, jogo: JogoInput) {
  const classe = classificarPalpite(palpite, jogo);
  const base = pontosBase(classe);
  const multiplicador = multiplicadorFase(jogo.fase);
  const total = Math.round(base * multiplicador);
  return { classe, base, multiplicador, total };
}
```

### 4.3 `calcularPontosBonus` com normalização

```ts
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/g, ' ');
}

export function calcularPontosBonus(
  bonus: BonusInput,
  resultados: CopaResultadosInput,
): { acertou: boolean; pontos: number } {
  if (bonus.tipo === 'artilheiro') {
    if (!resultados.artilheiro_nome) return { acertou: false, pontos: 0 };
    const acertou = normalizar(bonus.jogador_nome) === normalizar(resultados.artilheiro_nome);
    return { acertou, pontos: acertou ? PONTOS_BONUS.artilheiro : 0 };
  }

  // bonus.tipo é 'campeao' | 'vice' | 'terceiro' | 'quarto' | 'revelacao'
  // (TS estreita pelo discriminated union)
  const oficialId = {
    campeao: resultados.campeao_id,
    vice: resultados.vice_id,
    terceiro: resultados.terceiro_id,
    quarto: resultados.quarto_id,
    revelacao: resultados.revelacao_id,
  }[bonus.tipo];

  if (oficialId == null) return { acertou: false, pontos: 0 };

  const acertou = bonus.selecao_id === oficialId;
  return { acertou, pontos: acertou ? PONTOS_BONUS[bonus.tipo] : 0 };
}
```

### 4.4 Tabela canônica de exemplos

Estes 15 casos viram testes nomeados no arquivo de testes (com nomes tipo `case 1: placar exato em fase de grupos`). Calibração de regras com casos reais:

| #   | Real | Palpite | Classe         | Base | Fase   | Mult | Total                    |
| --- | ---- | ------- | -------------- | ---- | ------ | ---- | ------------------------ |
| 1   | 2×0  | 2×0     | exato          | 10   | grupos | 1    | 10                       |
| 2   | 2×0  | 3×1     | vencedor_saldo | 7    | grupos | 1    | 7                        |
| 3   | 2×0  | 1×0     | vencedor       | 5    | grupos | 1    | 5                        |
| 4   | 2×0  | 0×2     | erro           | 0    | grupos | 1    | 0                        |
| 5   | 2×0  | 0×0     | parcial        | 2    | grupos | 1    | 2                        |
| 6   | 1×1  | 1×1     | exato          | 10   | grupos | 1    | 10                       |
| 7   | 1×1  | 2×2     | vencedor       | 5    | grupos | 1    | 5 (Q3-A)                 |
| 8   | 1×1  | 0×0     | vencedor       | 5    | grupos | 1    | 5 (Q3-A)                 |
| 9   | 1×1  | 1×0     | parcial        | 2    | grupos | 1    | 2                        |
| 10  | 1×1  | 2×0     | erro           | 0    | grupos | 1    | 0                        |
| 11  | 3×2  | 1×0     | vencedor_saldo | 7    | final  | 4    | 28                       |
| 12  | 3×2  | 3×0     | vencedor       | 5    | final  | 4    | 20                       |
| 13  | 0×0  | 0×0     | exato          | 10   | semis  | 3    | 30                       |
| 14  | 1×0  | 0×0     | parcial        | 2    | 16avos | 1.5  | 3 (Math.round(3.0))      |
| 15  | 2×1  | 3×2     | vencedor_saldo | 7    | 16avos | 1.5  | 11 (Math.round(10.5)=11) |

**Sobre `Math.round` em JS:** comporta-se como round-half-away-from-zero pra positivos (`Math.round(10.5) === 11`, `Math.round(7.5) === 8`). Não usa banker's rounding. Caso #15 documenta esse comportamento.

---

## 5. Migration da view `ranking` com tiebreakers de §3.5

### 5.1 Mudança vs F2

**Tiebreaker chain antiga (F2):**

```
pontos_totais DESC, acertos_exatos DESC, acertos_parciais DESC, numero_bilhete ASC
```

**Tiebreaker chain nova (§3.5):**

```
pontos_totais DESC, acertos_exatos DESC, acertou_campeao DESC, pontos_mata_mata DESC, numero_bilhete ASC
```

`acertos_parciais` é mantido **como coluna de display** (frontend pode mostrar) mas **removido da chain de empate**.

### 5.2 Estratégia: `CREATE OR REPLACE VIEW`

Restrição do Postgres pra `CREATE OR REPLACE VIEW`: as colunas existentes precisam manter ordem, nome e tipo. Novas colunas só podem ser **anexadas no fim**. Casa perfeito porque `pontos_mata_mata` (col 9) e `acertou_campeao` (col 10) são adições puras.

Vantagens vs `DROP VIEW + CREATE VIEW`:

- Preserva grants (`GRANT SELECT ON public.ranking TO anon, authenticated` da F2). Sem precisar re-grantear.
- Sem janela de "view inexistente".
- Diff pequeno.

### 5.3 Arquivo de migration

**Path:** `supabase/migrations/20260430120000_ranking_tiebreakers.sql`

```sql
-- ============================================================================
-- Bolão Copa 2026 — Atualiza view `ranking` com tiebreakers de §3.5
-- ============================================================================
-- Feature 5 (lib/pontuacao + view tiebreakers)
-- Spec: docs/superpowers/specs/2026-04-30-pontuacao-design.md
--
-- Mudanças vs F2:
--   1. Adiciona coluna `pontos_mata_mata` (soma de pontos em jogos com
--      fase <> 'grupos'). Usada no critério #3 de desempate.
--   2. Adiciona coluna `acertou_campeao` (boolean: bilhete tem palpite_bonus
--      tipo='campeao' batendo com copa_resultados.campeao_id). Usada no #2.
--   3. Remove `acertos_parciais` da chain de empate (mantida como display).
--   4. Ordem final: pontos_totais > acertos_exatos > acertou_campeao
--                   > pontos_mata_mata > numero_bilhete ASC
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
  COALESCE(pa.acertos_parciais, 0) AS acertos_parciais,                   -- col 7 (kept como display)
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(pa.pontos_palpites, 0) + COALESCE(ba.pontos_bonus, 0) DESC,
      COALESCE(pa.acertos_exatos, 0) DESC,
      (ch.bilhete_id IS NOT NULL) DESC,            -- §3.5 #2
      COALESCE(pa.pontos_mata_mata, 0) DESC,       -- §3.5 #3
      b.numero_bilhete ASC                         -- §3.5 #4
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

### 5.4 Decisões justificadas

**`(ch.bilhete_id IS NOT NULL)` em vez de boolean nullable:** o LEFT JOIN é a fonte da verdade da existência. PostgreSQL ordena `true > false`, então `DESC` coloca quem acertou primeiro.

**`CROSS JOIN copa_resultados` filtrado por `id = 1`:** copa_resultados é singleton (CHECK constraint da F2). O CROSS JOIN seguido de WHERE deixa explícito "uso o snapshot único do estado atual da Copa".

**Sem índices novos:** view é SELECT em runtime; índices afetam tabelas-base. `palpites(bilhete_id)`, `palpites(jogo_id)`, `palpites_bonus(bilhete_id)`, `bilhetes(status_pagamento)` já existem na F2. Suficiente. Materialização (CLAUDE.md §6) é decisão pós-launch se latência > 500ms — fora desta feature.

**Degradação graciosa pré-Copa:** com `copa_resultados.campeao_id IS NULL`, `campeao_hit` retorna 0 linhas; `acertou_campeao` é `false` pra todos; tiebreaker degrada pra `pontos_mata_mata` → `numero_bilhete`. Coerente com pré-Copa, meio-de-Copa e pós-Copa.

---

## 6. Estratégia de testes

### 6.1 Layout

```
lib/
  pontuacao.ts                          [NOVO — toda a lib em um arquivo]
  __tests__/
    pontuacao.test.ts                   [NOVO — testes da lib TS]

supabase/
  migrations/
    20260430120000_ranking_tiebreakers.sql   [NOVO — Seção 5]
```

Single-file na lib (~150-200 LOC). Quebrar em subarquivos só se passar de ~300. Testes em `__tests__/` (convenção F1-F4).

### 6.2 Quebra de testes por função (alvo: ≥95% cobertura em `lib/pontuacao.ts`)

#### `multiplicadorFase` — 7 testes

Um por fase, batendo o valor exato. Anti-regressão pra mudança acidental do mapa.

#### `pontosBase` — 5 testes

Um por classe (`exato`, `vencedor_saldo`, `vencedor`, `parcial`, `erro`).

#### `classificarPalpite` — 23 testes (coração da lib)

Organizado em `describe` blocks:

- **Placar exato** (4 testes): 0×0, 1×1, 2×0, 3×2.
- **Vencedor + saldo (vitórias)** (4): casa-ganha com saldo +1, +2, +3; fora-ganha com saldo +1.
- **Apenas vencedor não-empate** (4): saldo errado em vitória de casa; saldo errado em vitória de fora; "acertou casa mas saldo errado"; "acertou fora mas saldo errado". Cobre que +2 NÃO acumula.
- **Empate não-exato sempre = vencedor** (3, Q3-A): real 1×1/palpite 2×2; real 0×0/palpite 3×3; real 2×2/palpite 1×1.
- **Parcial (errou vencedor + acertou gols de 1 time)** (4): casa hit, fora hit, vencedor errado em vitória, vencedor errado em empate predito.
- **Erro (errou tudo)** (3): saldo invertido; gols completamente diferentes; empate predito vs vitória real.
- **Precondição** (1): jogo.finalizado=false → throws.

#### `calcularPontosPalpite` — 8 testes (composição + arredondamento)

Cobre os 15 casos da §4.4, com foco em arredondamento:

| #   | Real | Palpite | Fase             | Esperado                  |
| --- | ---- | ------- | ---------------- | ------------------------- |
| 1   | 2×0  | 2×0     | grupos           | 10                        |
| 2   | 3×2  | 1×0     | final            | 28                        |
| 3   | 0×0  | 0×0     | semis            | 30                        |
| 4   | 1×1  | 2×2     | quartas          | 13 (round(5×2.5)=12.5→13) |
| 5   | 2×0  | 0×0     | 16avos           | 3 (round(2×1.5)=3.0→3)    |
| 6   | 1×0  | 0×1     | 16avos           | 0                         |
| 7   | 5×0  | 5×0     | disputa_terceiro | 20                        |
| 8   | 2×1  | 3×2     | 16avos           | 11 (round(7×1.5)=10.5→11) |

Casos 4, 5 e 8 documentam comportamento de `Math.round` em half-up.

#### `calcularPontosBonus` — 12 testes

- **Por tipo com selecao_id (5 tipos × cenário acertou)** (5 testes): campeao/vice/terceiro/quarto/revelacao, cada um com `selecao_id === resultado_id` e pontos cheios.
- **Errou** (1 teste): bate em 1 tipo representativo (ex: campeao) com selecao_id ≠ campeao_id → 0 pts.
- **Resultado null** (1 teste): `resultados.campeao_id = null` → 0 pts (Copa em andamento).
- **Artilheiro com normalização** (5 testes):
  - "Mbappé" === "Mbappé" → acertou
  - "MBAPPE" === "Mbappé" → acertou (case + acento)
  - " Mbappé " === "Mbappé" → acertou (trim)
  - "Kylian Mbappé" === "Kylian Mbappé" → acertou (whitespace colapsado)
  - "Mbappé" === "Kylian Mbappé" → ERROU (sem match parcial — decisão consciente)

### 6.3 Cobertura

`vitest.config.mts` ganha thresholds escopados a `lib/pontuacao.ts`:

```ts
test: {
  // ... config existente
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
```

Não impor threshold global (outras libs já passam mas o compromisso é da F5).

Comandos:

- `pnpm test:run` — passa todos os testes, sem coverage.
- `pnpm test:run --coverage` — gera relatório e enforce threshold.

### 6.4 Verificação da migration

**Não usa pgTAP.** Justificativa: F2 não trouxe infraestrutura de testes SQL e adicionar agora é scope creep. View tem 0 dependentes hoje (F8 ainda não existe), então bugs aparecem cedo no consumidor.

**Checklist de verificação manual** (executado durante a implementação + nas critérias de pronto):

1. `supabase db reset` aplica F2 + F5 sem erro.
2. `supabase db diff --use-migra` retorna vazio depois de aplicar (idempotência).
3. Inspeção das colunas da view:
   ```sql
   SELECT column_name, ordinal_position, data_type
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'ranking'
   ORDER BY ordinal_position;
   ```
   Esperado: 10 colunas; 1-8 idênticas a F2; col 9 = `pontos_mata_mata int`; col 10 = `acertou_campeao bool`.
4. Ranking sem dados: query retorna 0 linhas, sem erro.
5. **Smoke de tiebreaker:** seed manual com 3 bilhetes confirmados, todos com mesmo `pontos_totais` e mesmo `acertos_exatos`. Bilhete A acertou campeão, bilhete B acertou campeão, bilhete C errou. Setar `pontos_mata_mata` distintos via `pontos_calculados` em palpites de fase ≠ grupos. Verificar:
   - A e B aparecem antes de C (acertou_campeao DESC).
   - Entre A e B, quem tem mais `pontos_mata_mata` aparece primeiro.
   - Empate total entre dois → quem tem `numero_bilhete` menor aparece primeiro.

> Item 5 é manual nesta feature. Quando F8 chegar e construir a UI de ranking, vale considerar adicionar Playwright E2E que cobre seed → ranking → display ponta-a-ponta. Aí faz sentido testar a view automatizadamente.

---

## 7. Erros e edge cases

### 7.1 Lib

| Cenário                                                                       | Comportamento                                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `classificarPalpite` chamada com `jogo.finalizado=false`                      | `throw new Error('Jogo não finalizado: classificação inválida')`                                                                                                                                   |
| `calcularPontosPalpite` chamada com `jogo.finalizado=false`                   | mesmo throw (delega pra `classificarPalpite`)                                                                                                                                                      |
| `calcularPontosBonus` para `campeao` com `resultados.campeao_id=null`         | `{ acertou: false, pontos: 0 }` (Copa em andamento, estado válido)                                                                                                                                 |
| `calcularPontosBonus` para `artilheiro` com `resultados.artilheiro_nome=null` | `{ acertou: false, pontos: 0 }` (idem)                                                                                                                                                             |
| Palpite ausente (caller nem chama a lib)                                      | Caller pula; banco não tem row em `palpites` → não soma 0, simplesmente não existe (memory: "palpite ausente vale 0 pts").                                                                         |
| `gols_casa` ou `gols_fora` negativos                                          | Banco rejeita (CHECK ≥ 0). Lib não valida explicitamente, mas o algoritmo opera corretamente com negativos: `sinal` aceita qualquer int, `===` compara qualquer número. Não há caminho que quebre. |
| Empate em `artilheiro` na vida real                                           | Admin escolhe um nome canônico. Schema é `text` singular; sem mudança.                                                                                                                             |
| Match parcial em artilheiro ("Mbappé" vs "Kylian Mbappé")                     | NÃO bate (sem startsWith/contains). Decisão consciente: front-end da F7 oferece dropdown de ~30 nomes prováveis pra evitar typos.                                                                  |

### 7.2 Migration

| Cenário                                             | Comportamento                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Pré-Copa (`copa_resultados.campeao_id=null`)        | `campeao_hit` CTE retorna 0 linhas; `acertou_campeao=false` pra todos; tiebreaker degrada pra `pontos_mata_mata` → `numero_bilhete`. |
| Bilhete sem palpites de mata-mata ainda             | `pontos_mata_mata=0`; entra no tiebreaker normalmente.                                                                               |
| Bilhete sem palpite_bonus de tipo='campeao'         | `acertou_campeao=false`. LEFT JOIN com `campeao_hit` retorna NULL → `(IS NOT NULL) = false`.                                         |
| Múltiplas palpites de tipo='campeao' por bilhete    | Constraint UNIQUE(bilhete_id, tipo) na F2 já impede.                                                                                 |
| Bilhete em status `pendente`/`expirado`/`cancelado` | Filtrado pelo WHERE da view (`status_pagamento = 'confirmado'`). Não aparece no ranking.                                             |

---

## 8. O que **não** entra na Feature 5

- **Edge Function de recálculo** (`recalcular-pontuacao`). É da F10 (admin → entrada de resultados → recalc). F5 só fornece a lib que F10 vai importar.
- **UI de palpites / preview de pontos.** F7. Consome `PONTOS_BASE` e `MULTIPLICADORES` exportados, mas tela e componentes vivem na F7.
- **UI de ranking.** F8. Consome a view atualizada nesta feature.
- **Recálculo automático via DB trigger.** Decisão de F10 (admin manual em vez de trigger).
- **Materialized view do ranking.** Só vira escopo se latência > 500ms em prod (`CLAUDE.md` §6).
- **Infraestrutura de testes SQL (pgTAP, supabase/tests/).** Scope creep; pode entrar com F8/E2E.
- **Lógica de "campeão decidido nos pênaltis".** Lib não sabe nem precisa: usa `gols_casa/fora` literalmente. Convenção do admin (regulamentar + prorrogação, sem pênaltis no placar) vai pra F10 documentar nas instruções de entrada.
- **Pontuação de empates múltiplos no artilheiro.** FIFA nomeia um oficial; admin entra esse. Schema singular.
- **Validação Zod de inputs da lib.** Boundary validation acontece em `lib/validators/` quando vier do form; banco já enforce constraints de range.
- **Atualização de outras tabelas** ou triggers além da view.

---

## 9. Critérios de pronto

- [ ] `lib/pontuacao.ts` contém todas as 5 funções públicas (`classificarPalpite`, `pontosBase`, `multiplicadorFase`, `calcularPontosPalpite`, `calcularPontosBonus`) + 3 constantes (`PONTOS_BASE`, `MULTIPLICADORES`, `PONTOS_BONUS`) + os 6 tipos exportados (`FaseJogo`, `TipoBonus`, `PalpiteInput`, `JogoInput`, `BonusInput`, `CopaResultadosInput`, `ClassePalpite`).
- [ ] `lib/__tests__/pontuacao.test.ts` cobre todas as classes da matriz com **≥95%** de linhas, branches, functions e statements em `lib/pontuacao.ts`.
- [ ] Os 15 casos canônicos da §4.4 estão presentes como testes nomeados, distribuídos: cases 1-10 (todos em `grupos`, sem multiplicador) ficam dentro dos `describe` de `classificarPalpite`; cases 11-15 (com multiplicador) ficam dentro dos testes de `calcularPontosPalpite`.
- [ ] `supabase/migrations/20260430120000_ranking_tiebreakers.sql` aplica em DB limpo + por cima de F2 sem erro.
- [ ] `supabase db reset` rebuilda do zero com sucesso.
- [ ] Inspeção das 10 colunas da view (`information_schema.columns`) confirma: 1-8 preservadas; col 9 = `pontos_mata_mata int`; col 10 = `acertou_campeao bool`.
- [ ] Smoke manual de tiebreaker (3 bilhetes empatados em `pontos_totais` e `acertos_exatos`) verifica que `acertou_campeao` separa corretamente, depois `pontos_mata_mata`, depois `numero_bilhete`.
- [ ] `pnpm test:run` passa.
- [ ] `pnpm test:run --coverage` passa o threshold escopado a `lib/pontuacao.ts`.
- [ ] `pnpm typecheck` passa sem `any` ou `as unknown`.
- [ ] `pnpm lint` passa sem warnings.

---

## 10. Riscos e mitigações

### 10.1 Drift entre `FaseJogo` da lib e `Database['public']['Enums']['fase_jogo']`

**Risco:** se alguém adicionar uma fase no enum do banco (ex: `disputa_quinto`), a lib continua compilando mas perde caso na função `multiplicadorFase`. F10 chamaria com o novo valor, daria `undefined` em runtime.

**Mitigação:** `multiplicadorFase` é tipada `(fase: FaseJogo) => 1 | 1.5 | 2 | 2.5 | 3 | 4`. TS força cobrir todos os literais quando o `MULTIPLICADORES` é mapped. Adicionar fase nova no enum do banco sem atualizar a lib quebraria o typecheck no caller (F10) que importa `Database` types — falha precoce. Aceitável.

### 10.2 `Math.round` half-up vs banker's rounding

**Risco:** ambiguidade do que é "round" pode gerar discussão futura ("por que ganhei 11 e não 10 em 16avos com 7 base?").

**Mitigação:** documentado em §4.4 que `Math.round` em JS é half-away-from-zero (10.5 → 11, 7.5 → 8). Caso #8 e #15 são testes explícitos. Valor é determinístico e auditável.

### 10.3 Mudança no schema de `palpites_bonus` invalidando o discriminated union

**Risco:** se algum dia `palpites_bonus` ganhar um terceiro shape (ex: `tipo='outro'` com payload diferente), a lib não compila mais.

**Mitigação:** o schema da F2 é estável; mudanças exigem migration explícita + atualização da lib em paralelo. O TS detecta drift no momento da escrita do migration. Aceitável.

### 10.4 Ranking degradado pré-Copa parecendo "errado" pro usuário

**Risco:** pré-Copa, todo mundo tem `acertou_campeao=false` e `pontos_mata_mata=0`. Ranking fica decidido só por `numero_bilhete ASC` em caso de empate. Pode parecer "ranking aleatório" pra quem não sabe.

**Mitigação:** UI da F8 (não nesta feature) deve explicitar copy do tipo "Ranking se atualiza ao longo da Copa". Aqui na F5 só garantimos que a view não quebra e degrada com sentido. Documentado em §7.2.

### 10.5 Empate em `numero_bilhete`

**Risco:** `numero_bilhete` é `serial UNIQUE` na F2. Não há empate possível no fallback final.

**Mitigação:** já garantido pelo schema. Sem ação adicional.

---

## 11. Próximos passos

1. **Self-review do spec** (placeholders, contradições, ambiguidade, escopo) — feito inline antes da entrega.
2. **Aprovação do user** sobre o spec escrito.
3. **Invocar `writing-plans`** pra gerar o plano de implementação detalhado.
4. **Worktree separado** + execução via `executing-plans` com checkpoints.

---

**Vamos sempre à luta.** ⚽🏆
