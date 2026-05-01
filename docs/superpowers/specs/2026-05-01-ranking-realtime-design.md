# Feature 8 — Ranking Realtime

**Data:** 2026-05-01  
**Status:** Aprovado para implementação  
**Autor:** Brainstorm conduzido com Jonatas  
**Próximo passo:** writing-plans → executing-plans em worktree separado

---

## 1. Contexto e motivação

Oitava feature da seção 5 do `CLAUDE.md`. F1–F7 mergeadas (ou em worktree):

- **F1** — Next.js 14, Tailwind v4, Supabase clients, middleware de auth.
- **F2** — Schema completo (7 tabelas, 3 enums, RLS, view `ranking`, seed 48 seleções + 104 jogos).
- **F3** — Landing page.
- **F4** — Auth magic link + layout `(dashboard)`.
- **F5** — `lib/pontuacao.ts` puro com testes ≥ 95% + view `ranking` com tiebreakers §3.5.
- **F6** — Checkout PIX completo (Mercado Pago, webhook, polling, CashbackPicker).
- **F7** — Tela de palpites (104 jogos + 6 bônus, auto-save, countdown por rodada).

Esta feature entrega a tela de ranking visível a todos os apostadores, com atualização em tempo real via Supabase Realtime, pódio dos top 3, tabs Geral e Rodada, tendência de posições e perfil público de bilhete.

---

## 2. Decisões tomadas durante o brainstorming

| # | Pergunta | Escolha | Motivação |
|---|----------|---------|-----------|
| Q1 | Tabs em escopo | **Geral + Rodada** | "Amigos" exigiria sistema de amizades inexistente; YAGNI |
| Q2 | O que é "Rodada" | **Rodada dentro da fase** | Durante grupos = Rodada 1/2/3 (mesmo algoritmo da F7); durante mata-mata = fase completa (16avos, oitavas, etc.) |
| Q3 | Tendência (▲/▼/━) | **Implementar com snapshots** | Guardar posição ao final de cada rodada/fase em `ranking_snapshots` |
| Q4 | Perfil público `/ranking/[bilheteId]` | **Resumo simples** | Posição, pontos, acertos, seleção de cashback — sem expor palpites individuais |
| Q5 | Mecanismo Realtime | **Postgres Changes em `ranking_signals` + debounce** | Contorna RLS de `palpites`; FOR EACH STATEMENT evita 2k+ eventos por recálculo batch |
| Q6 | Granularidade do ranking | **Uma linha por usuário** (melhor bilhete) | Quem tem múltiplas tabelas aparece uma vez, com "N tabelas" como meta |

---

## 3. Rotas novas

```
app/(dashboard)/
  ranking/
    page.tsx              ← Server Component: dados iniciais + RankingShell
    [bilheteId]/
      page.tsx            ← Perfil público (Server Component puro)
      not-found.tsx
```

**O que F8 NÃO entrega:**
- Tab "Amigos"
- Palpites individuais no perfil público
- Recálculo de pontos (F10)
- Botão de snapshot no painel admin (escopo de F9)

---

## 4. Novos objetos de banco (migration única)

### 4.1 View `ranking_usuarios`

Uma linha por usuário, mostrando o melhor bilhete. Posição re-calculada por usuário com os mesmos tiebreakers de §3.5.

```sql
CREATE VIEW ranking_usuarios
WITH (security_invoker = false) AS
WITH best AS (
  SELECT DISTINCT ON (user_id) *
  FROM ranking
  ORDER BY user_id,
           pontos_totais DESC,
           acertos_exatos DESC,
           acertou_campeao DESC,
           pontos_mata_mata DESC,
           numero_bilhete ASC
),
contagem AS (
  SELECT user_id, COUNT(*)::int AS total_bilhetes
  FROM bilhetes
  WHERE status_pagamento = 'confirmado'
  GROUP BY user_id
)
SELECT
  b.user_id,
  b.nome,
  b.bilhete_id            AS melhor_bilhete_id,
  b.numero_bilhete        AS melhor_numero_bilhete,
  b.pontos_totais,
  b.acertos_exatos,
  b.acertos_parciais,
  b.pontos_mata_mata,
  b.acertou_campeao,
  COALESCE(c.total_bilhetes, 0) AS total_bilhetes,
  ROW_NUMBER() OVER (
    ORDER BY b.pontos_totais    DESC,
             b.acertos_exatos   DESC,
             b.acertou_campeao  DESC,
             b.pontos_mata_mata DESC,
             b.numero_bilhete   ASC
  )::int AS posicao
FROM best b
LEFT JOIN contagem c ON c.user_id = b.user_id;

-- RLS: anon e authenticated podem SELECT (ranking é público)
GRANT SELECT ON ranking_usuarios TO anon, authenticated;
```

