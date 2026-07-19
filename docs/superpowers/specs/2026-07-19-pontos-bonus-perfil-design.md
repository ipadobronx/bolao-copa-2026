# Design — Pontos ganhos nos palpites de bônus (perfil público)

**Data:** 2026-07-19 · **Status:** aprovado no brainstorming (Antônio)

## Contexto

No modal de perfil público do ranking (`PerfilModal`), a seção "Palpites de bônus" mostra
bandeira + nome da seleção (ou nome do artilheiro), mas não mostra quantos pontos aquele
palpite rendeu. A seção "Palpites nos jogos" já mostra (`· +8` em amarelo). Com a Copa
encerrada e os bônus computados, o usuário quer ver o ganho de cada bônus ali.

Estado atual do banco: `copa_resultados` tem campeão/vice/3º/4º/artilheiro definidos;
`revelacao_id` ainda **null** (admin não definiu) e `finalizada=false`. Os
`palpites_bonus.pontos_calculados` já estão recalculados (via
`scripts/registra-resultado-final.mjs`).

## Decisão de exibição (escolhida pelo usuário)

- Acertou → badge amarelo `+50` / `+30` / `+25` / `+15`.
- Errou → badge cinza `+0`.
- Resultado oficial ainda não definido (revelação hoje) → **sem badge**, pra não parecer
  erro antes da hora. Quando o admin definir, o badge aparece sem novo deploy.

## Mudanças (2 arquivos + teste)

### 1. `app/api/perfil/[bilheteId]/route.ts`

- Incluir `pontos_calculados` no select de `palpites_bonus`.
- Buscar `copa_resultados` (id=1) uma vez por request.
- Para cada tipo de bônus, expor `pontos: number | null` no payload:
  - campo oficial correspondente definido (`campeao_id`, `vice_id`, `terceiro_id`,
    `quarto_id`, `artilheiro_nome`, `revelacao_id`) → `pontos = pontos_calculados ?? 0`;
  - campo oficial null → `pontos = null`.
- Shapes novos no payload: `BonusSel = { nome, bandeira, pontos: number | null }` e
  `artilheiro: { nome: string, pontos: number | null } | null` (antes era `string | null`).
- A regra "só mostra depois do resultado oficial" fica no servidor; o client é burro.

### 2. `components/ranking/PerfilModal.tsx`

- Atualizar os types locais (`BonusSel`, `PerfilData.artilheiro`).
- Ao lado do nome em cada linha de bônus (incluindo artilheiro e revelação), renderizar
  badge `+{pontos}` em `font-mono`, seguindo o padrão do `+8` dos jogos:
  - `pontos > 0` → `text-accent` (amarelo);
  - `pontos === 0` → `text-text-muted` (cinza);
  - `pontos === null` → não renderiza nada.

### 3. `components/ranking/__tests__/PerfilModal.test.tsx`

Cobrir os três estados: acerto (+50 amarelo), erro (+0 cinza), pendente (sem badge).

## Fora de escopo

- `BonusTab` (página de palpites do próprio bilhete) segue sem pontos.
- Nenhuma mudança de banco/migration — `pontos_calculados` já existe e está preenchido.

## Riscos

- Nenhum relevante: mudança aditiva no payload da API (campo novo), sem breaking change
  pra outros consumidores (a rota só é usada pelo `PerfilModal`).
