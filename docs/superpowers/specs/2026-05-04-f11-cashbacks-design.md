# Feature 11 — Admin: Painel de Cashbacks

**Data:** 2026-05-04
**Status:** Aprovado para implementação
**Autor:** Brainstorm conduzido com Jonatas
**Próximo passo:** writing-plans → executing-plans em worktree separado

---

## 1. Contexto e motivação

Décima-primeira feature da seção 5 do `CLAUDE.md`. F1–F10 mergeadas:

- **F1** — Setup Next.js 14, Tailwind v4, Supabase clients, middleware.
- **F2** — Schema (7 tabelas, 3 enums, RLS, view `ranking`, seed 48 seleções + 104 jogos).
- **F3** — Landing page.
- **F4** — Auth magic link + layout dashboard.
- **F5** — `lib/pontuacao.ts` puro com testes ≥ 95%.
- **F6** — Checkout PIX (Mercado Pago, webhook, polling, CashbackPicker, `lib/cashback.ts`).
- **F7** — Tela de palpites (104 jogos + 6 bônus, auto-save, countdown).
- **F8** — Ranking realtime (Supabase Realtime, `ranking_snapshots`).
- **F9** — Painel admin overview (KPIs, pagamentos, gráfico de vendas).
- **F10** — Painel admin jogos & resultados (placares, recálculo síncrono/assíncrono, `lib/recalculo.ts`).

F11 entrega a página `/admin/cashbacks`: o admin monitora a exposição financeira por seleção durante toda a Copa e, após `copa_resultados.finalizada = true`, marca os cashbacks da seleção campeã como pagos (bilhete por bilhete ou em lote).

---

## 2. Decisões tomadas durante o brainstorming

| # | Pergunta | Escolha | Motivação |
|---|----------|---------|-----------|
| Q1 | Hierarquia de navegação | **A — Tela única com accordion por seleção** | Auditoria contínua durante a Copa; evita navegação entre páginas para tarefa simples |
| Q2 | Granularidade do "Marcar pago" | **Individual + bulk como atalho** | PIX é operação manual por apostador; bulk economiza cliques após sequência; individual preserva auditoria |
| Q3 | Quem aparece no accordion | **Todos os bilhetes confirmados com `selecao_cashback_id = X`** sempre | Admin precisa ver exposição real durante a Copa, não só após finalizada; contexto histórico pós-eliminação |
| Q4 | KPIs globais | **4 cards no topo (padrão F9)** | Consistência visual; monitoramento de exposição e ação de pagamento no mesmo padrão estabelecido |
| Q5 | Arquitetura de dados | **Abordagem A — Server Component carrega tudo upfront** | Volume pequeno (~500 bilhetes); zero API routes de leitura extras; padrão F9 |
| Q6 | `calcularValorCashback` | **Fica em `lib/cashback.ts` (F6) — fonte única** | Regra financeira única evita divergência; F11 importa da F6, não reimplementa |
| Q7 | Resposta de `marcar-pago` | **`{ marcados, ja_estavam_pagos, total_solicitados }`** | UX de auditoria clara; admin distingue erro real de idempotência |

---

## 3. O que F11 entrega

**Entrega:**
- Página `/admin/cashbacks` com 4 KPI cards + lista das 13 seleções com accordion
- Accordion por seleção: header sempre visível (exposição financeira) + lista de apostadores ao expandir
- Botão `[Marcar pago]` individual por apostador + "Selecionar todos" + `[Marcar selecionados como pagos]` em lote
- Estados do botão: disabled com tooltip contextual (copa não finalizada / seleção não campeã / já pago)
- `POST /api/admin/cashbacks/marcar-pago` — route handler com validação, idempotência e resposta auditável
- Migration com `cashback_pago_em`, `cashback_pago_por` + atualização do trigger de proteção
- `admin_cashbacks_kpis()` — RPC Supabase (SECURITY DEFINER) para os 4 KPIs
- `lib/cashback-pagamento.ts` — lib pura com `isElegivelPagamento` e `exposicaoSelecao`, TDD ≥ 95%
- `calcularValorCashback` adicionada a `lib/cashback.ts` (F6) como fonte única do cálculo
- Sidebar: "Cashbacks" deixa de ser `comingSoon` e vira `Link` ativo

**Não entrega:**
- Integração com API do MP para PIX automático de cashback (operação manual pelo admin)
- Notificação por WhatsApp ao apostador quando cashback for pago (F13)
- Histórico de ações do admin (audit log separado — fora de escopo)

---

## 4. Arquitetura de arquivos