### 4.2 Tabela `ranking_snapshots`

Histórico de posições para calcular tendência (▲/▼/━).

```sql
CREATE TABLE ranking_snapshots (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id),
  posicao       int         NOT NULL,
  pontos_totais int         NOT NULL,
  periodo       text        NOT NULL,
  -- valores de periodo: 'grupos_r1', 'grupos_r2', 'grupos_r3',
  --                     '16avos', 'oitavas', 'quartas', 'semis',
  --                     'disputa_terceiro', 'final'
  snapshot_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, periodo)
);

-- RLS: authenticated lê todos (tendência é pública); service_role escreve
ALTER TABLE ranking_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated lê snapshots" ON ranking_snapshots
  FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE apenas via service_role (Server Action com supabaseAdmin)
```

**Quem dispara o snapshot:** Server Action `tirarSnapshotRanking(periodo: string)` (criada em F8, exposta via `/api/admin/ranking-snapshot`). Chamada pelo admin via botão no painel — botão é escopo de F9. A action usa `supabaseAdmin` (service_role) e executa:

```sql
INSERT INTO ranking_snapshots (user_id, posicao, pontos_totais, periodo)
SELECT user_id, posicao, pontos_totais, $1
FROM ranking_usuarios
ON CONFLICT (user_id, periodo)
DO UPDATE SET
  posicao       = EXCLUDED.posicao,
  pontos_totais = EXCLUDED.pontos_totais,
  snapshot_at   = now();
```

O admin deve ver confirmação explícita antes de sobrescrever ("Já existe snapshot para `grupos_r1`. Sobrescrever?") — lógica no client F9.

### 4.3 Tabela `ranking_signals` + trigger

Sinal dedicado para o Realtime. Contorna o problema de RLS em `palpites` (usuário só recebe seus próprios eventos via Postgres Changes).

```sql
CREATE TABLE ranking_signals (
  id         int         PRIMARY KEY DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ranking_signals VALUES (1, now());

-- RLS: qualquer autenticado pode SELECT (sem dados sensíveis)
ALTER TABLE ranking_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated lê signal" ON ranking_signals
  FOR SELECT TO authenticated USING (true);
-- UPDATE apenas via trigger (SECURITY DEFINER)

-- Trigger em palpites: dispara quando pontos_calculados é atualizado (F10)
CREATE OR REPLACE FUNCTION notify_ranking_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE ranking_signals SET updated_at = now() WHERE id = 1;
  RETURN NULL;
END;
$$;

CREATE TRIGGER palpites_ranking_signal
AFTER UPDATE OF pontos_calculados ON palpites
FOR EACH STATEMENT
EXECUTE FUNCTION notify_ranking_updated();
```

**Por que `FOR EACH STATEMENT`:** F10 atualiza `pontos_calculados` em batch (potencialmente 2.000+ linhas por jogo finalizado). `FOR EACH ROW` dispararia 2.000+ eventos Realtime redundantes; `FOR EACH STATEMENT` dispara 1 evento por statement SQL.

---

## 5. Mecanismo Realtime

```
F10 recalcula palpites (UPDATE em batch)
  → trigger FOR EACH STATEMENT → UPDATE ranking_signals.updated_at
  → Supabase Realtime notifica todos os clients em /ranking
  → client: debounce 3000 + Math.random() * 1500 ms
    (jitter evita 500 clientes fazendo fetch simultâneo)
  → re-fetch ranking_usuarios → React state atualiza
```

**Subscription no `RankingShell`:**

