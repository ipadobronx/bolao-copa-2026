# Feature 9 — Painel Admin (Overview)

**Data:** 2026-05-02  
**Status:** Aprovado para implementação  
**Autor:** Brainstorm conduzido com Jonatas  
**Próximo passo:** writing-plans → executing-plans em worktree separado

---

## 1. Contexto e motivação

Nona feature da seção 5 do `CLAUDE.md`. F1–F8 mergeadas:

- **F1** — Next.js 14, Tailwind v4, Supabase clients, middleware de auth.
- **F2** — Schema completo (7 tabelas, 3 enums, RLS, view `ranking`, seed 48 seleções + 104 jogos).
- **F3** — Landing page.
- **F4** — Auth magic link + layout `(dashboard)`.
- **F5** — `lib/pontuacao.ts` puro com testes ≥ 95% + view `ranking` com tiebreakers §3.5.
- **F6** — Checkout PIX completo (Mercado Pago, webhook, polling, CashbackPicker).
- **F7** — Tela de palpites (104 jogos + 6 bônus, auto-save, countdown por rodada).
- **F8** — Ranking realtime (pódio, tabela por usuário, tendência, Supabase Realtime, endpoint `/api/admin/ranking-snapshot`).

Esta feature entrega o painel admin funcional: guard de `is_admin`, sidebar completa, 4 KPIs, tabela de últimos pagamentos, gráfico de vendas por dia (Recharts) e botão de snapshot do ranking.

---

## 2. Decisões tomadas durante o brainstorming

| # | Pergunta | Escolha | Motivação |
|---|----------|---------|-----------|
| Q1 | Gráfico de vendas | **Recharts** | Interatividade (tooltip, hover); ~50 KB justificado pela área admin |
| Q2 | Layout admin | **Sidebar completa com todos os itens** | Prepara a navegação de F10/F11 de uma vez; páginas futuras mostram "em breve" |
| Q3 | Botão snapshot do ranking | **Seção "Ações do sistema" no overview** | API já pronta (F8); sem o botão as setas ▲/▼ nunca funcionam na prática |
| Q4 | Arquitetura de dados | **Server Component puro + revalidação manual** | Admin é 1-2 pessoas; realtime desnecessário; mais simples e seguro |

---

## 3. O que F9 entrega

- Guard `is_admin` no `layout.tsx` de `(admin)` — redireciona não-admins para `/`
- Sidebar com 5 itens (Overview ativo; demais com badge "em breve")
- 4 KPI cards no topo
- Tabela "Últimos pagamentos" (10 registros)
- Gráfico "Vendas por dia" — últimos 7 dias (Recharts)
- Seção "Ações do sistema" com botão de snapshot do ranking

**O que F9 NÃO entrega:**
- Páginas de Apostadores, Pagamentos, Jogos, Cashbacks (F10/F11)
- Recálculo de pontos (F10)
- Exposição financeira de cashback por seleção (F11)

---

## 4. Rotas e arquitetura de arquivos

```
app/(admin)/
  layout.tsx                ← guard is_admin + sidebar completa
  admin/
    page.tsx                ← overview (Server Component puro)

components/admin/
  AdminSidebar.tsx          ← Client Component (active state por pathname)
  KpiCard.tsx               ← card reutilizável de métrica
  UltimosPagamentos.tsx     ← tabela server-rendered
  VendasChart.tsx           ← Client Component (Recharts BarChart)
  SnapshotRanking.tsx       ← Client Component (select + botão + toast)
```

---

## 5. Guard de is_admin no layout

```ts
// app/(admin)/layout.tsx
const supabase = await createSupabaseServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login?next=/admin')

const adminClient = createSupabaseAdminClient()
const { data: profile } = await adminClient
  .from('profiles')
  .select('is_admin')
  .eq('id', user.id)
  .single()
if (!profile?.is_admin) redirect('/')
```

Layout renderiza sidebar + `{children}`.

---

## 6. Sidebar

Client Component — usa `usePathname()` para determinar item ativo.

| Ícone (Lucide) | Label | Href | F9 |
|----------------|-------|------|----|
| `BarChart2` | Overview | `/admin` | ✅ ativo |
| `Users` | Apostadores | `/admin/apostadores` | em breve |
| `CreditCard` | Pagamentos | `/admin/pagamentos` | em breve |
| `Swords` | Jogos & Resultados | `/admin/jogos` | em breve (F10) |
| `Gift` | Cashbacks | `/admin/cashbacks` | em breve (F11) |

Itens "em breve" são renderizados como `<span>` (não `<Link>`), com opacidade reduzida e badge `em breve`.

Logo do admin: "ADMIN" em vermelho (`text-danger`) + "26" em amarelo (`text-accent`), fiel ao protótipo.

---

## 7. KPI Cards

Quatro cards em grid 2×2 (mobile) / 4×1 (desktop), todos calculados server-side com `supabaseAdmin`:

| Label | Query | Cor do ícone |
|-------|-------|-------------|
| Arrecadado | `SUM(valor_pago) WHERE status_pagamento = 'confirmado'` | verde |
| Tabelas vendidas | `COUNT(*) WHERE status_pagamento = 'confirmado'` | amarelo |
| Apostadores únicos | `COUNT(DISTINCT user_id) WHERE status_pagamento = 'confirmado'` | azul |
| Pagamentos pendentes | `COUNT(*) WHERE status_pagamento = 'pendente'` | vermelho |

