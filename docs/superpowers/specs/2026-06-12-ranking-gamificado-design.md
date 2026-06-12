# Design — Ranking gamificado (fase 1)

**Data:** 2026-06-12
**Status:** aprovado (brainstorming)

## Contexto

O ranking hoje é funcional mas "seco" (posição, avatar de iniciais, pontos). O dono
quer deixá-lo mais divertido e premium para aumentar engajamento durante a Copa:
badges de emoji pelo desempenho recente, escudo do clube do coração para os
destaques, e confete no pódio. Esta é a **fase 1** — três adições focadas, sem
redesign visual completo (parkeado).

## Escopo

### A) Emoji ao lado da pontuação (1 por tabela)

Cada linha do ranking ganha **um** emoji, calculado no **último jogo finalizado da
Copa** (o mesmo jogo para todos → cria um momento coletivo "como você foi no jogo de
agora").

Mapeamento pela **classe do acerto** (não pelo número cru de pontos — assim funciona
no mata-mata, onde há multiplicador). Reusa `classificarPalpite` de `lib/pontuacao.ts`,
que já retorna a classe:

| Classe (`ClassePalpite`) | Emoji |
|---|---|
| `exato` | 🔥 |
| `vencedor_saldo` | 👍 |
| `vencedor` | 😭 |
| `parcial` | 😭 |
| `erro` **ou sem palpite no jogo** | 🦄 |

**💎 do dia (override):** se a tabela somou **≥ 25 pontos no dia** (soma de
`pontos_calculados` de todos os jogos finalizados naquele dia), mostra **💎** no lugar
do emoji do último jogo. Limiar `25` é constante tunável.

- **"O dia"** = a data (America/Sao_Paulo) do último jogo finalizado. A soma considera
  todos os jogos finalizados nessa mesma data.
- **Sem jogo finalizado ainda** (início da Copa): nenhum emoji (estado neutro).
- **Realtime:** o ranking já refaz via `/api/ranking` em sinal de realtime; ao
  finalizar um jogo, o emoji de todos atualiza junto.

### B) Escudo do clube do coração (curado, top-5)

- Novo campo `clube` em `profiles` (`text`, nullable; slug ex. `nautico`,
  `corinthians`). **Sem tela de admin** — o dono passa a lista no chat e o valor é
  setado via SQL (mesmo fluxo manual da sessão).
- O "top-5 em algum momento" é **curadoria do dono** (ele só passa clube de quem foi
  top-5). O código não checa posição — escudo aparece para quem tiver `clube` setado.
- Assets: SVG/PNG pequenos em `public/escudos/<slug>.{svg|png}`. Mapa
  `slug → { nome, arquivo }` em código (ex. `lib/escudos.ts`).
- **Render:** escudinho (~18–20px) **ao lado do nome** (mantém o avatar de iniciais).
  *(Alternativa considerada — substituir o avatar — descartada por ora; revisitar.)*
- **Risco:** logos de clube são marca registrada; em escala pequena/privada é
  baixo risco, decisão consciente do dono.

**Lista atual:** Bruno daniel barbosa dos santos → Náutico · Baxola → Náutico ·
Gladystone → Corinthians. **Pendente:** João Philippe (`philippe99thay@gmail.com`) e
Tshabalala (`neto_zanba@hotmail.com`) — 3º/4º, clubes a definir; o dono envia depois.

### C) Pódio com confete

- Dependência `canvas-confetti` (levinha). Dispara no `PodioSection` (client) ao montar
  e quando o top-3 muda. Efeito sutil, 1 disparo (não fica repetindo/incomodando).

## Arquitetura

Os badges são computados no **servidor**, reusando a lib de classificação — **sem
reimplementar pontuação em SQL** (alinha com a regra de fonte única).

- **Dados base:** as linhas do ranking continuam vindo da view `ranking` (totais +
  desempate) montadas na página `app/(dashboard)/ranking/page.tsx` e em `/api/ranking`.
- **Enriquecimento (novo):** nessas duas fontes, além do ranking base, buscar:
  1. o **último jogo finalizado** (`jogos` where `finalizado` order by `data_hora` desc),
  2. os **jogos finalizados no mesmo dia** (BRT),
  3. os `palpites` (com `pontos_calculados`) desses jogos para os bilhetes,
  4. `profiles.clube`.
  Depois computar, por bilhete: a classe no último jogo (via `classificarPalpite`), a
  soma de pontos no dia, e derivar `emoji`. Anexar `emoji` e `clube` ao `RankingRowData`.
- **Função pura nova** (`lib/ranking/badge.ts`): `emojiDoResultado(classe, pontosNoDia)`
  → string | null. Encapsula o de-para + o override do 💎. Testável isolada.
- **Tipos:** `RankingRowData` ganha `emoji: string | null` e `clube: string | null`.
- **Render:** `RankingRow` (emoji ao lado dos pontos; escudo ao lado do nome) e
  `PodioCard` (mesmo). `PodioSection` dispara o confete.

### Performance

Enriquecer custa buscar palpites de ~1 jogo (último) + os jogos do dia × bilhetes.
É limitado (poucos jogos) e roda no servidor; aceitável dentro do alerta de perf da
view `ranking` no CLAUDE.md. Se necessário, dá pra restringir aos bilhetes exibidos.

## Testes

- **Unit (Vitest):** `emojiDoResultado` — cada classe → emoji certo; `null`/sem palpite
  → 🦄; `pontosNoDia >= 25` → 💎 (override) independente da classe; sem jogo → null.
- **Component (RTL):** `RankingRow` renderiza o emoji e o escudo quando presentes; não
  renderiza escudo quando `clube` é null.
- Regressão: os testes atuais de `RankingRow` continuam passando (campos novos são
  opcionais).

## Fora de escopo (fase 2+)

- Rastreamento **automático** de "top-5 em algum momento" (hoje é curadoria manual).
- Redesign **premium completo** do layout (gradientes, glass, medalhas animadas) — só o
  confete entra agora.
- Escudo substituindo o avatar.
- Outras ideias parkeadas: títulos/níveis por faixa de pontos, 🚀 maior subida da
  rodada, flash verde ao vivo quando entra ponto, selo de "rodada perfeita".

## Verificação (end-to-end)

1. `vitest run` (novos testes + suíte) e `tsc`/`eslint` limpos.
2. Migration do `profiles.clube` aplicada; setar Bruno/Baxola/Gladystone via SQL.
3. Abrir `/ranking`: conferir emoji coerente com o último jogo (ex. jogo 1 já
   finalizado), 💎 para quem fez ≥25 no dia, escudo nos 3 com clube, confete no pódio.
4. Mobile: emoji + escudo cabem na linha responsiva (pós PR #21).