```ts
useEffect(() => {
  const debounceRef = { current: undefined as ReturnType<typeof setTimeout> | undefined }
  const channel = supabase
    .channel('ranking-signal')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'ranking_signals',
    }, () => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(
        fetchRanking,
        3000 + Math.random() * 1500,
      )
    })
    .subscribe()
  return () => {
    clearTimeout(debounceRef.current)
    supabase.removeChannel(channel)
  }
}, [])
```

---

## 6. Arquitetura de componentes

```
app/(dashboard)/ranking/page.tsx        ← Server Component
  └── RankingShell (Client Component)
        ├── tabs: Geral | Rodada
        ├── RankingTabGeral
        │     ├── PodioSection (top 3 — 2° à esquerda, 1° elevado, 3° à direita)
        │     │     └── PodioCard × 3
        │     └── RankingTable
        │           └── RankingRow × N  (linha do usuário logado tem badge "Você" + fundo amarelo sutil)
        └── RankingTabRodada
              ├── PeriodoBanner ("Grupos — Rodada 2" | "Oitavas de final")
              └── RankingTable (mesmos RankingRow, dados filtrados pelo período)

app/(dashboard)/ranking/[bilheteId]/page.tsx   ← Server Component puro
  └── PerfilPublico
        ├── Avatar + nome + "Tabela #N · X tabelas"
        ├── KPIs: posição · pontos · acertos exatos
        └── Cashback: bandeira + nome da seleção (se preenchido) + valor apostado
```

Componentes ficam em `components/ranking/`.

---

## 7. Dados carregados pelo Server Component (`/ranking/page.tsx`)

Três queries paralelas:

```ts
// 1. Ranking geral (todos os usuários)
ranking_usuarios ORDER BY posicao ASC

// 2. Período corrente + jogo_ids para tab Rodada
// Lógica:
//   a. Busca fase ativa (fase do jogo finalizado mais recentemente, ou fase com jogo mais próximo)
//   b. Se fase = 'grupos': inferir rodada (mesmo algoritmo da F7: sort por data_hora, slice 0-1/2-3/4-5 por grupo)
//   c. Retorna: { label: string, jogo_ids: string[] }
jogos (para inferência de período — todos os 104 com fase + data_hora + finalizado)

// 3. Snapshot mais recente do período anterior (para tendência)
ranking_snapshots WHERE snapshot_at < inicio_periodo_atual
ORDER BY snapshot_at DESC LIMIT 1 POR user_id
// Implementado via: SELECT DISTINCT ON (user_id) * FROM ranking_snapshots
//   WHERE snapshot_at < $periodo_inicio ORDER BY user_id, snapshot_at DESC
```

A tendência é calculada no Server Component: `posicao_atual - snapshot.posicao`. Se `snapshot` não existe (antes de qualquer rodada terminar), tendência = `null` → exibe `━`.

---

## 8. Tab Rodada — como determinar o período corrente

```ts
function determinarPeriodoAtual(jogos: Jogo[]): { label: string; jogoIds: string[] } {
  // 1. Encontra fase com jogos finalizados mais recentes
  const faseAtiva = // fase do jogo com max(data_hora) WHERE finalizado = true
                    // fallback: fase do próximo jogo (min data_hora WHERE !finalizado)

  if (faseAtiva === 'grupos') {
    // 2. Para cada grupo (A-L), ordena jogos por data_hora, divide em 3 rodadas de 2
    // 3. Rodada ativa = a com max(data_hora) < now() — ou rodada 1 se nenhuma iniciou
    return { label: `Grupos — Rodada ${rodadaAtiva}`, jogoIds: [...] }
  } else {
    // mata-mata: todos os jogos da fase
    return { label: LABEL_FASE[faseAtiva], jogoIds: jogos.filter(j => j.fase === faseAtiva).map(j => j.id) }
  }
}
```

---

## 9. Perfil público `/ranking/[bilheteId]`

Server Component puro (sem Realtime). Busca:

```ts
// 1. ranking_usuarios WHERE melhor_bilhete_id = bilheteId (ou bilhete_id direto na view ranking)
// 2. bilhetes WHERE id = bilheteId → selecao_cashback_id + valor_pago
// 3. selecoes WHERE id = selecao_cashback_id → nome + bandeira_emoji
```