Implementado com uma única query SQL agregada para minimizar round-trips:

```sql
SELECT
  COUNT(*) FILTER (WHERE status_pagamento = 'confirmado')           AS tabelas_vendidas,
  COUNT(DISTINCT user_id) FILTER (WHERE status_pagamento = 'confirmado') AS apostadores,
  COALESCE(SUM(valor_pago) FILTER (WHERE status_pagamento = 'confirmado'), 0) AS arrecadado,
  COUNT(*) FILTER (WHERE status_pagamento = 'pendente')             AS pendentes
FROM bilhetes;
```

`KpiCard` recebe: `label`, `value` (string formatada), `icon` (ReactNode), `colorClass`.

---

## 8. Tabela "Últimos pagamentos"

10 registros mais recentes, ordenados por `pago_em DESC` (confirmados) + `created_at DESC` (pendentes sem `pago_em`). Query:

```sql
SELECT
  b.id,
  b.numero_bilhete,
  b.valor_pago,
  b.status_pagamento,
  b.pago_em,
  b.created_at,
  b.selecao_cashback_id,
  p.nome,
  s.bandeira_emoji,
  s.nome AS selecao_nome,
  (SELECT COUNT(*) FROM bilhetes b2
   WHERE b2.user_id = b.user_id
     AND b2.status_pagamento = 'confirmado') AS total_bilhetes_usuario
FROM bilhetes b
JOIN profiles p ON p.id = b.user_id
LEFT JOIN selecoes s ON s.id = b.selecao_cashback_id
ORDER BY COALESCE(b.pago_em, b.created_at) DESC
LIMIT 10
```

Colunas exibidas:

| Coluna | Conteúdo |
|--------|----------|
| Apostador | Nome + "N tabelas" + emoji da seleção de cashback (se houver) |
| Valor | `R$ XX,XX` |
| Status | Pill: Confirmado (verde) / Aguardando (amarelo) / Expirado (cinza) / Cancelado (vermelho) |
| Quando | Tempo relativo: "2 min", "1h", "3 dias" — calculado server-side com `formatDistanceToNow` (date-fns) |

---

## 9. Gráfico "Vendas por dia"

Client Component `VendasChart` recebe `data: { date: string; tabelas: number; receita: number }[]` como prop (serializada pelo Server Component).

Query server-side:

```sql
SELECT
  DATE(COALESCE(pago_em, created_at))::text AS date,
  COUNT(*)::int                              AS tabelas,
  SUM(valor_pago)::float                    AS receita
FROM bilhetes
WHERE status_pagamento = 'confirmado'
  AND COALESCE(pago_em, created_at) >= now() - interval '7 days'
GROUP BY DATE(COALESCE(pago_em, created_at))
ORDER BY date ASC
```

O Server Component preenche dias sem vendas com `{ tabelas: 0, receita: 0 }` para os últimos 7 dias sempre aparecerem.

**Recharts:** `BarChart` com:
- Eixo X: dia da semana abreviado (SEG, TER, ...) — derivado de `date`
- Eixo Y: quantidade de tabelas
- `Tooltip` customizado: mostra data + tabelas + `R$ X.XXX,XX` em receita
- Cor das barras: `var(--accent)` (`#facc15`)
- Sem legenda (só uma série)

---

## 10. Seção "Ações do sistema" — Snapshot do ranking

Client Component `SnapshotRanking`. Não há migration nova — o endpoint e a tabela `ranking_snapshots` foram entregues pela F8.

**UI:**
```
┌──────────────────────────────────────────────┐
│  Tirar snapshot do ranking                   │
│  Salva as posições atuais para calcular      │
│  tendência (▲/▼) na próxima rodada.          │
│                                              │
│  [grupos_r1 ▼]  [Tirar snapshot]             │
└──────────────────────────────────────────────┘
```

Opções do `<select>`:
`grupos_r1`, `grupos_r2`, `grupos_r3`, `16avos`, `oitavas`, `quartas`, `semis`, `disputa_terceiro`, `final`

**Fluxo:**
1. Admin seleciona período + clica "Tirar snapshot"
2. `POST /api/admin/ranking-snapshot` com `{ periodo, force: false }`
3. Resposta `409 { exists: true }` → Dialog de confirmação: *"Já existe snapshot para [período]. Sobrescrever?"*
4. Admin confirma → re-envia com `{ force: true }`
5. Sucesso → toast sonner: `"Snapshot salvo — N apostadores registrados"`
6. Erro → toast sonner de erro com mensagem

---

## 11. Segurança

- Guard `is_admin` no `layout.tsx` (server-side) — bloqueia toda a área `/admin`
- `supabaseAdmin` (service_role) usado apenas em Server Components e Route Handlers
- Nenhuma API route nova em F9 — snapshot já existe da F8 com seu próprio guard
- Sem `any` TypeScript — tipos gerados via Supabase (`Database` type)

---

## 12. Dependências novas

- `recharts` — gráfico de barras interativo
- `date-fns` — já deve estar instalada (F7 usou); verificar antes de adicionar

---

## 13. Contrato com F10/F11

- **F10 (jogos & resultados):** habilita item "Jogos & Resultados" na sidebar (`/admin/jogos`)
- **F11 (cashbacks):** habilita item "Cashbacks" na sidebar (`/admin/cashbacks`) + seção de exposição financeira
- **Apostadores/Pagamentos:** páginas sem feature owner definida ainda — ficam "em breve" além de F11
