# Design — Modal de perfil: 6 bônus + trocar de tabela

**Data:** 2026-06-18
**Status:** aprovado (brainstorming)

## Contexto

No modal de perfil do ranking (`PerfilModal`), hoje:
- O bloco de bônus só mostra 🏆 campeão e ⚽ artilheiro.
- A lista "Pontuação por tabela" mostra as tabelas da pessoa, mas o card todo é sempre a
  **melhor** tabela (a do ranking).

Dois pedidos:
1. Mostrar **todos os bônus**: campeão, vice, 3º, 4º, artilheiro, revelação.
2. Quem tem 2+ tabelas, ao **clicar numa tabela**, ver o resultado dela — **o card inteiro
   vira aquela tabela** (selo, pontos, exatos, form, bônus, palpites). Com um **"← Voltar"**
   pra retornar ao card padrão.

## Escopo

### 1. Os 6 bônus — `route.ts` + `PerfilModal.tsx`
- A rota lê `palpites_bonus` para os tipos `['campeao','vice','terceiro','quarto','artilheiro','revelacao']`
  (RLS já libera pós-início) e retorna, além do `campeao`/`artilheiro` atuais:
  - `vice`, `terceiro`, `quarto`, `revelacao`: `{ nome, bandeira } | null` (join `selecoes`).
  - `artilheiro`: `string | null` (jogador_nome).
- O modal renderiza os 6 com ícones: 🏆 Campeão · 🥈 Vice · 🥉 3º lugar · 4️⃣ 4º lugar ·
  ⚽ Artilheiro · 🌟 Revelação. Cada um mostra "—" se vazio.

### 2. Trocar de tabela (card inteiro) — `route.ts` + `PerfilModal.tsx`
- A rota passa a retornar também os **stats da tabela pedida** (`params.bilheteId`):
  `numero`, `pontos`, `posicao` (entre todas as tabelas), `exatos`, `forma` (últimos 5).
  - `numero/pontos/posicao/exatos`: da view `ranking` (a query de `tabelas` ganha
    `acertos_exatos`; o registro do próprio bilhete é localizado por `bilheteId`).
  - `forma`: via helper existente `calcularForma(admin, [{ userId, melhorBilheteId: bilheteId }])`
    (usa o cliente admin só pra isso — form é de jogos **finalizados**, públicos; sem
    vazamento). Retorna `CorForma[]`.
- O modal:
  - Estado `selBilheteId` (inicia em `entry.melhorBilheteId`). O fetch passa a usar
    `selBilheteId`. Ao abrir outro perfil (muda `entry.melhorBilheteId`), reseta pra ele.
  - `isDefault = selBilheteId === entry.melhorBilheteId`.
  - **Topo:**
    - Subtítulo: `isDefault` → `${entry.posicao}º no ranking` (como hoje); senão →
      `Tabela nº${data.numero} · ${data.posicao}ª de ${data.totalTabelas}`.
    - Selo: `isDefault` → `tituloDesempenho(entry.posicao, total)` (percentil entre
      apostadores, como hoje); senão → `tituloDesempenho(data.posicao, data.totalTabelas)`
      (percentil entre tabelas).
    - Pontos/Exatos/Form: `isDefault` → do `entry` (instantâneo); senão → do `data`.
      (Para o default os valores do `data` coincidem com os do `entry`.)
  - **Lista "Pontuação por tabela":** cada linha vira **clicável** (`<button>`) → seta
    `selBilheteId`. A linha **selecionada** ganha destaque (anel/realce); a melhor mantém o
    selo "★ ranking".
  - **"← Voltar":** quando `!isDefault`, um botão discreto no topo (ou acima da lista) reseta
    `selBilheteId` pra `entry.melhorBilheteId`.
  - Durante o fetch de uma tabela não-default, mostrar "Carregando…" nas áreas dependentes do
    `data` (bônus/palpites já têm esse loading; o topo mostra os números só quando `data`
    chega).

## Arquitetura / arquivos
- **Modificar** `app/api/perfil/[bilheteId]/route.ts` — 6 bônus + `numero/pontos/posicao/exatos/forma`
  da tabela pedida (usa `calcularForma` + `createSupabaseAdminClient` só pra forma).
- **Modificar** `components/ranking/PerfilModal.tsx` — `PerfilData` estendido, estado
  `selBilheteId`, topo condicional (default vs tabela), 6 bônus, lista clicável + "← Voltar".

## Testes
- **Component `PerfilModal`:** (a) renderiza os 6 rótulos de bônus; (b) com 2+ tabelas, clicar
  numa tabela dispara novo fetch (mock) e aparece o "← Voltar"; voltar volta pro default.
  (Mantém os testes atuais verdes, ajustando o mock pro novo shape.)
- **Privacidade (revisão):** a rota continua expondo só pós-apito (bônus pós-início; palpites
  de jogos travados); `forma` só usa finalizados.

## Fora de escopo
- Trocar de **pessoa** (só de tabela da mesma pessoa); mexer no /ranking; migration.