Se bilhete não encontrado ou não confirmado → `notFound()`.

**Layout:**
- Avatar com iniciais (cor determinística a partir do `user_id`). F8 cria nova utility `avatarColor(userId: string): string` em `lib/format/avatar-color.ts` — retorna uma das ~8 classes CSS de gradiente; hash simples do UUID é suficiente)
- Nome + "Tabela #N · X tabelas"
- 3 KPIs em linha: Posição · Pontos · Acertos Exatos
- Seção Cashback: bandeira + nome da seleção + "Apostou R$ X,XX em cashback" (se `selecao_cashback_id` preenchido)

Acesso: qualquer usuário autenticado pode ver perfil de qualquer bilhete confirmado. RLS da view `ranking` já permite isso.

---

## 10. DashboardNav — habilitação

```ts
// components/dashboard/DashboardNav.tsx
// Antes:
{ label: 'Ranking', icon: Award, disabledHint: 'Em breve (F8)' }

// Depois:
{ label: 'Ranking', icon: Award, href: '/ranking' }
```

---

## 11. Dívida técnica: `acertos_parciais` (herdada da F5)

A coluna `acertos_parciais` da view `ranking` (col 7) conta vencedor (5pts) + vencedor_saldo (7pts) + parcial (2pts) juntos — inclui todas as classes não-exatas com pontos > 0.

**Por que não corrigir agora:** filtrar por `pontos_calculados = 2` só capturaria a classe `parcial` na fase de grupos (multiplicador 1×). Em mata-mata, um `parcial` vale `Math.round(2 × mult)` = 3, 4, 5... pts — o valor varia por fase. Corrigir exigiria armazenar a `ClassePalpite` em `palpites.classe` (coluna nova), o que é escopo natural de F10 (quando os pontos são calculados).

**Decisão para F8:** exibir `acertos_parciais` como está, com o label "parciais" na UI. Adicionar comentário inline no componente `RankingRow` indicando que o valor inclui as classes `vencedor`, `vencedor_saldo` e `parcial`. A correção semântica fica para F10.

**Não gerar migration de correção em F8.** Remover a entrada de dívida técnica da memória (`project_acertos_parciais_debito_f8.md`) após confirmar que F10 resolverá isso.

---

## 12. Estado vazio

Enquanto não há bilhetes confirmados (antes do lançamento), `ranking_usuarios` retorna 0 linhas. `RankingTabGeral` exibe um estado vazio no lugar do pódio e da tabela:

```
┌──────────────────────────────────────┐
│  🏆                                  │
│  O ranking ainda está vazio          │
│  Seja o primeiro a comprar sua       │
│  tabela e garantir sua posição.      │
│  [Comprar tabela →]                  │
└──────────────────────────────────────┘
```

A tab Rodada também exibe estado vazio se `jogo_ids` do período estiverem todos sem `pontos_calculados`.

---

## 13. Contrato com F9/F10

- **F9 (painel admin overview):** adicionar botão "Tirar snapshot do ranking" que chama `POST /api/admin/ranking-snapshot` com `{ periodo }`. O endpoint verifica se já existe snapshot e exige confirmação explícita antes de sobrescrever (`ON CONFLICT DO UPDATE`).
- **F10 (entrada de resultados):** ao recalcular pontos em batch, o trigger `palpites_ranking_signal` já notifica os clients automaticamente. F10 não precisa de código extra para Realtime. F10 deve adicionar coluna `palpites.classe` (tipo `ClassePalpite`) e preenchê-la no recálculo — isso resolve a dívida de `acertos_parciais` (§11).

---

## 14. Server Action para snapshot (criada em F8)

```ts
// app/api/admin/ranking-snapshot/route.ts (POST, service_role)
export async function POST(req: Request) {
  // 1. Validar sessão + is_admin
  // 2. Zod: { periodo: z.string().min(1), force?: z.boolean() }
  // 3. Se !force: checar se já existe snapshot para o período → retornar { exists: true }
  // 4. Se force ou !exists: INSERT ... ON CONFLICT DO UPDATE
  // 5. Retornar { ok: true, count: N }
}
```