```
app/
  (admin)/
    admin/
      cashbacks/
        page.tsx              ← Server Component: RPC KPIs + query bilhetes + query selecoes
        CashbacksClient.tsx   ← Client Component: 4 KPI cards + 13 accordions
  api/
    admin/
      cashbacks/
        marcar-pago/
          route.ts            ← POST { bilheteIds: string[] }

components/admin/
  AdminSidebar.tsx            ← remove comingSoon de "Cashbacks", vira Link ativo
  SelecaoCashbackRow.tsx      ← accordion de uma seleção (header + lista expandida)
  ApostadorCashbackRow.tsx    ← linha de apostador com checkbox + botão [Marcar pago]

lib/
  cashback.ts                 ← F6 existente: recebe calcularValorCashback (fonte única)
  cashback-pagamento.ts       ← NOVO: isElegivelPagamento, exposicaoSelecao
                                 importa calcularValorCashback de cashback.ts
  __tests__/
    cashback-pagamento.test.ts ← TDD ≥ 95%

supabase/migrations/
  20260504000001_cashback_audit.sql  ← 2 colunas + trigger update + RPC
```

---

## 5. Migration SQL

**Arquivo:** `supabase/migrations/20260504000001_cashback_audit.sql`

```sql
-- ============================================================================
-- Bolão Copa 2026 — Feature 11: Admin Cashbacks
-- ============================================================================
-- 1. Adiciona cashback_pago_em e cashback_pago_por em bilhetes
-- 2. Atualiza protect_bilhete_payment_columns para incluir novas colunas
-- 3. Cria RPC admin_cashbacks_kpis() SECURITY DEFINER
-- ============================================================================

-- 1. Novas colunas de audit trail
ALTER TABLE public.bilhetes
  ADD COLUMN cashback_pago_em  timestamptz,
  ADD COLUMN cashback_pago_por uuid REFERENCES public.profiles(id);

-- 2. Atualiza trigger de proteção (adiciona as 2 novas colunas à lista imutável)
CREATE OR REPLACE FUNCTION public.protect_bilhete_payment_columns() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.user_id                            IS DISTINCT FROM OLD.user_id
       OR NEW.numero_bilhete                  IS DISTINCT FROM OLD.numero_bilhete
       OR NEW.status_pagamento                IS DISTINCT FROM OLD.status_pagamento
       OR NEW.mp_payment_id                   IS DISTINCT FROM OLD.mp_payment_id
       OR NEW.valor_pago                      IS DISTINCT FROM OLD.valor_pago
       OR NEW.cashback_pago                   IS DISTINCT FROM OLD.cashback_pago
       OR NEW.cashback_pago_em               IS DISTINCT FROM OLD.cashback_pago_em
       OR NEW.cashback_pago_por              IS DISTINCT FROM OLD.cashback_pago_por
       OR NEW.cashback_multiplicador_snapshot IS DISTINCT FROM OLD.cashback_multiplicador_snapshot
       OR NEW.selecao_cashback_id             IS DISTINCT FROM OLD.selecao_cashback_id
       OR NEW.pago_em                         IS DISTINCT FROM OLD.pago_em
       OR NEW.expira_em                       IS DISTINCT FROM OLD.expira_em
    THEN
      RAISE EXCEPTION 'Colunas de pagamento somente alteráveis via service_role'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. RPC admin_cashbacks_kpis
CREATE OR REPLACE FUNCTION public.admin_cashbacks_kpis()
RETURNS TABLE (
  exposicao_total        numeric,
  pior_cenario_selecao   text,
  pior_cenario_valor     numeric,
  bilhetes_elegiveis     bigint,
  a_pagar_agora          bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      b.id,
      b.valor_pago,
      b.cashback_multiplicador_snapshot,
      b.cashback_pago,
      b.selecao_cashback_id,
      s.nome AS selecao_nome,
      (b.valor_pago * b.cashback_multiplicador_snapshot) AS exposicao
    FROM bilhetes b
    JOIN selecoes s ON s.id = b.selecao_cashback_id
    WHERE b.status_pagamento = 'confirmado'
      AND b.selecao_cashback_id IS NOT NULL
      AND b.valor_pago >= 100
  ),
  por_selecao AS (
    SELECT
      selecao_cashback_id,
      selecao_nome,
      SUM(exposicao) AS total_exposicao
    FROM base
    GROUP BY selecao_cashback_id, selecao_nome
  ),
  pior AS (
    SELECT selecao_nome, total_exposicao
    FROM por_selecao
    ORDER BY total_exposicao DESC
    LIMIT 1
  ),
  copa AS (
    SELECT campeao_id, finalizada FROM copa_resultados WHERE id = 1
  )
  SELECT
    COALESCE((SELECT SUM(exposicao) FROM base), 0)                 AS exposicao_total,
    COALESCE((SELECT selecao_nome FROM pior), '—')                 AS pior_cenario_selecao,
    COALESCE((SELECT total_exposicao FROM pior), 0)                AS pior_cenario_valor,
    (SELECT COUNT(*) FROM base)                                    AS bilhetes_elegiveis,
    CASE
      WHEN (SELECT finalizada FROM copa) = true THEN (
        SELECT COUNT(*) FROM base
        WHERE selecao_cashback_id = (SELECT campeao_id FROM copa)
          AND cashback_pago = false
      )
      ELSE NULL
    END                                                            AS a_pagar_agora;
$$;
```

