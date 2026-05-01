# Feature 7 — Tela de Palpites

**Data:** 2026-05-01
**Status:** Aprovado para implementação
**Autor:** Brainstorm conduzido com Jonatas
**Próximo passo:** writing-plans → executing-plans em worktree separado

---

## 1. Contexto e motivação

Sétima feature da seção 5 do `CLAUDE.md`. F1–F6 mergeadas em `main`:

- **F1** — Next.js 14, Tailwind v4, Supabase clients, middleware de auth.
- **F2** — Schema completo (7 tabelas, 3 enums, RLS, view `ranking`, seed de 48 seleções e 104 jogos).
- **F3** — Landing page recriada do protótipo.
- **F4** — Auth magic link + layout `(dashboard)` (sidebar, header, drawer mobile).
- **F5** — `lib/pontuacao.ts` puro com cobertura ≥ 95% + view `ranking` com tiebreakers §3.5.
- **F6** — Checkout PIX completo (Mercado Pago, webhook, polling, CashbackPicker).

Esta feature entrega a **tela principal de interação do apostador**: preencher os 104 palpites de jogos + 6 palpites de bônus, com auto-save, countdown por rodada e feedback de pontos após finalização de cada jogo.

---

## 2. Decisões tomadas durante o brainstorming

| # | Pergunta | Escolha | Motivação |
|---|----------|---------|-----------|
| Q1 | Estrutura de rotas multi-bilhete | **A — Lista-primeiro**: `/minhas-tabelas` lista bilhetes; `/palpites/[bilheteId]` é a rota canônica | Rota explícita por bilhete; sem estado de seleção global; URL compartilhável |
| Q2 | Estado de jogo bloqueado | **B + chip "✓ Salvo"**: salvo = borda verde + chip verde; fechado = readonly + "🔒"; finalizado = placar real em amarelo + chip "X pts" | Reutiliza `lib/pontuacao.ts` para feedback imediato; chip "Salvo" confirma cada save antes do jogo iniciar |
| Q3 | Jogos com placeholder (mata-mata) | **Inputs habilitados**: mostra "1° Grupo A" como nome do time, apostador palpita antes dos times reais serem definidos | Compatível com modelo rodada-por-rodada; palpites são por jogo individual |
| Q4 | UI da aba Bônus | **Cards visuais** estilo CashbackPicker (F6): bandeira + nome em destaque, grid 2×2 para posições + 2 cards separados | Consistência com F6; seleção visual é mais clara do que dropdown |
| Q5 | Abordagem de implementação | **Abordagem 1 — Server Component shell + Client form**: carrega tudo upfront, tabs client-side, auto-save via Server Actions | Consistente com padrões da F6; 104 jogos é dataset pequeno; progresso cross-tab trivial |
| Q6 | Agrupamento dentro de Grupos | **Rodadas com countdown**: cada grupo divide seus 6 jogos em Rodada 1/2/3 (2 jogos cada); deadline = `min(data_hora)` da rodada; countdown ativa quando < 24h | UX urgência clara; incentiva apostador a preencher antes do prazo |

---

## 3. Rotas novas

```
app/(dashboard)/
  minhas-tabelas/
    page.tsx              ← Server Component: lista bilhetes do usuário
  palpites/
    page.tsx              ← redirect: 1 bilhete confirmado → /palpites/[id]; 0 → /comprar; vários → /minhas-tabelas
    actions.ts            ← Server Actions: upsertPalpite, upsertBonus
    [bilheteId]/
      page.tsx            ← Server Component: fetcha dados → PalpitesShell (Client)
      not-found.tsx       ← bilhete não encontrado ou não pertence ao usuário
```

O nav item "Meus Palpites" aponta para `/palpites`. O nav item "Minhas Tabelas" aponta para `/minhas-tabelas`. O nav item "Bônus" aponta para `/palpites` — mesma lógica de redirect; `PalpitesShell` aceita query param `?tab=bonus` para pre-selecionar a aba Bônus na chegada.

---

## 4. Dados carregados pelo Server Component

Quatro queries paralelas em `app/(dashboard)/palpites/[bilheteId]/page.tsx`:

```ts
// 1. bilhete (valida propriedade + status)
bilhetes: id, numero_bilhete, valor_pago, selecao_cashback_id, status_pagamento

// 2. jogos completos (104 registros)
jogos: id, numero_jogo, fase, data_hora, finalizado,
       gols_casa, gols_fora, selecao_casa_id, selecao_fora_id,
       placeholder_casa, placeholder_fora,
       + join selecoes casa: nome, bandeira_emoji
       + join selecoes fora: nome, bandeira_emoji

// 3. palpites já salvos para este bilhete
palpites WHERE bilhete_id = bilheteId

// 4. palpites de bônus para este bilhete
palpites_bonus WHERE bilhete_id = bilheteId
```

