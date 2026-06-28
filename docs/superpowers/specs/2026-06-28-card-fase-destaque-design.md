# Design — Card "Fase Atual" (destaque de multiplicador no dashboard)

**Data:** 2026-06-28
**Feature:** Card de destaque no dashboard que anuncia a fase atual da Copa e o multiplicador de pontos vigente (ex.: "16-avos · 1.5×").

## Objetivo

Comunicar de forma chamativa que, ao entrar no mata-mata, **cada acerto vale mais** (16avos 1.5×, oitavas 2×, … final 4×). É um destaque celebratório/informativo, não uma tabela. Atualiza sozinho conforme a Copa avança e some na fase de grupos (1×) e após o fim da Copa.

## Decisões de produto (aprovadas)

- **Conteúdo:** destaque grande e direto, focado em "agora vale Nx" (Opção A do brainstorming). Sem escada de fases.
- **Posição:** topo do dashboard, no estado "Copa em andamento", **antes** dos cards de stats (`CardPontos`/`CardPosicao`/`CardProgresso`).
- **Visibilidade:** só no mata-mata (multiplicador > 1). Oculto em grupos e quando não há fase ativa.
- **Detecção de fase:** automática.

## Arquitetura

Três unidades, cada uma com responsabilidade única. Máximo reaproveitamento — nenhuma lógica/valor duplicado.

### 1. Helper puro — `lib/dashboard/fase-destaque.ts`

```ts
import { MULTIPLICADORES, type FaseJogo } from '@/lib/pontuacao'

export type FaseDestaque = {
  titulo: string        // "16avos de final"
  multiplicador: number // 1.5
  multiplicadorLabel: string // "1.5×"
  gradient: string      // classes Tailwind, espelhando a landing
}

// Rótulos e gradientes por fase de mata-mata. Os gradientes espelham
// PHASES de components/landing/PontuacaoSection.tsx (paridade visual).
// LABEL_FASE de lib/ranking.ts é privado; replicamos só as fases de
// mata-mata aqui para manter o helper autocontido e testável.

export function faseDestaque(fase: string): FaseDestaque | null
```

**Contrato:**
- Recebe a `periodoKey` de `determinarPeriodoAtual` (ou uma `FaseJogo`).
- `multiplicador = MULTIPLICADORES[fase]` — **fonte única** (`lib/pontuacao.ts`). Se `undefined` ou `<= 1` → retorna `null` (cobre `grupos`, `grupos_r1/2/3` e qualquer chave inesperada).
- `multiplicadorLabel`: formata sem zeros à toa (`1.5×`, `2×`, `2.5×`, `3×`, `4×`).
- `titulo`/`gradient`: mapas internos `Record<FaseJogo, string>` cobrindo as 6 fases de mata-mata (`16avos`, `oitavas`, `quartas`, `semis`, `disputa_terceiro`, `final`).
- **Depende de:** `MULTIPLICADORES`, `FaseJogo` (pontuacao.ts). Sem I/O. 100% testável.

Multiplicadores (de `MULTIPLICADORES`, referência): 16avos 1.5 · oitavas 2 · quartas 2.5 · semis 3 · disputa_terceiro 2 · final 4.

### 2. Componente visual — `components/dashboard/CardFaseDestaque.tsx`

Server Component puro (sem `'use client'`). Props = `FaseDestaque`. Não busca dados.

**Layout (mobile-first, dark + accent amarelo):**
- Card largura total, `rounded-2xl`, borda/realce amarelo (`border-accent/30` + leve glow via `shadow`/gradiente sutil) pra parecer novidade.
- Linha 1: `⚡ FASE ATUAL` — `lucide-react` `Zap`, texto `text-[11px] uppercase tracking-wider text-text-muted font-mono`.
- Linha 2: **título da fase** em `font-display` (Bebas Neue), grande (`text-3xl`/`clamp`).
- Linha 3: `pontos valendo` + **`{multiplicadorLabel}`** em destaque amarelo grande (`font-mono`, `text-accent`, `tabular-nums`).
- Linha 4 (subtítulo): "Mata-mata: cada acerto vale mais. Capricha no palpite!" — `text-text-muted text-xs/sm`.
- O `gradient` pode tingir um detalhe (faixa/borda/ícone) pra ecoar a fase, igual à landing.

**Depende de:** `lucide-react`, tokens do `globals.css`. Renderizável isolado em teste.

### 3. Integração — `app/(dashboard)/dashboard/page.tsx`

- Adicionar uma query leve à Fase 1 (`Promise.all`): `supabase.from('jogos').select('id, fase, data_hora, finalizado')` (104 linhas, baratas).
- `const periodo = determinarPeriodoAtual(jogosTodos)` (reusa `lib/ranking.ts`).
- `const destaque = periodo ? faseDestaque(periodo.periodoKey) : null`.
- No bloco `estado.kind === 'em-andamento'`, renderizar **antes** do grid de stats:
  ```tsx
  {destaque && <CardFaseDestaque {...destaque} />}
  ```
- Não aparece em outros estados (sem-bilhete, pendente, pré-copa) — coerente com "Copa em andamento".

## Data flow

```
jogos (id, fase, data_hora, finalizado)
  → determinarPeriodoAtual()  [lib/ranking.ts, reuso]
      → periodoKey ('16avos' | 'oitavas' | ... | 'grupos_rN')
        → faseDestaque(periodoKey)  [novo, puro]
            → null (grupos / sem multiplicador)  → card oculto
            → { titulo, multiplicador, multiplicadorLabel, gradient } → <CardFaseDestaque/>
```

## Error handling / edge cases

- Query de jogos falha ou vazia → `determinarPeriodoAtual` retorna `null` → sem card (degrada silencioso, dashboard segue).
- Fase de grupos → `faseDestaque` retorna `null` → sem card.
- Copa encerrada (todos finalizados): `determinarPeriodoAtual` cai no fallback (última fase finalizada = `final`) → card mostraria "Final · 4×". **Decisão:** aceitável (a Copa acabou de terminar); quando `copa_resultados.finalizada` o dashboard já muda de estado. Não tratamos especialmente nesta feature (YAGNI).

## Testes

- `lib/dashboard/__tests__/fase-destaque.test.ts`:
  - `grupos` e `grupos_r2` → `null`.
  - chave inesperada → `null`.
  - cada fase de mata-mata → `titulo`, `multiplicador` e `multiplicadorLabel` corretos.
  - confirma que o número vem de `MULTIPLICADORES` (ex.: igualdade com `MULTIPLICADORES['16avos']`).
- `components/dashboard/__tests__/CardFaseDestaque.test.tsx`:
  - renderiza título, `multiplicadorLabel` e o subtítulo.

## Não-escopo (YAGNI)

- Sem escada de fases / barras de progresso (é a Opção B, descartada).
- Sem animação/confete.
- Sem tratamento especial de pós-Copa além do estado já existente do dashboard.
- Sem extrair um mapa de gradientes compartilhado com a landing (replicação pontual dos 6 gradientes de mata-mata basta; refactor maior seria fora de escopo).
