# Design — Painel "Palpites do jogo" na dashboard

**Data:** 2026-06-16
**Status:** aprovado (brainstorming + preview visual)

## Contexto

Inspirado num concorrente: por jogo, mostrar a **tendência** (% mandante/empate/visitante),
os **3 placares mais palpitados** e, depois que o jogo trava, o **palpite de cada apostador**.
Gera muito debate no grupo. Não temos "superpoderes" — essa parte fica de fora.

Layout escolhido no preview visual: dois cards **empilhados** (mobile-first), **Jogo atual em
cima** e **Próximo jogo embaixo**.

## Escopo

### Os dois jogos (par rolante)
- **Jogo atual** = o jogo travado mais recente (`data_hora <= now`, maior data_hora).
- **Próximo jogo** = o próximo a acontecer (`data_hora > now`, menor data_hora).
Quando o próximo trava, ele naturalmente vira o "atual" na próxima carga da página; o antigo
sai do painel (sem arquivo navegável nesta versão — o histórico de cada pessoa já está no
modal do ranking).

### Base de contagem: a tabela do ranking de cada pessoa (1 voto/pessoa)
Tendência, placares e lista usam o **melhor bilhete** de cada usuário
(`ranking_usuarios.melhor_bilhete_id`). Assim os três batem e quem tem várias tabelas não
"pesa" mais. O badge mostra o total = nº de pessoas que palpitaram aquele jogo na sua tabela
do ranking.

### Card "Jogo atual" (travado)
- Confronto com **bandeiras** (`BandeiraImg` a partir de `selecoes.bandeira_emoji`) + badge
  "N palpites".
- **Tendência** em barras: mandante / empate / visitante (contagem → %).
- **3 placares mais palpitados** em chips (`gc×gf (count)`).
- **Lista de cada apostador**, ordenada pela posição no ranking (líder no topo, selo
  "★ ranking"): avatar (iniciais) + nome + palpite `gc×gf`; quando o jogo **finalizar**,
  acrescenta o resultado real + pontos. Lista colapsada por padrão (primeiros 6) com botão
  **"Ver todos os N palpites"** (expande inline; vira "Ver menos") — evita dominar a dashboard
  e evita scroll-aninhado no mobile.

### Card "Próximo jogo" (ainda não travado)
- Confronto com bandeiras + "trava em Xh" (usa `lib/dashboard/countdown`).
- **Mesma tendência + 3 placares** — **anônimo** (pode revelar, ninguém sabe quem foi).
- **Sem lista individual:** no lugar, um aviso "🔒 O palpite de cada um aparece quando o jogo
  travar."

### Privacidade
- Os palpites são privados até o apito de cada jogo (RLS `palpites_select_own_or_started`).
- O agregado do **próximo** jogo é calculado no servidor com o **cliente service_role**
  retornando **só números** (tendência/placares/total) — **nunca** linhas individuais. A lista
  individual só é montada para o jogo **já travado**. Assim não vaza quem palpitou o quê antes
  do apito.

## Arquitetura / arquivos

- **Criar** `lib/dashboard/resumo-jogo.ts` — função pura `resumoPalpites(palpites)` +
  tipos. Recebe `{ gols_casa, gols_fora }[]` e retorna:
  ```ts
  type Tendencia = { casa: number; empate: number; fora: number } // contagens
  type Placar = { gc: number; gf: number; count: number }
  type ResumoPalpites = { total: number; tendencia: Tendencia; topPlacares: Placar[] } // top 3
  ```
  Vencedor por `sign(gc - gf)` (casa/empate/fora). `topPlacares` = 3 mais frequentes (desempate
  por contagem desc, depois `gc` desc, `gf` desc, determinístico).
- **Criar** `lib/dashboard/resumo-jogo.test.ts` — testes da pura.
- **Criar** `lib/dashboard/palpites-do-jogo.ts` — `montarPalpitesDoJogo(admin)` (server-only,
  usa `createSupabaseAdminClient`): acha atual + próximo; pega os `melhor_bilhete_id` de
  `ranking_usuarios` (com `nome`, `user_id`, `posicao`); para cada jogo lê os palpites desses
  bilhetes; usa `resumoPalpites`; monta a lista individual **só pro atual**. Retorna
  `{ atual: JogoResumo | null; proximo: JogoResumo | null }` com:
  ```ts
  type PalpitePessoa = { userId: string; nome: string; gc: number; gf: number; isLider: boolean }
  type JogoResumo = {
    numeroJogo: number; dataHora: string
    casa: string; fora: string; bandeiraCasa: string | null; bandeiraFora: string | null
    finalizado: boolean; realCasa: number | null; realFora: number | null
    total: number; tendencia: Tendencia; topPlacares: Placar[]
    palpites: PalpitePessoa[] | null   // null no próximo (privado)
  }
  ```
- **Criar** `components/dashboard/JogoResumoCard.tsx` (client — tem o estado "Ver todos"):
  recebe `JogoResumo` + flag `proximo` (bool). Renderiza badge/confronto/bandeiras, barras de
  tendência (% = count/total), chips de placares, e a lista (ou lockbox+countdown no próximo).
- **Criar** `components/dashboard/PalpitesDoJogoPanel.tsx` — layout dos dois cards (atual em
  cima, próximo embaixo; lado a lado em `sm+`). Esconde um card que não existir.
- **Modificar** `app/(dashboard)/dashboard/page.tsx` — chamar `montarPalpitesDoJogo` e
  renderizar `<PalpitesDoJogoPanel ... />` (posição: logo abaixo dos cards de stat, acima/junto
  do "Próximos jogos"; ajustar no plano após ver o render atual).

## Testes
- **Unit `resumoPalpites`:** tendência conta casa/empate/fora certo; `%` derivável; `topPlacares`
  pega os 3 mais frequentes com desempate determinístico; lista vazia → `{ total:0, ... }`.
- **Component `JogoResumoCard`:** card "atual" renderiza tendência, chips, e a lista (com "Ver
  todos" quando > 6); card "próximo" (`proximo` + `palpites:null`) renderiza o lockbox e **não**
  renderiza nomes. Bandeiras via `BandeiraImg`.
- **Privacidade (revisão):** garantir que `montarPalpitesDoJogo` nunca preenche `palpites` no
  `proximo`.

## Fora de escopo
- Arquivo navegável de jogos antigos; atualização em tempo real (atualiza ao carregar a página);
  superpoderes; mexer no /ranking ou na tela /jogos.