**Validação de acesso:** RLS garante que o usuário só lê seus próprios dados. Se o bilhete não existir ou não pertencer ao usuário autenticado, a query retorna vazio → `notFound()`. Se `status_pagamento ≠ 'confirmado'`, renderiza página de erro específica com CTA para `/comprar`.

---

## 5. Arquitetura de componentes

```
PalpitesShell (Client Component)
  ├── PalpitesHeader
  │     bilhete #N · contador "X / 104 preenchidos"
  ├── PalpitesTabs
  │     Grupos | 16avos | Oitavas | Quartas | Semis | 3° lugar | Final | 🏆 Bônus
  └── [conteúdo da tab ativa — renderizado condicionalmente, não desmontado]
        ├── GruposTab
        │     └── GroupSection (A–L) × 12
        │           └── RodadaSection (Rodada 1/2/3) × 3
        │                 ├── RodadaHeader (deadline + countdown)
        │                 └── MatchRow × 2
        ├── FaseTab (genérico: 16avos, Oitavas, Quartas, Semis, 3° lugar, Final)
        │     └── MatchRow × N
        └── BonusTab
              └── BonusCard × 6
```

**Nota de performance:** as tabs não são desmontadas ao trocar — usam `display: none` para preservar estado local dos inputs (valores digitados mas ainda no debounce).

---

## 6. State machine por MatchRow

O estado de cada jogo é computado a partir dos dados já carregados, sem queries adicionais:

```
open      → jogo.data_hora > now()
              inputs ativos, auto-save habilitado
locked    → jogo.data_hora ≤ now() && !jogo.finalizado
              inputs readonly, chip "🔒 Fechado"
finalized → jogo.finalizado === true
              placar real em amarelo (gols_casa × gols_fora),
              sub-legenda "meu: X×Y",
              chip "N pts" (de palpites.pontos_calculados se disponível, senão null)
```

**Save state** (aplicável apenas quando `open`):

```
idle     → nenhum valor digitado ainda → chip "● Pendente"
dirty    → digitando, debounce correndo → chip "● Pendente" (sem indicação de loading até disparar)
saving   → server action em flight → chip "Salvando…"
saved    → server confirmou → chip "✓ Salvo" + borda verde
error    → server action falhou → toast de erro + chip "Erro"
```

Salva apenas quando **ambos** os campos são inteiros `≥ 0`. Limpar os campos não apaga palpite já salvo.

---

## 7. Auto-save (debounce 1 s)

```ts
// Dentro de MatchRow
const [golsCasa, setGolsCasa] = useState(initialGolsCasa)
const [golsFora, setGolsFora] = useState(initialGolsFora)
const debounceRef = useRef<ReturnType<typeof setTimeout>>()

function handleChange(field: 'casa' | 'fora', value: string) {
  // Aceita apenas dígitos 0-9
  const num = value.replace(/\D/g, '').slice(0, 2)
  field === 'casa' ? setGolsCasa(num) : setGolsFora(num)

  clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(async () => {
    const c = parseInt(golsCasa), f = parseInt(golsFora)
    if (isNaN(c) || isNaN(f)) return
    setSaveState('saving')
    const result = await upsertPalpite(bilheteId, jogoId, c, f)
    setSaveState(result.ok ? 'saved' : 'error')
    if (!result.ok) toast.error(result.error)
  }, 1000)
}
```

---

## 8. Server Actions

Arquivo: `app/(dashboard)/palpites/actions.ts`

### `upsertPalpite(bilheteId, jogoId, golsCasa, golsFora)`

1. Valida sessão (`createSupabaseServerClient`)
2. Zod: `golsCasa` e `golsFora` inteiros `0–99`
3. Confirma `bilhete.user_id = session.user.id` e `bilhete.status_pagamento = 'confirmado'`
4. Confirma `jogo.data_hora > now()` (defesa em profundidade além do trigger DB)
5. `supabase.from('palpites').upsert({ bilhete_id, jogo_id, gols_casa, gols_fora }, { onConflict: 'bilhete_id,jogo_id' })`
6. Retorna `{ ok: true }` ou `{ ok: false, error: string }`

### `upsertBonus(bilheteId, tipo, selecaoId?, jogadorNome?)`

1. Valida sessão
2. Zod: `tipo` é `tipo_bonus` enum; `selecao_id` obrigatório para todos exceto artilheiro; `jogador_nome` obrigatório para artilheiro (trim, max 100 chars)
3. Confirma `bilhete.user_id = session.user.id` e `bilhete.status_pagamento = 'confirmado'`
4. Valida deadline: `min(jogos.data_hora) > now()` — após o primeiro jogo da Copa, bônus trava
5. `supabase.from('palpites_bonus').upsert({ bilhete_id, tipo, selecao_id, jogador_nome }, { onConflict: 'bilhete_id,tipo' })`
6. Retorna `{ ok: true }` ou `{ ok: false, error: string }`