---

## 6. `lib/cashback.ts` — adição de `calcularValorCashback`

Adiciona a função à lib existente do F6. **Não reescreve** o arquivo — apenas acrescenta:

```ts
// Tipo mínimo necessário (já deve existir na lib ou em types/)
export type BilheteParaCashback = {
  valor_pago: number
  cashback_multiplicador_snapshot: number
}

/** Valor que o admin deve transferir via PIX ao apostador.
 *  Fonte única da fórmula: valor_pago × multiplicador_snapshot. */
export function calcularValorCashback(bilhete: BilheteParaCashback): number {
  return bilhete.valor_pago * bilhete.cashback_multiplicador_snapshot
}
```

---

## 7. `lib/cashback-pagamento.ts` — lib pura (F11)

```ts
import { calcularValorCashback } from './cashback'

export type BilheteElegibilidade = {
  valor_pago: number
  cashback_multiplicador_snapshot: number
  selecao_cashback_id: number | null
  cashback_pago: boolean
  status_pagamento: string
}

export type CopaResultadosElegibilidade = {
  finalizada: boolean
  campeao_id: number | null
}

export type ResultadoElegibilidade =
  | { elegivel: true }
  | {
      elegivel: false
      motivo:
        | 'copa_nao_finalizada'
        | 'selecao_nao_campea'
        | 'ja_pago'
        | 'valor_minimo_nao_atingido'
    }

/** Determina se um bilhete deve receber cashback.
 *  Ordem das verificações: mais restritiva primeiro (falha rápida). */
export function isElegivelPagamento(
  bilhete: BilheteElegibilidade,
  copa: CopaResultadosElegibilidade,
): ResultadoElegibilidade {
  if (!copa.finalizada) return { elegivel: false, motivo: 'copa_nao_finalizada' }
  if (bilhete.valor_pago < 100) return { elegivel: false, motivo: 'valor_minimo_nao_atingido' }
  if (bilhete.selecao_cashback_id !== copa.campeao_id)
    return { elegivel: false, motivo: 'selecao_nao_campea' }
  if (bilhete.cashback_pago) return { elegivel: false, motivo: 'ja_pago' }
  return { elegivel: true }
}

export type BilheteExposicao = {
  valor_pago: number
  cashback_multiplicador_snapshot: number
}

/** Agrega exposição financeira de uma lista de bilhetes de uma seleção. */
export function exposicaoSelecao(bilhetes: BilheteExposicao[]): {
  total: number
  count: number
} {
  return {
    total: bilhetes.reduce((acc, b) => acc + calcularValorCashback(b), 0),
    count: bilhetes.length,
  }
}
```

---

## 8. TDD — `lib/__tests__/cashback-pagamento.test.ts`

Cobertura obrigatória ≥ 95%.

### `isElegivelPagamento`

| Caso | bilhete | copa | esperado |
|------|---------|------|---------|
| Copa não finalizada | qualquer | `finalizada: false` | `{ elegivel: false, motivo: 'copa_nao_finalizada' }` |
| Valor abaixo do mínimo | `valor_pago: 99` | `finalizada: true, campeao_id: 1` | `{ elegivel: false, motivo: 'valor_minimo_nao_atingido' }` |
| Seleção não é campeã | `selecao_cashback_id: 5` | `finalizada: true, campeao_id: 10` | `{ elegivel: false, motivo: 'selecao_nao_campea' }` |
| Já pago | `cashback_pago: true, selecao_cashback_id: 10` | `finalizada: true, campeao_id: 10, valor_pago: 100` | `{ elegivel: false, motivo: 'ja_pago' }` |
| Todos os critérios OK | `valor_pago: 100, selecao_cashback_id: 10, cashback_pago: false` | `finalizada: true, campeao_id: 10` | `{ elegivel: true }` |
| Valor exato no limite | `valor_pago: 100` | campeão correto | elegível |
| Copa finalizada mas campeão null | `selecao_cashback_id: 10` | `finalizada: true, campeao_id: null` | `{ elegivel: false, motivo: 'selecao_nao_campea' }` |

