# Design — "Palpitar" direto no jogo + painel preto

**Data:** 2026-06-16
**Status:** aprovado (brainstorming)

## Contexto

Dois ajustes:
1. O painel "Palpites do jogo" (dashboard) usa `bg-bg-card`; o usuário quer o **mesmo preto
   do ranking** (`bg-[#08080a]` + borda `border-[#1b1b1e]`).
2. O botão **"Palpitar"** dos "Próximos jogos" leva a um **404**: `JogoRow` linka
   `/palpites/<id-do-jogo>`, mas a rota `/palpites/[bilheteId]` espera o id do **bilhete**.
   Além de consertar, o usuário quer cair **direto no jogo** (a lista de grupos ficou difícil
   de achar conforme as rodadas avançam) e, com várias tabelas, escolher qual.

## Escopo

### 1. Cor do painel "Palpites do jogo"
No `JogoResumoCard`, trocar `bg-bg-card border-border` por `bg-[#08080a] border-[#1b1b1e]`
(mesma cor das placas do ranking). Só isso.

### 2. Botão "Palpitar" (Próximos jogos)
Novo componente client `PalpitarButton` (usado pelo `JogoRow`), recebe `jogoId` e a lista de
tabelas confirmadas do usuário `tabelas: { id: string; numero: number; pontos: number }[]`:
- **0 tabela** → link pra `/comprar`.
- **1 tabela** → link pra `/palpites/<bilheteId>?jogo=<jogoId>`.
- **2+ tabelas** → abre um **modal minimalista** (Radix Dialog) listando cada tabela
  (`Tabela nº<numero> · <pontos> pts`); cada item é um link pra
  `/palpites/<bilheteId>?jogo=<jogoId>`.
Mantém o estado **TBD** atual (jogo sem times definidos → "Palpitar" desabilitado).

### 3. Deep-link "direto no jogo" (`?jogo=<jogoId>`)
- `app/(dashboard)/palpites/[bilheteId]/page.tsx` lê `searchParams.jogo` e passa
  `targetJogoId: number | null` ao `PalpitesShell`.
- **Helper puro** `tabDoJogo(fase): TabKey` (em `lib/palpites`): `grupos` → `'grupos'`;
  fases de mata-mata (`16avos`…`final`) → a própria fase; `disputa_terceiro` incluso; senão
  `'grupos'`. Testável.
- `PalpitesShell`: se houver `targetJogoId` e o jogo existir, a aba inicial vem de
  `tabDoJogo(jogo.fase)` (sobrepõe `initialTab`). Passa `targetJogoId` para `GruposTab` e
  `FaseTab`.
- `GruposTab`: se o jogo-alvo for de grupos, o `activeGrupo` inicial é o grupo que contém o
  jogo (acha pela `groupGamesByGrupo`). Marca a `MatchRow` do alvo com `destacado`.
- `FaseTab`: marca a `MatchRow` do alvo com `destacado`.
- `MatchRow`: ganha `id="jogo-<jogo.id>"` (âncora) e prop `destacado?: boolean`; quando
  `destacado`, ao montar faz `scrollIntoView({ behavior: 'smooth', block: 'center' })` e
  aplica uma classe de destaque (ring amarelo) por ~3s.

### Dados (dashboard)
A `dashboard/page.tsx` busca os pontos das tabelas confirmadas do usuário na view `ranking`
(`.in('bilhete_id', idsConfirmados).select('bilhete_id, numero_bilhete, pontos_totais')`),
monta `tabelas: {id,numero,pontos}[]` (ordenado por `numero`), e passa para
`ProximosJogosPanel` → `JogoRow` → `PalpitarButton`. Vale nos 3 estados que renderizam o
painel (pendente-puro → tabelas=[] → "Palpitar" vai pra /comprar; pré-copa; em-andamento).

## Arquitetura / arquivos
- **Modificar** `components/dashboard/JogoResumoCard.tsx` — cor preta.
- **Criar** `components/dashboard/PalpitarButton.tsx` (client) — link/modal por nº de tabelas.
- **Modificar** `components/dashboard/JogoRow.tsx` — usar `PalpitarButton`; novo prop `tabelas`.
- **Modificar** `components/dashboard/ProximosJogosPanel.tsx` — repassar `tabelas`.
- **Modificar** `app/(dashboard)/dashboard/page.tsx` — buscar pontos das tabelas + repassar.
- **Modificar** `lib/palpites.ts` (ou onde ficam os helpers de palpites) — `tabDoJogo` + tipo.
- **Modificar** `app/(dashboard)/palpites/[bilheteId]/page.tsx` — ler `?jogo=`.
- **Modificar** `components/palpites/PalpitesShell.tsx` — aba inicial via alvo + repassar.
- **Modificar** `components/palpites/GruposTab.tsx` — grupo inicial + `destacado`.
- **Modificar** `components/palpites/FaseTab.tsx` — `destacado`.
- **Modificar** `components/palpites/MatchRow.tsx` — âncora `id` + scroll/destaque.

## Testes
- **Unit `tabDoJogo`:** grupos→'grupos'; cada fase de mata-mata→a fase; default→'grupos'.
- **Component `PalpitarButton`:** 1 tabela → renderiza link `/palpites/<id>?jogo=<jogoId>`;
  2+ → renderiza botão que abre o modal com as opções (cada uma com pontos); 0 → link
  `/comprar`.
- **Regressão:** testes atuais de `JogoRow`/dashboard seguem verdes (prop `tabelas` opcional
  com default `[]`).

## Fora de escopo
- Mudar a lógica de autosave dos palpites.
- "Palpitar" em jogo já travado (continua só nos próximos jogos).
- Realtime.