---

## 9. Rodadas com countdown (GruposTab)

Cada grupo tem 6 jogos divididos em 3 rodadas (2 jogos cada). A rodada é inferida **client-side** a partir da ordem por `data_hora`:

```ts
function inferirRodadas(jogosDoGrupo: Jogo[]): Rodada[] {
  const sorted = [...jogosDoGrupo].sort((a, b) =>
    new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime()
  )
  return [
    { numero: 1, jogos: sorted.slice(0, 2) },
    { numero: 2, jogos: sorted.slice(2, 4) },
    { numero: 3, jogos: sorted.slice(4, 6) },
  ]
}
```

**Deadline da rodada** = `min(data_hora)` dos 2 jogos da rodada.

**RodadaHeader** (Client Component com `useEffect`):

| Estado | Condição | Visual |
|--------|----------|--------|
| Normal | `deadline - now() > 24h` | Banner cinza: "Rodada N · fecha DD/MM às HH:MM" |
| Urgente | `0 < deadline - now() ≤ 24h` | Banner laranja com `⚡` + countdown HH:MM:SS ao vivo |
| Encerrada | `now() ≥ deadline` | Banner acinzentado `🔒 Rodada N · encerrada` |

O countdown usa `setInterval(1000)` dentro de `useEffect`. Quando o timer zera, o componente re-renderiza e cada `MatchRow` da rodada passa a ficar `locked` (já que `data_hora ≤ now()`).

**Nota:** jogos de mata-mata (16avos em diante) **não têm** subdivisão por rodada — exibem os jogos da fase em lista simples via `FaseTab`.

---

## 10. Aba Bônus

**Deadline único:** antes de `min(jogos.data_hora)` de toda a Copa (primeiro jogo, 11/06/2026 às 16:00). Depois dessa hora, todos os 6 cards ficam readonly.

**Layout:** grid 2×2 para as 4 posições + linha com 2 cards para Artilheiro e Revelação.

| Card | Tipo | Input | Pts |
|------|------|-------|-----|
| Campeão | `campeao` | Picker 48 seleções | 50 pts |
| Vice | `vice` | Picker 48 seleções | 30 pts |
| 3° Lugar | `terceiro` | Picker 48 seleções | 15 pts |
| 4° Lugar | `quarto` | Picker 48 seleções | 15 pts |
| Artilheiro | `artilheiro` | Text input (nome do jogador) | 25 pts |
| Revelação | `revelacao` | Picker 48 seleções | 15 pts |

Badge "Admin define o critério" no card Revelação.

Auto-save: debounce 500 ms (resposta mais rápida que jogos, já que é um único campo por card).

---

## 11. Tela "Minhas Tabelas" (`/minhas-tabelas`)

Server Component que busca todos os bilhetes do usuário autenticado + contagem de palpites preenchidos por bilhete.

**Card por bilhete:**
- Número do bilhete + badge de status (`confirmado` / `pendente` / `expirado`)
- Barra de progresso + "X / 104 preenchidos"
- Seleção cashback (se `selecao_cashback_id` preenchido)
- CTA "Preencher palpites →" (desabilitado se status ≠ `confirmado`)

Bilhetes com `status_pagamento = 'pendente'` são exibidos com opacidade reduzida e CTA desabilitado.

---

## 12. Atualização do DashboardNav

Habilitar os 3 itens atualmente marcados "Em breve (F7)":

```ts
// Antes
{ label: 'Meus Palpites', icon: Trophy, disabledHint: 'Em breve (F7)' }
{ label: 'Bônus',         icon: Target, disabledHint: 'Em breve (F7)' }
{ label: 'Minhas Tabelas',icon: Ticket, disabledHint: 'Em breve (F7)' }

// Depois
{ label: 'Meus Palpites', icon: Trophy, href: '/palpites' }
{ label: 'Bônus',         icon: Target, href: '/palpites?tab=bonus' }  // pre-seleciona aba Bônus
{ label: 'Minhas Tabelas',icon: Ticket, href: '/minhas-tabelas' }
```

---

## 13. O que esta feature NÃO entrega

- Cálculo de pontos (depende de F10 — admin insere resultado → Edge Function recalcula). O chip "X pts" só aparece quando `palpites.pontos_calculados` estiver preenchido.
- Ranking realtime (F8).
- Visualização pública de palpites de outros apostadores (F8 — `/ranking/[bilheteId]`).
- Notificações WhatsApp (F13, opcional).