### `calcularValorCashback` (em `lib/cashback.ts`)

| Caso | valor_pago | multiplicador | esperado |
|------|-----------|---------------|---------|
| Tier 1× | 100 | 1.0 | 100 |
| Tier 2× | 200 | 2.0 | 400 |
| Tier 3× | 150 | 3.0 | 450 |
| Tier 5× | 100 | 5.0 | 500 |
| Multiplicador zero | 100 | 0 | 0 |
| Valor não elegível | 50 | 5.0 | 250 (cálculo puro; elegibilidade é responsabilidade de isElegivelPagamento) |

### `exposicaoSelecao`

| Caso | bilhetes | esperado |
|------|---------|---------|
| Lista vazia | `[]` | `{ total: 0, count: 0 }` |
| 1 bilhete R$100, mult 2× | `[{ valor_pago: 100, snapshot: 2.0 }]` | `{ total: 200, count: 1 }` |
| 3 bilhetes variados | mix de tiers | soma correta |
| Mult zero | `cashback_multiplicador_snapshot: 0` | não contribui para total |

---

## 9. API Route — `POST /api/admin/cashbacks/marcar-pago`

**Guard:** `createSupabaseServerClient` → verifica auth → `supabaseAdmin` checa `profiles.is_admin`. Retorna 403 se não for admin. Mesmo padrão F9/F10.

**Body Zod:**
```ts
const bodySchema = z.object({
  bilheteIds: z.array(z.string().uuid()).min(1).max(100),
})
```

**Fluxo:**
1. Valida body com Zod → 400 se inválido
2. `SELECT id=1 FROM copa_resultados` via `supabaseAdmin`
3. `SELECT id, valor_pago, selecao_cashback_id, cashback_multiplicador_snapshot, cashback_pago, status_pagamento FROM bilhetes WHERE id = ANY(bilheteIds)`
4. Para cada bilhete, chama `isElegivelPagamento(bilhete, copa)`
   - Se qualquer bilhete retornar `elegivel: false` com motivo ≠ `'ja_pago'` → retorna 422 com `{ error: motivo, bilheteId }`
   - Bilhetes com `ja_pago` são contabilizados separadamente, não causam erro
5. Bulk UPDATE via `supabaseAdmin`:
   ```sql
   UPDATE bilhetes
   SET cashback_pago = true,
       cashback_pago_em = now(),
       cashback_pago_por = :adminUserId
   WHERE id = ANY(:idsParaMarcar)
     AND cashback_pago = false
   ```
   A condição `AND cashback_pago = false` no banco garante idempotência — não sobrescreve `cashback_pago_em` de bilhetes já marcados.
6. Retorna:
   ```ts
   {
     marcados: number           // rows efetivamente afetadas
     ja_estavam_pagos: number   // bilheteIds que já tinham cashback_pago = true
     total_solicitados: number  // bilheteIds.length
   }
   ```

**Toast no client conforme resposta:**
- `marcados > 0, ja_estavam_pagos = 0` → `"N cashbacks marcados como pagos"`
- `marcados > 0, ja_estavam_pagos > 0` → `"N cashbacks marcados como pagos · X já estavam pagos"`
- `marcados = 0, ja_estavam_pagos > 0` → `"Todos os N já estavam pagos"`

---

## 10. Tela `/admin/cashbacks`

### 10.1 `page.tsx` — Server Component

```ts
// Busca em paralelo: KPIs, bilhetes elegíveis, seleções elegíveis e copa_resultados
const [kpisRes, bilhetesRes, selecoesRes, copaRes] = await Promise.all([
  supabaseAdmin.rpc('admin_cashbacks_kpis'),
  supabaseAdmin
    .from('bilhetes')
    .select(`
      id, numero_bilhete, valor_pago,
      cashback_multiplicador_snapshot, cashback_pago,
      cashback_pago_em, cashback_pago_por,
      selecao_cashback_id,
      apostador:profiles!user_id ( nome ),
      pago_por:profiles!cashback_pago_por ( nome )
    `)
    .eq('status_pagamento', 'confirmado')
    .not('selecao_cashback_id', 'is', null)
    .gte('valor_pago', 100)
    .order('numero_bilhete', { ascending: true }),
  supabaseAdmin
    .from('selecoes')
    .select('id, nome, codigo_iso, cashback_multiplicador')
    .gt('cashback_multiplicador', 0)
    .order('cashback_multiplicador', { ascending: true }),
  supabaseAdmin
    .from('copa_resultados')
    .select('finalizada, campeao_id')
    .eq('id', 1)
    .single(),
])
```

