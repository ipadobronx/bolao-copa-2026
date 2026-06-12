# Design — Card modal de perfil no ranking (gerar debate)

**Data:** 2026-06-12
**Status:** aprovado (brainstorming)

## Contexto

Bolão de amigos. O dono quer poder "espiar" um apostador direto do ranking pra gerar
zoeira/debate no grupo. Já existe uma página de perfil público (`/ranking/[bilhete]`,
`PerfilPublico`) mostrando posição/pontos/exatos/cashback, mas ela está **órfã** (o nome
no ranking não é clicável) e **sem a parte divertida**. Em vez de reusar a página,
optou-se por um **card modal** (espiar rápido, sem sair do ranking).

## Escopo

### Gatilho
Clicar **somente na bolinha do avatar** (o círculo com as iniciais) de uma linha do
ranking abre um modal. **Não** no nome nem na linha inteira — isso evita abrir o card
sem querer ao arrastar/rolar a lista. O avatar vira `<button>` (mesma aparência), com
`aria-label="Ver perfil de <nome>"` e `cursor-pointer`. (Escopo: linhas da **tabela** do
ranking; o pódio fica de fora desta versão.)

### Conteúdo do card
- **Topo:** avatar + nome + **selo de desempenho** (emoji + título) + posição.
- **Resumo:** pontos · acertos exatos · **form dos últimos 5** (reusa `FormaDots`).
- **Palpites de bônus:** 🏆 campeão (bandeira + nome) · ⚽ artilheiro (nome). *(o
  combustível de treta)*

### Selo de desempenho — por percentil no ranking
Função pura `tituloDesempenho(posicao, total)` → `{ emoji, label }`:
- top 10%   → 🧙 **Bruxo**
- top 33%   → 🔥 **Embalado**
- meio      → 😎 **Na média**
- fundo 33% → 🥶 **Pé-frio**
- fundo 10% → 🤡 **Chutador**

(Percentil é robusto mesmo com poucos jogos. `total` = total de apostadores.)

## Arquitetura

- **Reuso:** posição, pontos, acertos exatos e `forma` já estão em `RankingRowData`.
  Adiciona-se `melhorBilheteId` à linha (vem de `ranking_usuarios.melhor_bilhete_id`),
  para buscar os bônus.
- **Modal único** no `RankingShell` (client): mantém o estado `selecionado` e renderiza
  `<PerfilModal>` quando aberto. As linhas chamam um callback `onAbrirPerfil(rowData)`
  passado por props: `RankingShell → RankingTabGeral → RankingTable → RankingRow`. O
  `RankingShell` também passa `totalApostadores` para o cálculo do selo.
- **Bônus:** buscados ao abrir o modal via `GET /api/perfil/[bilheteId]`, que retorna
  `{ campeao: { nome, bandeira } | null, artilheiro: string | null }` lendo
  `palpites_bonus` (tipos `campeao`/`artilheiro`) do bilhete + join `selecoes`. Usa o
  cliente **service_role** no servidor (bônus já são públicos pós-início, mas o
  service_role evita qualquer questão de RLS). Estado de loading no card.
- **Selo:** calculado no cliente via `tituloDesempenho(posicao, totalApostadores)`.

### Arquivos
- Criar `lib/ranking/titulo.ts` — `tituloDesempenho` (pura) + tipo `Selo`.
- Criar `lib/ranking/__tests__/titulo.test.ts`.
- Criar `components/ranking/PerfilModal.tsx` — Radix Dialog; recebe os dados da linha +
  `totalApostadores`; faz fetch dos bônus on-open; reusa `FormaDots`.
- Criar `app/api/perfil/[bilheteId]/route.ts` — bônus do bilhete.
- Modificar `components/ranking/RankingRow.tsx` — avatar vira botão; novo prop
  `onAbrirPerfil`; `RankingRowData += melhorBilheteId?: string | null`.
- Modificar `RankingTable.tsx`, `RankingTabGeral.tsx`, `RankingShell.tsx` — passar
  `onAbrirPerfil` (+ `totalApostadores`) e montar o modal.
- Modificar `app/(dashboard)/ranking/page.tsx` e `app/api/ranking/route.ts` — anexar
  `melhorBilheteId` às linhas.

## Testes
- **Unit:** `tituloDesempenho` — cada faixa de percentil (topo/fundo/meio, bordas 10%/33%).
- **Component:** `PerfilModal` renderiza nome/selo/form e os bônus após o fetch (mock).
- Regressão: testes atuais de `RankingRow` seguem passando (campos/props novos opcionais).

## Fora de escopo
- "Maior cravada / pior vacilo" (não escolhido).
- Abrir o modal a partir do **pódio** (só a tabela por ora).
- A página `/ranking/[bilhete]` existente fica como está (não é tocada).