Passa `kpis`, `bilhetes`, `selecoes` (as 13) e `copaResultados` para `CashbacksClient`.

**Nota sobre FK dupla em `profiles`:** o Supabase JS v2 suporta alias de relação (`apostador:profiles!user_id`) para desambiguar duas FKs para a mesma tabela no mesmo select. Se o type gerado não resolver automaticamente, o implementador usa duas queries separadas e faz o join em TypeScript.

### 10.2 `CashbacksClient.tsx` — Client Component

- Recebe `kpis`, `bilhetes` (agrupados por `selecao_cashback_id`), `selecoes` (as 13), `copaResultados`
- Estado local: `expanded: Set<number>` (quais accordions estão abertos), `selected: Set<string>` (bilheteIds selecionados via checkbox), `loading: Set<string>` (bilheteIds com ação em andamento)
- Função `handleMarcarPago(bilheteIds: string[])`: POST para `/api/admin/cashbacks/marcar-pago`, exibe toast conforme resposta, atualiza estado local otimisticamente

### 10.3 `SelecaoCashbackRow.tsx`

Header sempre visível:
```
▶/▼ [bandeira] Nome · [Nx] · N bilhetes · R$ exposição
```
A `exposicaoSelecao()` é chamada no client para calcular o valor exibido.

Quando expandido, renderiza:
- Linha de controle bulk: `[☐ Sel. todos] [Marcar selecionados como pagos]` (disabled se nenhum selecionado)
- Lista de `ApostadorCashbackRow`

### 10.4 `ApostadorCashbackRow.tsx`

```
[☐] #031 João Silva   R$100 → R$200   ○ Pendente         [Marcar pago]
[☑] #044 Ana Costa    R$100 → R$200   ✓ Pago 02/07 /adm  (read-only)
```

**Estados do botão [Marcar pago] e checkbox:**

| Condição | Checkbox | Botão | Tooltip |
|----------|----------|-------|---------|
| `copa.finalizada = false` | presente (mas bulk button disabled) | disabled | "Copa não finalizada" |
| `copa.finalizada = true` e `selecao ≠ campeã` | ausente | ausente | — |
| `copa.finalizada = true` e `selecao = campeã` e `cashback_pago = false` | presente | habilitado | — |
| `cashback_pago = true` | ausente | substituído por "✓ Pago DD/MM" + nome do admin | — |

Linha esmaecida (`opacity-50`) para apostadores de seleções não-campeãs após `finalizada = true`.

**Pré-`finalizada`:** checkbox presente (seleção possível) mas o botão bulk também fica disabled com tooltip "Copa não finalizada" — consistente com o botão individual.

---

## 11. Sidebar: habilitar "Cashbacks"

Em `components/admin/AdminSidebar.tsx`, o item `Cashbacks` está com `comingSoon: true`. F11 remove essa flag e adiciona `href: '/admin/cashbacks'`, convertendo de `<span>` para `<Link>` ativo.

---

## 12. Segurança

- Guard `is_admin` na route handler — mesmo padrão F9/F10
- `supabaseAdmin` (service_role) usado apenas dentro da Route Handler — nunca exposto ao client
- Validação Zod no body antes de tocar o banco
- `protect_bilhete_payment_columns` atualizado: `cashback_pago_em` e `cashback_pago_por` imutáveis por `authenticated` — apenas `service_role` escreve
- Condição `AND cashback_pago = false` no UPDATE como segunda linha de defesa contra idempotência
- Máximo de 100 bilheteIds por chamada (anti-abuse no Zod)
- Validação de `copa_resultados.finalizada` server-side antes de qualquer UPDATE

---

## 13. Contrato com features seguintes

- F12 (Cron API-Football) não toca em cashbacks — escopo de resultados de jogos apenas
- F13 (WhatsApp, opcional) pode usar `cashback_pago_em IS NOT NULL` para saber quem notificar
- `calcularValorCashback` em `lib/cashback.ts` é a fonte única do cálculo para qualquer feature futura

---

## 14. Dependências novas

- Nenhuma dependência npm nova
- Migration: `20260504000001_cashback_audit.sql` (2 colunas + trigger update + RPC)
- `lib/cashback-pagamento.ts` importa de `lib/cashback.ts` (F6) — sem dependência circular
