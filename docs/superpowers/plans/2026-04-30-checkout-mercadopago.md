# Checkout + integração Mercado Pago — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o checkout PIX completo do bolão: migration de schema (rename `asaas_payment_id` → `mp_payment_id`, novos campos de cashback diferenciado, view com `effective_status`, triggers), 4 libs novas (`lib/cashback.ts` + `lib/checkout.ts` + `lib/mercadopago.ts` + `lib/mercadopago.io.ts`), Server Action `criarCheckout` com TX1+TX2, 2 route handlers (polling de status + webhook MP idempotente com HMAC), 4 componentes de UI (Stepper, CashbackPicker, FormulaCheckout, TelaPIX) e 2 pages (`/comprar`, `/comprar/[id]/pix`), além de wiring da landing. Cobertura ≥ 95% em todas as libs puras.

**Architecture:** Modelo B (1 PIX = N bilhetes; o "principal" carrega `valor_pago` total + `selecao_cashback_id`; demais com `valor_pago=0`). P1 (TX1 INSERT pendentes → MP create → TX2 UPDATE com `mp_payment_id`/`expira_em` ou compensação `cancelado`). Cashback diferenciado por tier (1×–5×) em pool curado de 13 elegíveis, com snapshot do multiplicador no bilhete pra proteção do consumidor. Expiração lazy via view `bilhetes_view.effective_status` (CASE on `expira_em`). Webhook idempotente: valida HMAC, faz `GET /v1/payments/{id}` autoritativo no MP, mapeia status, UPDATE condicional `WHERE status_pagamento <> mapped`. Polling client-side a cada 3s. RLS aplicada na view (`security_invoker = true`) — usuário só vê próprios bilhetes.

**Tech Stack:** Next.js 14 App Router · TypeScript estrito · Tailwind v4 · Supabase (auth + Postgres com RLS) · Mercado Pago SDK Node v2 · Zod (validação) · Vitest + @testing-library/react · sonner (toasts) · Lucide Icons. Sem mudança em deps existentes além de adicionar `mercadopago@^2.x.x`.

**Spec:** `docs/superpowers/specs/2026-04-30-checkout-mercadopago-design.md` (commit `d6cdf31` em `main`).

**Estratégia de testes neste plano:**

- **TDD obrigatório** em libs puras (`lib/cashback.ts`, `lib/checkout.ts`, `lib/mercadopago.ts`). Threshold ≥ 95% em linhas/branches/functions/statements expandido pra essas 3 libs em `vitest.config.mts` (atualmente só cobre `lib/pontuacao.ts`).
- **`lib/mercadopago.io.ts` excluído da cobertura** (rede). Confiança vem do E2E manual no sandbox MP (Task 17).
- **Componentes UI:** testes focados em lógica (Stepper math, CashbackPicker filter, FormulaCheckout state machine), sem snapshots. Renderização pura sem comportamento → sem teste.
- **Server Action e Route Handlers:** sem unit tests com mocks pesados (Supabase + MP). A lógica testável já mora nas libs puras (validators, mappers, signature). A camada de orquestração é coberta pelo E2E manual em sandbox MP.
- **E2E manual** (Task 17): 8 cenários do §5 do spec rodando contra sandbox MP real. Não automatizado.

**Prerequisites for the developer (verify before starting):**

- [ ] Worktree configurado em branch `feat/checkout-mercadopago` (controller cria via using-git-worktrees skill antes de dispatchar tasks).
- [ ] HEAD da branch é `d6cdf31` ou descendente (inclui o commit do spec + CLAUDE.md atualizado + `.env.local.example` com MP).
- [ ] `pnpm install` rodou e está atualizado.
- [ ] Quality gates passam no estado inicial:
  - `pnpm typecheck` (zero errors)
  - `pnpm lint` (zero warnings)
  - `pnpm format:check` (no formatting issues)
  - `pnpm test:run` (todos os testes existentes passam)
- [ ] `.env.local` existe no worktree com:
  - Vars Supabase (de F1-F5)
  - `MERCADOPAGO_ACCESS_TOKEN=TEST-...` (sandbox; já populado nesta sessão de brainstorm)
  - `MERCADOPAGO_WEBHOOK_SECRET=...` (já populado)
- [ ] Supabase CLI instalado e linkado ao projeto cloud dev (`supabase link`). Necessário pra Tasks 2-3 e Task 17.
- [ ] Conta sandbox MP ativa com painel acessível (necessário pra Task 17 — cadastrar URL de webhook).
- [ ] (Task 17 only) ngrok ou tunneling equivalente disponível pra expor `localhost:3000` à internet, OU domínio de teste `https://malanacopa.com.br` apontando pro deploy Vercel preview.

---

## Task 1: Foundation — instalar SDK MP + atualizar `lib/env-server.ts` + atualizar `vitest.config.mts`

**Goal:** Adicionar `mercadopago@^2.x.x` como dependência runtime, expandir o schema de `lib/env-server.ts` pra exigir `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` na boot, e expandir `coverage.include` do Vitest pras 3 libs novas (que serão criadas nas Tasks 4-6). Garantir que typecheck/lint/test continuam passando antes de tocar em mais código.

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml` (via `pnpm add`)
- Modify: `lib/env-server.ts`
- Modify: `vitest.config.mts`

- [ ] **Step 1: Install Mercado Pago SDK**

Run:

```bash
pnpm add mercadopago@^2.x.x
```

Expected: `+ mercadopago 2.x.x` em dependencies. `pnpm-lock.yaml` atualizado.

- [ ] **Step 2: Verify install**

Run:

```bash
pnpm list mercadopago
```

Expected: linha mostrando `mercadopago 2.x.x` em dependencies.

- [ ] **Step 3: Update `lib/env-server.ts`**

Substituir o conteúdo de `lib/env-server.ts` pelo seguinte:

```ts
import 'server-only';
import { z } from 'zod';

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MERCADOPAGO_ACCESS_TOKEN: z.string().min(1),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(1),
});

const parsed = schema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN,
  MERCADOPAGO_WEBHOOK_SECRET: process.env.MERCADOPAGO_WEBHOOK_SECRET,
});

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error('❌ Invalid server environment variables:', fieldErrors);
  throw new Error(
    `Invalid server environment variables: ${JSON.stringify(fieldErrors)}. Check .env.local against .env.local.example.`,
  );
}

export const serverEnv = parsed.data;
```

- [ ] **Step 4: Update `vitest.config.mts` coverage include**

Substituir o objeto `coverage` em `vitest.config.mts` por:

```ts
coverage: {
  provider: 'v8',
  include: [
    'lib/pontuacao.ts',
    'lib/cashback.ts',
    'lib/checkout.ts',
    'lib/mercadopago.ts',
  ],
  thresholds: {
    lines: 95,
    branches: 95,
    functions: 95,
    statements: 95,
  },
},
```

(O resto do config — plugins, environment, setupFiles, include, exclude — fica intacto.)

- [ ] **Step 5: Run quality gates**

Run em paralelo (qualquer um falhando bloqueia o commit):

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
```

Expected: todos passam. Em particular, o `test:run` SEM o `--coverage` ainda passa porque `lib/cashback.ts` etc. ainda não existem, mas o include do v8 só vira hard-fail no `test:run --coverage` da Task 17.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml lib/env-server.ts vitest.config.mts
git commit -m "chore(env): install mercadopago SDK + expand env schema and coverage include for F6"
```

---

## Task 2: DB migration — rename, drop legacy, add cashback tiers, add view

**Goal:** Aplicar a migration única descrita em §3.1 do spec: renomeia `asaas_payment_id` → `mp_payment_id`, atualiza trigger `protect_bilhete_payment_columns` (renomeia ref + protege `selecao_cashback_id` e `cashback_multiplicador_snapshot`), remove enforcement legado de 20 vagas (trigger + função + index parcial), adiciona `selecoes.cashback_multiplicador` com seed das 13 elegíveis, adiciona `bilhetes.cashback_multiplicador_snapshot`, cria trigger `enforce_cashback_eligibility` e cria a view `bilhetes_view` com `effective_status`. Após apply, tipos do Supabase precisam ser regenerados — fica pra Task 3.

**Files:**

- Create: `supabase/migrations/<timestamp>_checkout_mercadopago.sql`

- [ ] **Step 1: Scaffold migration**

Run:

```bash
supabase migration new checkout_mercadopago
```

Expected: arquivo novo em `supabase/migrations/<timestamp>_checkout_mercadopago.sql` (vazio).

- [ ] **Step 2: Populate migration with full SQL**

Substituir o conteúdo do arquivo recém-criado pelo seguinte (cópia exata do §3.1 do spec):

```sql
-- ============================================================================
-- Bolão Copa 2026 — Feature 6: Checkout + Mercado Pago
-- ============================================================================
-- Spec: docs/superpowers/specs/2026-04-30-checkout-mercadopago-design.md
--
-- 1. Renomeia bilhetes.asaas_payment_id → mp_payment_id (+index pra webhook)
-- 2. Atualiza protect_bilhete_payment_columns:
--    - referência à coluna nova (mp_payment_id)
--    - protege selecao_cashback_id (não pode mudar pós-pagamento)
--    - protege cashback_multiplicador_snapshot
-- 3. Drop trigger 20-slot + função + index parcial (sem limite de vagas)
-- 4. Adiciona selecoes.cashback_multiplicador (numeric(3,1), default 0)
-- 5. Seed das 13 elegíveis (1×/2×/3×/5×)
-- 6. Adiciona bilhetes.cashback_multiplicador_snapshot (numeric(3,1), default 0)
-- 7. Trigger enforce_cashback_eligibility: rejeita selecao com mult=0;
--    popula snapshot automaticamente em INSERT ou se selecao_cashback_id mudar
-- 8. View bilhetes_view com effective_status (lazy expiration)
-- ============================================================================

-- 1. Rename + index pra webhook lookup
ALTER TABLE bilhetes RENAME COLUMN asaas_payment_id TO mp_payment_id;

CREATE INDEX bilhetes_mp_payment_id_idx
  ON bilhetes(mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;

-- 2. Atualiza trigger de proteção de colunas (renomeia ref + adiciona 2 colunas)
CREATE OR REPLACE FUNCTION public.protect_bilhete_payment_columns() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.user_id                       IS DISTINCT FROM OLD.user_id
       OR NEW.numero_bilhete             IS DISTINCT FROM OLD.numero_bilhete
       OR NEW.status_pagamento           IS DISTINCT FROM OLD.status_pagamento
       OR NEW.mp_payment_id              IS DISTINCT FROM OLD.mp_payment_id
       OR NEW.valor_pago                 IS DISTINCT FROM OLD.valor_pago
       OR NEW.cashback_pago              IS DISTINCT FROM OLD.cashback_pago
       OR NEW.cashback_multiplicador_snapshot IS DISTINCT FROM OLD.cashback_multiplicador_snapshot
       OR NEW.selecao_cashback_id        IS DISTINCT FROM OLD.selecao_cashback_id
       OR NEW.pago_em                    IS DISTINCT FROM OLD.pago_em
       OR NEW.expira_em                  IS DISTINCT FROM OLD.expira_em
    THEN
      RAISE EXCEPTION 'Colunas de pagamento somente alteráveis via service_role'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Remove enforcement legado de 20 vagas
DROP TRIGGER IF EXISTS bilhetes_cashback_slot_trigger ON bilhetes;
DROP FUNCTION IF EXISTS public.enforce_cashback_slot_limit();
DROP INDEX IF EXISTS bilhetes_cashback_active_idx;

-- 4. Cashback multiplicador em selecoes
ALTER TABLE selecoes
  ADD COLUMN cashback_multiplicador numeric(3,1) NOT NULL DEFAULT 0
    CHECK (cashback_multiplicador IN (0, 1.0, 2.0, 3.0, 5.0));

-- 5. Seed dos 13 elegíveis (idempotente — UPDATEs por codigo_iso)
UPDATE selecoes SET cashback_multiplicador = 1.0 WHERE codigo_iso IN ('FRA','ESP','ENG');
UPDATE selecoes SET cashback_multiplicador = 2.0 WHERE codigo_iso IN ('BRA','ARG');
UPDATE selecoes SET cashback_multiplicador = 3.0 WHERE codigo_iso IN ('POR','GER','NED');
UPDATE selecoes SET cashback_multiplicador = 5.0 WHERE codigo_iso IN ('NOR','SUI','BEL','COL','URU');

-- 6. Snapshot do multiplicador na linha do bilhete (item Q6)
ALTER TABLE bilhetes
  ADD COLUMN cashback_multiplicador_snapshot numeric(3,1) NOT NULL DEFAULT 0
    CHECK (cashback_multiplicador_snapshot >= 0);

-- 7. Trigger: valida elegibilidade + popula snapshot automaticamente
CREATE OR REPLACE FUNCTION public.enforce_cashback_eligibility() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  mult numeric(3,1);
BEGIN
  IF NEW.selecao_cashback_id IS NULL THEN
    NEW.cashback_multiplicador_snapshot := 0;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR OLD.selecao_cashback_id IS DISTINCT FROM NEW.selecao_cashback_id THEN

    SELECT cashback_multiplicador INTO mult
    FROM public.selecoes
    WHERE id = NEW.selecao_cashback_id;

    IF mult IS NULL THEN
      RAISE EXCEPTION 'Seleção % não existe', NEW.selecao_cashback_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF mult <= 0 THEN
      RAISE EXCEPTION 'Seleção % não é elegível para cashback (multiplicador 0)',
        NEW.selecao_cashback_id
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.cashback_multiplicador_snapshot := mult;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bilhetes_cashback_eligibility_trigger
BEFORE INSERT OR UPDATE OF selecao_cashback_id ON bilhetes
FOR EACH ROW EXECUTE FUNCTION public.enforce_cashback_eligibility();

-- 8. View bilhetes_view com effective_status (lazy expiration — Q3)
CREATE OR REPLACE VIEW public.bilhetes_view
WITH (security_invoker = true) AS
SELECT
  b.*,
  CASE
    WHEN b.status_pagamento = 'pendente'
         AND b.expira_em IS NOT NULL
         AND b.expira_em < now()
    THEN 'expirado'::status_pagamento
    ELSE b.status_pagamento
  END AS effective_status
FROM public.bilhetes b;

GRANT SELECT ON public.bilhetes_view TO authenticated;
```

- [ ] **Step 3: Apply migration to cloud dev**

Run:

```bash
supabase db push
```

Expected: `Finished supabase db push.` Sem erros. Se houver conflito (schema sujo), abrir Studio em `https://supabase.com/dashboard/project/<ref>/database/migrations` e investigar manualmente antes de prosseguir.

- [ ] **Step 4: Smoke counts (via Studio SQL editor)**

Cole no Studio cada query e verifique o resultado:

```sql
-- 13 seleções com multiplicador > 0
SELECT COUNT(*) FROM selecoes WHERE cashback_multiplicador > 0;
-- Esperado: 13

-- Tier 5× (azarões) — 5 seleções
SELECT codigo_iso FROM selecoes WHERE cashback_multiplicador = 5.0 ORDER BY codigo_iso;
-- Esperado: BEL, COL, NOR, SUI, URU

-- Tier 3× — 3 seleções
SELECT codigo_iso FROM selecoes WHERE cashback_multiplicador = 3.0 ORDER BY codigo_iso;
-- Esperado: GER, NED, POR

-- Tier 2× — 2 seleções
SELECT codigo_iso FROM selecoes WHERE cashback_multiplicador = 2.0 ORDER BY codigo_iso;
-- Esperado: ARG, BRA

-- Tier 1× — 3 seleções
SELECT codigo_iso FROM selecoes WHERE cashback_multiplicador = 1.0 ORDER BY codigo_iso;
-- Esperado: ENG, ESP, FRA

-- Trigger antigo + função antiga foram removidos
SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'bilhetes_cashback_slot_trigger';
-- Esperado: 0

SELECT COUNT(*) FROM pg_proc WHERE proname = 'enforce_cashback_slot_limit';
-- Esperado: 0

-- Coluna nova existe em bilhetes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bilhetes' AND column_name IN ('mp_payment_id', 'cashback_multiplicador_snapshot');
-- Esperado: 2 linhas

-- View bilhetes_view existe e tem effective_status
SELECT column_name FROM information_schema.columns
WHERE table_name = 'bilhetes_view' AND column_name = 'effective_status';
-- Esperado: 1 linha
```

Se qualquer count falhar, abortar e investigar antes de seguir.

- [ ] **Step 5: Trigger smoke — eligibility (no Studio, conexão authenticated/admin)**

```sql
-- Setup: pega ID do Haiti (multiplicador 0) e do Brasil (multiplicador 2.0)
SELECT id, nome, codigo_iso, cashback_multiplicador FROM selecoes
WHERE codigo_iso IN ('HAI', 'BRA');

-- Substitua <user_id> por algum auth.users.id real (do dev/admin)
-- e <haiti_id> / <brasil_id> pelos IDs retornados acima

-- (a) INSERT com Haiti deve falhar
INSERT INTO bilhetes (user_id, valor_pago, selecao_cashback_id, status_pagamento)
VALUES ('<user_id>', 100, <haiti_id>, 'pendente');
-- Esperado: ERROR: Seleção <id> não é elegível para cashback (multiplicador 0)

-- (b) INSERT com Brasil deve sucesso e popular snapshot=2.0
INSERT INTO bilhetes (user_id, valor_pago, selecao_cashback_id, status_pagamento)
VALUES ('<user_id>', 100, <brasil_id>, 'pendente')
RETURNING id, cashback_multiplicador_snapshot;
-- Esperado: 1 linha, snapshot = 2.0

-- Cleanup
DELETE FROM bilhetes WHERE selecao_cashback_id = <brasil_id> AND status_pagamento = 'pendente';
```

- [ ] **Step 6: View smoke — effective_status (no Studio)**

```sql
-- Setup: insere bilhete pendente com expira_em no passado
INSERT INTO bilhetes (user_id, valor_pago, status_pagamento, expira_em)
VALUES ('<user_id>', 20, 'pendente', now() - interval '1 minute')
RETURNING id;
-- Anote o ID retornado.

-- Verifica que effective_status virou 'expirado' na view
SELECT id, status_pagamento, expira_em, effective_status
FROM bilhetes_view WHERE id = '<id_anotado>';
-- Esperado: status_pagamento='pendente', effective_status='expirado'

-- Cleanup
DELETE FROM bilhetes WHERE id = '<id_anotado>';
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/<timestamp>_checkout_mercadopago.sql
git commit -m "feat(db): F6 migration (mp_payment_id rename + cashback tiers + view + triggers)"
```

---

## Task 3: Regenerate Supabase types

**Goal:** Atualizar `lib/supabase/types.ts` com o schema novo. Após Task 2, a coluna `asaas_payment_id` virou `mp_payment_id`, `cashback_multiplicador_snapshot` foi adicionada em `bilhetes`, `cashback_multiplicador` em `selecoes`, e `bilhetes_view` apareceu como nova view. TypeScript estrito quebra em qualquer arquivo que ainda referencie `asaas_payment_id` (não deve haver nenhum, já que F2 não exportou esse campo pra UI; verificar via grep).

**Files:**

- Modify: `lib/supabase/types.ts`

- [ ] **Step 1: Regenerate types**

Run:

```bash
pnpm supabase:types
```

Expected: `lib/supabase/types.ts` regenerado. Diff mostra:

- Em `bilhetes.Row`: `asaas_payment_id: string | null` → `mp_payment_id: string | null`; nova `cashback_multiplicador_snapshot: number`.
- Em `selecoes.Row`: nova `cashback_multiplicador: number`.
- Nova entrada em `Views` chamada `bilhetes_view` com todos os campos de bilhetes + `effective_status`.

- [ ] **Step 2: Verify typecheck still passes**

Run:

```bash
pnpm typecheck
```

Expected: zero erros. Se aparecer erro mencionando `asaas_payment_id` em algum arquivo, gritar pro user (não deveria existir referência fora da migration que acabou de renomear).

Run grep pra confirmar:

```bash
grep -rn "asaas_payment_id" --include="*.ts" --include="*.tsx" lib app
```

Expected: zero matches (a única referência possível seria em `lib/supabase/types.ts` antigo, agora regenerado).

- [ ] **Step 3: Run all quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
```

Expected: todos passam.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "chore(db): regenerate Supabase types after F6 migration"
```

---

## Task 4: `lib/cashback.ts` + tests (TDD, ≥ 95% coverage)

**Goal:** Implementar lib pura de cashback: tipo `CashbackMultiplicador`, constantes `CASHBACK_VALOR_MINIMO` e `SELECOES_ELEGIVEIS`, funções `calcularValorCashback`, `elegivelCashback`, `isMultiplicadorValido`. TDD obrigatório.

**Files:**

- Create: `lib/cashback.ts`
- Create: `lib/__tests__/cashback.test.ts`

- [ ] **Step 1: Create test file with all failing tests**

Create `lib/__tests__/cashback.test.ts` com:

```ts
import { describe, expect, it } from 'vitest';
import {
  CASHBACK_VALOR_MINIMO,
  SELECOES_ELEGIVEIS,
  calcularValorCashback,
  elegivelCashback,
  isMultiplicadorValido,
  type CashbackMultiplicador,
} from '@/lib/cashback';

describe('lib/cashback — constantes', () => {
  it('CASHBACK_VALOR_MINIMO === 100', () => {
    expect(CASHBACK_VALOR_MINIMO).toBe(100);
  });

  it('SELECOES_ELEGIVEIS bate com CLAUDE.md §3.3', () => {
    expect(SELECOES_ELEGIVEIS).toEqual({
      1.0: ['FRA', 'ESP', 'ENG'],
      2.0: ['BRA', 'ARG'],
      3.0: ['POR', 'GER', 'NED'],
      5.0: ['NOR', 'SUI', 'BEL', 'COL', 'URU'],
    });
  });

  it('SELECOES_ELEGIVEIS soma 13 ao todo', () => {
    const total = Object.values(SELECOES_ELEGIVEIS).flat().length;
    expect(total).toBe(13);
  });
});

describe('lib/cashback — calcularValorCashback', () => {
  it('100 × 5.0 === 500 (Colômbia 5×)', () => {
    expect(calcularValorCashback(100, 5.0)).toBe(500);
  });

  it('100 × 3.0 === 300 (Portugal 3×)', () => {
    expect(calcularValorCashback(100, 3.0)).toBe(300);
  });

  it('100 × 2.0 === 200 (Brasil 2×)', () => {
    expect(calcularValorCashback(100, 2.0)).toBe(200);
  });

  it('100 × 1.0 === 100 (França 1×)', () => {
    expect(calcularValorCashback(100, 1.0)).toBe(100);
  });

  it('80 × 2.0 === 160 (qualquer valor maior que zero)', () => {
    expect(calcularValorCashback(80, 2.0)).toBe(160);
  });

  it('0 × 5.0 === 0 (multiplicador 0 → cashback 0)', () => {
    expect(calcularValorCashback(100, 0)).toBe(0);
  });

  it('33.33 × 3.0 === 99.99 (preserva 2 casas decimais)', () => {
    expect(calcularValorCashback(33.33, 3.0)).toBe(99.99);
  });

  it('arredonda 0.005 pra cima (banker rounding consistency check)', () => {
    // 33.335 × 3 = 100.005 → round() = 100.01 (Math.round arredonda .5 para cima)
    expect(calcularValorCashback(33.335, 3.0)).toBe(100.01);
  });

  it('lança em valor_pago negativo', () => {
    expect(() => calcularValorCashback(-1, 1.0)).toThrow('valor_pago não pode ser negativo');
  });
});

describe('lib/cashback — elegivelCashback', () => {
  it('100.00 → true (exato no threshold)', () => {
    expect(elegivelCashback(100.0)).toBe(true);
  });

  it('99.99 → false', () => {
    expect(elegivelCashback(99.99)).toBe(false);
  });

  it('200 → true', () => {
    expect(elegivelCashback(200)).toBe(true);
  });

  it('0 → false', () => {
    expect(elegivelCashback(0)).toBe(false);
  });
});

describe('lib/cashback — isMultiplicadorValido', () => {
  it.each([0, 1.0, 2.0, 3.0, 5.0])('aceita %s', (n) => {
    expect(isMultiplicadorValido(n)).toBe(true);
  });

  it.each([0.5, 1.5, 4.0, 6.0, -1, 10, NaN])('rejeita %s', (n) => {
    expect(isMultiplicadorValido(n)).toBe(false);
  });

  it('estreita o tipo (compile-time)', () => {
    const x: number = 5.0;
    if (isMultiplicadorValido(x)) {
      const y: CashbackMultiplicador = x; // não compila se a estreita falhar
      expect(y).toBe(5.0);
    }
  });
});
```

- [ ] **Step 2: Run tests — all should fail (file doesn't exist yet)**

Run:

```bash
pnpm test:run lib/__tests__/cashback.test.ts
```

Expected: FAIL com `Cannot find module '@/lib/cashback'` ou similar.

- [ ] **Step 3: Create `lib/cashback.ts`**

Create `lib/cashback.ts` com:

```ts
/**
 * Cálculos de cashback. Lib pura — sem I/O, sem importação de Database.
 *
 * Spec: docs/superpowers/specs/2026-04-30-checkout-mercadopago-design.md §3.2
 * Regras: CLAUDE.md §3.3 (cashback diferenciado).
 */

/** Multiplicadores válidos do pool de 13 elegíveis + 0 pra fora-do-pool. */
export type CashbackMultiplicador = 0 | 1.0 | 2.0 | 3.0 | 5.0;

/** Threshold mínimo pra cashback ser ofertado. CLAUDE.md §3.3. */
export const CASHBACK_VALOR_MINIMO = 100.0 as const;

/** Lista hardcoded dos códigos ISO elegíveis por tier. Espelha o seed da migration. */
export const SELECOES_ELEGIVEIS = {
  1.0: ['FRA', 'ESP', 'ENG'] as const,
  2.0: ['BRA', 'ARG'] as const,
  3.0: ['POR', 'GER', 'NED'] as const,
  5.0: ['NOR', 'SUI', 'BEL', 'COL', 'URU'] as const,
} as const;

/**
 * Calcula o valor a devolver se a seleção do cashback for campeã.
 * Usa o snapshot armazenado no bilhete (não busca em selecoes).
 *
 * Retorna número arredondado a 2 casas decimais.
 *
 * @example
 *   calcularValorCashback(100, 5.0) === 500
 *   calcularValorCashback(80, 2.0) === 160
 *   calcularValorCashback(33.33, 3.0) === 99.99
 */
export function calcularValorCashback(
  valor_pago: number,
  multiplicador: CashbackMultiplicador,
): number {
  if (valor_pago < 0) {
    throw new Error('valor_pago não pode ser negativo');
  }
  return Math.round(valor_pago * multiplicador * 100) / 100;
}

/**
 * Verifica se um valor de compra qualifica para o cashback (>= R$100).
 */
export function elegivelCashback(valor_pago: number): boolean {
  return valor_pago >= CASHBACK_VALOR_MINIMO;
}

/**
 * Type guard pro multiplicador. Útil em validações vindas do banco
 * (numeric → number) onde TS não estreita o tipo automaticamente.
 */
export function isMultiplicadorValido(n: number): n is CashbackMultiplicador {
  return n === 0 || n === 1.0 || n === 2.0 || n === 3.0 || n === 5.0;
}
```

- [ ] **Step 4: Run tests — all should pass**

Run:

```bash
pnpm test:run lib/__tests__/cashback.test.ts
```

Expected: PASS, com todos os ~25 tests verdes.

- [ ] **Step 5: Run coverage and verify ≥ 95%**

Run:

```bash
pnpm test:run --coverage
```

Expected: cobertura de `lib/cashback.ts` em ≥ 95% (linhas, branches, functions, statements). Se não, ver onde tá descoberto e adicionar teste.

- [ ] **Step 6: Quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: tudo passa.

- [ ] **Step 7: Commit**

```bash
git add lib/cashback.ts lib/__tests__/cashback.test.ts
git commit -m "feat(checkout): add lib/cashback.ts with full test coverage"
```

---

## Task 5: `lib/checkout.ts` + tests (TDD, ≥ 95% coverage)

**Goal:** Implementar mapeadores MP↔domínio: tipo `MPPaymentPayload`, função `montarPayloadMP` (constrói payload de POST /v1/payments), função `mapearStatusMP` (mapeia raw MP status pro nosso enum). TDD obrigatório.

**Files:**

- Create: `lib/checkout.ts`
- Create: `lib/__tests__/checkout.test.ts`

- [ ] **Step 1: Create test file**

Create `lib/__tests__/checkout.test.ts` com:

```ts
import { describe, expect, it } from 'vitest';
import { montarPayloadMP, mapearStatusMP, type MPPaymentPayload } from '@/lib/checkout';

describe('lib/checkout — montarPayloadMP', () => {
  const base = {
    qty: 5,
    user_email: 'jonatas@example.com',
    bilhete_principal_id: '11111111-1111-1111-1111-111111111111',
    expira_em: '2026-04-30T18:00:00.000Z',
  };

  it('transaction_amount = qty × 20', () => {
    const payload = montarPayloadMP(base);
    expect(payload.transaction_amount).toBe(100);
  });

  it('description menciona "tabelas" no plural', () => {
    expect(montarPayloadMP({ ...base, qty: 5 }).description).toBe('Bolão Copa 2026 — 5 tabelas');
  });

  it('description usa "tabela" singular quando qty=1', () => {
    expect(montarPayloadMP({ ...base, qty: 1 }).description).toBe('Bolão Copa 2026 — 1 tabela');
  });

  it('payment_method_id === "pix"', () => {
    expect(montarPayloadMP(base).payment_method_id).toBe('pix');
  });

  it('payer.email é o user_email passado', () => {
    expect(montarPayloadMP(base).payer.email).toBe('jonatas@example.com');
  });

  it('payer.first_name é incluído quando user_name é passado', () => {
    expect(montarPayloadMP({ ...base, user_name: 'Jonatas' }).payer).toEqual({
      email: 'jonatas@example.com',
      first_name: 'Jonatas',
    });
  });

  it('payer.first_name é OMITIDO quando user_name é undefined', () => {
    const payload = montarPayloadMP(base);
    expect(payload.payer).toEqual({ email: 'jonatas@example.com' });
    expect('first_name' in payload.payer).toBe(false);
  });

  it('external_reference é o bilhete_principal_id', () => {
    expect(montarPayloadMP(base).external_reference).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('date_of_expiration é o expira_em passado', () => {
    expect(montarPayloadMP(base).date_of_expiration).toBe('2026-04-30T18:00:00.000Z');
  });

  it('lança em qty < 1', () => {
    expect(() => montarPayloadMP({ ...base, qty: 0 })).toThrow('qty deve estar entre 1 e 50');
  });

  it('lança em qty > 50', () => {
    expect(() => montarPayloadMP({ ...base, qty: 51 })).toThrow('qty deve estar entre 1 e 50');
  });

  it('aceita qty=1 e qty=50 (limites)', () => {
    expect(() => montarPayloadMP({ ...base, qty: 1 })).not.toThrow();
    expect(() => montarPayloadMP({ ...base, qty: 50 })).not.toThrow();
  });
});

describe('lib/checkout — mapearStatusMP', () => {
  it.each([
    ['pending', 'pendente'],
    ['in_process', 'pendente'],
    ['in_mediation', 'pendente'],
    ['authorized', 'pendente'],
    ['approved', 'confirmado'],
    ['cancelled', 'cancelado'],
    ['rejected', 'cancelado'],
    ['refunded', 'cancelado'],
    ['charged_back', 'cancelado'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(mapearStatusMP(input, '')).toBe(expected);
  });

  it('lança em status desconhecido (fail-closed)', () => {
    expect(() => mapearStatusMP('hibernating', '')).toThrow('Status MP desconhecido: hibernating');
  });

  it('status_detail não afeta mapeamento (atualmente ignorado)', () => {
    expect(mapearStatusMP('approved', 'whatever')).toBe('confirmado');
  });
});
```

- [ ] **Step 2: Run tests — fail**

Run:

```bash
pnpm test:run lib/__tests__/checkout.test.ts
```

Expected: FAIL com `Cannot find module '@/lib/checkout'`.

- [ ] **Step 3: Create `lib/checkout.ts`**

Create `lib/checkout.ts` com:

```ts
/**
 * Mapeadores entre o domínio do bolão e a API do Mercado Pago.
 * Lib pura — sem I/O.
 *
 * Spec: docs/superpowers/specs/2026-04-30-checkout-mercadopago-design.md §3.3
 */

import type { Database } from '@/lib/supabase/types';

type StatusPagamento = Database['public']['Enums']['status_pagamento'];

/** Payload aceito pelo POST /v1/payments do MP pra PIX. */
export type MPPaymentPayload = {
  transaction_amount: number;
  description: string;
  payment_method_id: 'pix';
  payer: { email: string; first_name?: string };
  external_reference: string;
  date_of_expiration: string;
};

/**
 * Constrói payload de criação de pagamento PIX.
 * `qty * 20` em reais. `external_reference` é o ID do bilhete principal,
 * o que permite ao webhook localizar a linha autoritativa rapidamente.
 */
export function montarPayloadMP(args: {
  qty: number;
  user_email: string;
  user_name?: string;
  bilhete_principal_id: string;
  expira_em: string;
}): MPPaymentPayload {
  if (args.qty < 1 || args.qty > 50) {
    throw new Error('qty deve estar entre 1 e 50');
  }
  return {
    transaction_amount: args.qty * 20,
    description: `Bolão Copa 2026 — ${args.qty} ${args.qty === 1 ? 'tabela' : 'tabelas'}`,
    payment_method_id: 'pix',
    payer: {
      email: args.user_email,
      ...(args.user_name ? { first_name: args.user_name } : {}),
    },
    external_reference: args.bilhete_principal_id,
    date_of_expiration: args.expira_em,
  };
}

/**
 * Mapeia status do MP pro nosso enum status_pagamento.
 *
 * Lança em status desconhecido (fail-closed) — webhook handler captura
 * e responde 200 com warning log (MP retry não ajuda em status novo).
 */
export function mapearStatusMP(mp_status: string, _mp_status_detail: string): StatusPagamento {
  switch (mp_status) {
    case 'pending':
    case 'in_process':
    case 'in_mediation':
    case 'authorized':
      return 'pendente';
    case 'approved':
      return 'confirmado';
    case 'cancelled':
    case 'rejected':
    case 'refunded':
    case 'charged_back':
      return 'cancelado';
    default:
      throw new Error(`Status MP desconhecido: ${mp_status}`);
  }
}
```

- [ ] **Step 4: Run tests — pass**

Run:

```bash
pnpm test:run lib/__tests__/checkout.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run coverage**

```bash
pnpm test:run --coverage
```

Expected: cobertura de `lib/checkout.ts` ≥ 95%.

- [ ] **Step 6: Quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
```

- [ ] **Step 7: Commit**

```bash
git add lib/checkout.ts lib/__tests__/checkout.test.ts
git commit -m "feat(checkout): add lib/checkout.ts (MP payload + status mappers)"
```

---

## Task 6: `lib/mercadopago.ts` (signature validation) + tests

**Goal:** Implementar `validarAssinaturaWebhook` (HMAC-SHA256 timing-safe) e exportar tipo `MPPaymentResponse`. TDD com fixtures conhecidas. ≥ 95% coverage.

**Files:**

- Create: `lib/mercadopago.ts`
- Create: `lib/__tests__/mercadopago.test.ts`

- [ ] **Step 1: Compute test fixtures**

Antes de escrever os testes, gere os HMACs de exemplo usando `node`:

Run:

```bash
node -e "
const crypto = require('crypto');
const secret = 'test-secret';
const data_id = '12345';
const x_request_id = 'req-abc';
const ts = '1735689600';
const template = 'id:' + data_id + ';request-id:' + x_request_id + ';ts:' + ts + ';';
console.log('template:', template);
console.log('hmac:', crypto.createHmac('sha256', secret).update(template).digest('hex'));
"
```

Expected output (cole no test file):

```
template: id:12345;request-id:req-abc;ts:1735689600;
hmac: <hex_string>
```

Anote o `<hex_string>` retornado — vai ser usado no Step 2.

- [ ] **Step 2: Create test file**

Create `lib/__tests__/mercadopago.test.ts` com (substituir `<HMAC_VALIDO>` pelo hex do step 1):

```ts
import { describe, expect, it } from 'vitest';
import { validarAssinaturaWebhook } from '@/lib/mercadopago';

const SECRET = 'test-secret';
const DATA_ID = '12345';
const REQUEST_ID = 'req-abc';
const TS = '1735689600';
const HMAC_VALIDO = '<HMAC_VALIDO>'; // do step 1

describe('lib/mercadopago — validarAssinaturaWebhook', () => {
  it('aceita assinatura válida', () => {
    const ok = validarAssinaturaWebhook({
      x_signature: `ts=${TS},v1=${HMAC_VALIDO}`,
      x_request_id: REQUEST_ID,
      data_id: DATA_ID,
      secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it('rejeita assinatura adulterada (1 char trocado)', () => {
    const adulterado = HMAC_VALIDO.slice(0, -1) + (HMAC_VALIDO.slice(-1) === 'a' ? 'b' : 'a');
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS},v1=${adulterado}`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita timestamp diferente (assinatura calculada com outro ts)', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=9999999999,v1=${HMAC_VALIDO}`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita data_id diferente', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS},v1=${HMAC_VALIDO}`,
        x_request_id: REQUEST_ID,
        data_id: 'other-id',
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita request_id diferente', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS},v1=${HMAC_VALIDO}`,
        x_request_id: 'other-req',
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita secret diferente', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS},v1=${HMAC_VALIDO}`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: 'other-secret',
      }),
    ).toBe(false);
  });

  it('rejeita header malformado (sem ts=)', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `v1=${HMAC_VALIDO}`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita header malformado (sem v1=)', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS}`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita header vazio', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: '',
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita v1 não-hex sem throw (graceful)', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS},v1=not-hex-string`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('aceita extra keys no header (parse robusto)', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS},v1=${HMAC_VALIDO},extra=ignored`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests — fail (file doesn't exist)**

Run:

```bash
pnpm test:run lib/__tests__/mercadopago.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Create `lib/mercadopago.ts`**

Create `lib/mercadopago.ts` com:

```ts
import 'server-only';
import crypto from 'node:crypto';

/** Resposta normalizada do MP pro nosso domínio. Usada também por `lib/mercadopago.io.ts`. */
export type MPPaymentResponse = {
  id: string;
  status: string;
  status_detail: string;
  transaction_amount: number;
  date_approved: string | null;
  date_of_expiration: string;
  qr_code: string;
  qr_code_base64: string;
};

/**
 * Valida assinatura HMAC-SHA256 enviada pelo MP em `x-signature`.
 *
 * Header format: `ts=<unix_ts>,v1=<hmac_hex>`
 * Template assinado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 */
export function validarAssinaturaWebhook(args: {
  x_signature: string;
  x_request_id: string;
  data_id: string;
  secret: string;
}): boolean {
  try {
    const { x_signature, x_request_id, data_id, secret } = args;
    const parts = x_signature.split(',').reduce<Record<string, string>>((acc, kv) => {
      const [k, v] = kv.split('=').map((s) => s.trim());
      if (k && v) acc[k] = v;
      return acc;
    }, {});
    const ts = parts.ts;
    const v1 = parts.v1;
    if (!ts || !v1) return false;

    const template = `id:${data_id};request-id:${x_request_id};ts:${ts};`;
    const expected = crypto.createHmac('sha256', secret).update(template).digest('hex');

    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(v1, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
```

> **Nota sobre `'server-only'`:** o pacote força erro de build se o módulo for importado em Client Component. `lib/mercadopago.ts` usa `node:crypto` e dados sensíveis, então tem que ser server-only. Os testes Vitest rodam em jsdom mas o `'server-only'` é tratado via `vitest.setup.ts` da F4 (mocked).

Verifique que `vitest.setup.ts` mocka `'server-only'`. Se não, adicione:

Run primeiro:

```bash
grep -n "server-only" vitest.setup.ts
```

Se aparecer uma linha tipo `vi.mock('server-only', () => ({}))`, está OK. Se não, edite `vitest.setup.ts` adicionando essa linha (geralmente no topo).

- [ ] **Step 5: Run tests — pass**

Run:

```bash
pnpm test:run lib/__tests__/mercadopago.test.ts
```

Expected: PASS, todos os 11 tests verdes.

- [ ] **Step 6: Run coverage**

```bash
pnpm test:run --coverage
```

Expected: cobertura de `lib/mercadopago.ts` ≥ 95%. O bloco `try/catch` deve estar coberto pelos testes de "header malformado" e "v1 não-hex".

- [ ] **Step 7: Quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
```

- [ ] **Step 8: Commit**

```bash
git add lib/mercadopago.ts lib/__tests__/mercadopago.test.ts vitest.setup.ts
git commit -m "feat(checkout): add lib/mercadopago.ts (HMAC signature validation)"
```

(Inclui `vitest.setup.ts` no commit somente se foi modificado no Step 4.)

---

## Task 7: `lib/mercadopago.io.ts` (SDK calls — sem testes)

**Goal:** Implementar wrappers sobre o SDK oficial `mercadopago` v2: `criarPagamentoPIX` e `consultarPagamento`. Sem testes unitários (rede; coberto por E2E em sandbox real na Task 17). Excluído do coverage do Vitest.

**Files:**

- Create: `lib/mercadopago.io.ts`

- [ ] **Step 1: Create `lib/mercadopago.io.ts`**

Create `lib/mercadopago.io.ts` com:

```ts
import 'server-only';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { serverEnv } from '@/lib/env-server';
import type { MPPaymentResponse } from './mercadopago';
import type { MPPaymentPayload } from './checkout';

const client = new MercadoPagoConfig({ accessToken: serverEnv.MERCADOPAGO_ACCESS_TOKEN });
const payment = new Payment(client);

/**
 * Cria pagamento PIX via SDK oficial.
 * Lança em qualquer falha (rede, 4xx, 5xx) — caller decide o que fazer.
 */
export async function criarPagamentoPIX(payload: MPPaymentPayload): Promise<MPPaymentResponse> {
  const result = await payment.create({ body: payload });
  return normalize(result);
}

/**
 * Consulta estado autoritativo de um pagamento.
 */
export async function consultarPagamento(payment_id: string): Promise<MPPaymentResponse> {
  const result = await payment.get({ id: payment_id });
  return normalize(result);
}

function normalize(r: any): MPPaymentResponse {
  return {
    id: String(r.id ?? throwIfMissing('id')),
    status: r.status ?? throwIfMissing('status'),
    status_detail: r.status_detail ?? '',
    transaction_amount: r.transaction_amount ?? throwIfMissing('transaction_amount'),
    date_approved: r.date_approved ?? null,
    date_of_expiration: r.date_of_expiration ?? throwIfMissing('date_of_expiration'),
    qr_code: r.point_of_interaction?.transaction_data?.qr_code ?? '',
    qr_code_base64: r.point_of_interaction?.transaction_data?.qr_code_base64 ?? '',
  };
}

function throwIfMissing(field: string): never {
  throw new Error(`Resposta MP sem campo obrigatório: ${field}`);
}
```

- [ ] **Step 2: Verify file is excluded from coverage**

Confirme que `lib/mercadopago.io.ts` NÃO está no `vitest.config.mts` `coverage.include`. Run:

```bash
grep "mercadopago.io" vitest.config.mts
```

Expected: zero matches.

- [ ] **Step 3: Quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
```

Expected: tudo passa. Os tipos do SDK MP devem casar — se houver erro de tipo no `payment.create`/`payment.get`, isso indica que o SDK na versão instalada tem assinatura diferente da assumida; checar [docs do SDK](https://www.npmjs.com/package/mercadopago) e ajustar.

- [ ] **Step 4: Commit**

```bash
git add lib/mercadopago.io.ts
git commit -m "feat(checkout): add lib/mercadopago.io.ts (MP SDK wrappers)"
```

---

## Task 8: Server Action `criarCheckout`

**Goal:** Implementar a server action principal: validação Zod, auth check, rate limit (5/min via SELECT count em bilhetes), validação de cashback, TX1 INSERT N bilhetes pendentes, chamada MP, TX2 UPDATE com mp_payment_id (ou compensação `cancelado`). Sem unit test (orquestração com efeitos colaterais; coberto por Task 17).

**Files:**

- Create: `app/(dashboard)/comprar/actions.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "app/(dashboard)/comprar"
```

- [ ] **Step 2: Create `actions.ts`**

Create `app/(dashboard)/comprar/actions.ts` com:

```ts
'use server';

import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { criarPagamentoPIX } from '@/lib/mercadopago.io';
import { montarPayloadMP } from '@/lib/checkout';
import { elegivelCashback } from '@/lib/cashback';

const schema = z.object({
  qty: z.number().int().min(1).max(50),
  selecao_cashback_id: z.number().int().positive().nullable(),
});

export type CriarCheckoutResult =
  | {
      ok: true;
      bilhete_principal_id: string;
      qr_code: string;
      qr_code_base64: string;
      expira_em: string;
      valor_total: number;
    }
  | {
      ok: false;
      error:
        | 'unauthenticated'
        | 'validation'
        | 'rate_limit'
        | 'cashback_min_value'
        | 'cashback_inelegivel'
        | 'mp_failure'
        | 'unknown';
      mensagem: string;
    };

export async function criarCheckout(input: unknown): Promise<CriarCheckoutResult> {
  // 1. Auth
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'unauthenticated', mensagem: 'Faça login pra continuar.' };
  }

  // 2. Validação Zod
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', mensagem: 'Dados inválidos.' };
  }
  const { qty, selecao_cashback_id } = parsed.data;
  const valor_total = qty * 20;

  // 3. Rate limit (5 chamadas/min do mesmo user)
  const { count } = await supabase
    .from('bilhetes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString());

  if ((count ?? 0) >= 5) {
    return { ok: false, error: 'rate_limit', mensagem: 'Espera 1 minuto pra tentar de novo.' };
  }

  // 4. Validação cashback
  if (selecao_cashback_id !== null && !elegivelCashback(valor_total)) {
    return {
      ok: false,
      error: 'cashback_min_value',
      mensagem: 'Cashback exige R$ 100 ou mais.',
    };
  }

  // 5. TX1 — INSERT N bilhetes (admin client bypassa RLS + protect trigger)
  const admin = createSupabaseAdminClient();
  const expira_provisional = new Date(Date.now() + 30 * 60_000).toISOString();
  const rows = Array.from({ length: qty }, (_, i) => ({
    user_id: user.id,
    valor_pago: i === 0 ? valor_total : 0,
    selecao_cashback_id: i === 0 ? selecao_cashback_id : null,
    expira_em: expira_provisional,
    status_pagamento: 'pendente' as const,
  }));

  const { data: inserted, error: insErr } = await admin
    .from('bilhetes')
    .insert(rows)
    .select('id, numero_bilhete, selecao_cashback_id');

  if (insErr || !inserted) {
    if (insErr?.message?.includes('não é elegível para cashback')) {
      return {
        ok: false,
        error: 'cashback_inelegivel',
        mensagem: 'Essa seleção não dá cashback.',
      };
    }
    console.error('TX1 insert falhou', insErr);
    return { ok: false, error: 'unknown', mensagem: 'Erro ao criar bilhetes.' };
  }

  const principal = inserted[0];
  const profileRes = await supabase
    .from('profiles')
    .select('email, nome')
    .eq('id', user.id)
    .single();

  // 6. Chama MP
  let mp;
  try {
    mp = await criarPagamentoPIX(
      montarPayloadMP({
        qty,
        user_email: profileRes.data?.email ?? user.email!,
        user_name: profileRes.data?.nome ?? undefined,
        bilhete_principal_id: principal.id,
        expira_em: expira_provisional,
      }),
    );
  } catch (e) {
    console.error('MP create falhou', e);
    // TX2 compensação — marca todos como cancelado
    await admin
      .from('bilhetes')
      .update({ status_pagamento: 'cancelado' })
      .in(
        'id',
        inserted.map((r) => r.id),
      );
    return { ok: false, error: 'mp_failure', mensagem: 'Falha no Mercado Pago. Tenta de novo.' };
  }

  // 7. TX2 — UPDATE com mp_payment_id e expira_em real
  const { error: updErr } = await admin
    .from('bilhetes')
    .update({ mp_payment_id: mp.id, expira_em: mp.date_of_expiration })
    .in(
      'id',
      inserted.map((r) => r.id),
    );

  if (updErr) {
    console.error('TX2 update falhou', { err: updErr, mp_id: mp.id });
    // Bilhetes ficam pendente; viram expirado em 30min via effective_status.
    // Webhook não vai achar (mp_payment_id null) — caso raro, escalável manualmente.
  }

  return {
    ok: true,
    bilhete_principal_id: principal.id,
    qr_code: mp.qr_code,
    qr_code_base64: mp.qr_code_base64,
    expira_em: mp.date_of_expiration,
    valor_total,
  };
}
```

- [ ] **Step 3: Quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
```

Expected: tudo passa. (Sem testes novos; testes existentes não quebram.)

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/comprar/actions.ts"
git commit -m "feat(checkout): add criarCheckout server action with TX1+TX2"
```

---

## Task 9: Route Handler `GET /api/checkout/[id]/status` (polling endpoint)

**Goal:** Endpoint pra polling do status do bilhete (3s do client). Lê de `bilhetes_view` (RLS aplicada — usuário só vê os próprios), retorna `effective_status` e `expira_em`. 404 se não-own.

**Files:**

- Create: `app/api/checkout/[id]/status/route.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "app/api/checkout/[id]/status"
```

- [ ] **Step 2: Create route.ts**

Create `app/api/checkout/[id]/status/route.ts` com:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  // RLS garante que só vê os próprios bilhetes
  const { data, error } = await supabase
    .from('bilhetes_view')
    .select('id, effective_status, expira_em, mp_payment_id')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    status: data.effective_status,
    expira_em: data.expira_em,
  });
}
```

- [ ] **Step 3: Quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
```

- [ ] **Step 4: Commit**

```bash
git add "app/api/checkout/[id]/status/route.ts"
git commit -m "feat(checkout): add GET /api/checkout/[id]/status (polling)"
```

---

## Task 10: Route Handler `POST /api/webhooks/mercadopago`

**Goal:** Receber webhook MP, validar HMAC, fetch autoritativo via `consultarPagamento`, mapear status, UPDATE idempotente em `bilhetes`. Retorna 200/401/400/500 conforme cenário.

**Files:**

- Create: `app/api/webhooks/mercadopago/route.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "app/api/webhooks/mercadopago"
```

- [ ] **Step 2: Create route.ts**

Create `app/api/webhooks/mercadopago/route.ts` com:

```ts
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { consultarPagamento } from '@/lib/mercadopago.io';
import { validarAssinaturaWebhook } from '@/lib/mercadopago';
import { mapearStatusMP } from '@/lib/checkout';
import { serverEnv } from '@/lib/env-server';

export async function POST(req: Request) {
  // 1. Read raw body + headers
  const raw = await req.text();
  const x_signature = req.headers.get('x-signature') ?? '';
  const x_request_id = req.headers.get('x-request-id') ?? '';

  let body: { action?: string; data?: { id?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }

  const data_id = body.data?.id;
  if (!data_id) return new Response(null, { status: 400 });

  // 2. Validar HMAC
  const ok = validarAssinaturaWebhook({
    x_signature,
    x_request_id,
    data_id,
    secret: serverEnv.MERCADOPAGO_WEBHOOK_SECRET,
  });
  if (!ok) {
    console.warn('Webhook MP: assinatura inválida', { data_id, x_request_id });
    return new Response(null, { status: 401 });
  }

  // 3. GET autoritativo
  let mp;
  try {
    mp = await consultarPagamento(data_id);
  } catch (e) {
    console.error('Webhook MP: consulta falhou', { data_id, err: e });
    return new Response(null, { status: 502 }); // MP retry
  }

  // 4. Mapear status
  let status;
  try {
    status = mapearStatusMP(mp.status, mp.status_detail);
  } catch (e) {
    console.warn('Webhook MP: status desconhecido — ignorando', {
      mp_id: data_id,
      status: mp.status,
    });
    return new Response(null, { status: 200 });
  }

  // 5. UPDATE idempotente (apenas se status muda)
  const admin = createSupabaseAdminClient();
  const updates: { status_pagamento: typeof status; pago_em?: string } = {
    status_pagamento: status,
  };
  if (status === 'confirmado') {
    updates.pago_em = mp.date_approved ?? new Date().toISOString();
  }

  const { error } = await admin
    .from('bilhetes')
    .update(updates)
    .eq('mp_payment_id', data_id)
    .neq('status_pagamento', status);

  if (error) {
    console.error('Webhook MP: update falhou', { data_id, err: error });
    return new Response(null, { status: 500 });
  }

  return new Response(null, { status: 200 });
}
```

- [ ] **Step 3: Quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
```

- [ ] **Step 4: Commit**

```bash
git add "app/api/webhooks/mercadopago/route.ts"
git commit -m "feat(checkout): add POST /api/webhooks/mercadopago (idempotent)"
```

---

## Task 11: UI — `Stepper` component + tests

**Goal:** Componente client de quantidade (variante C do mockup): − N + + barra de milestone com tick em N=5 + texto contextual ("🔒 +X tabelas pra liberar cashback" abaixo de 5; "🎁 Cashback liberado!" ≥ 5). Testes Vitest com Testing Library na lógica.

**Files:**

- Create: `components/checkout/Stepper.tsx`
- Create: `components/checkout/__tests__/Stepper.test.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "components/checkout/__tests__"
```

- [ ] **Step 2: Create Stepper test file**

Create `components/checkout/__tests__/Stepper.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Stepper } from '../Stepper';

describe('Stepper', () => {
  it('renderiza qty inicial', () => {
    render(<Stepper qty={3} onChange={() => {}} />);
    expect(screen.getByTestId('stepper-num').textContent).toBe('3');
  });

  it('+ chama onChange com qty+1', () => {
    const onChange = vi.fn();
    render(<Stepper qty={3} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /\+/ }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('− chama onChange com qty-1', () => {
    const onChange = vi.fn();
    render(<Stepper qty={3} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /−|-/ }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('− desabilitado em qty=min (default 1)', () => {
    const onChange = vi.fn();
    render(<Stepper qty={1} onChange={onChange} />);
    const minus = screen.getByRole('button', { name: /−|-/ });
    expect(minus).toBeDisabled();
  });

  it('+ desabilitado em qty=max (default 50)', () => {
    const onChange = vi.fn();
    render(<Stepper qty={50} onChange={onChange} />);
    const plus = screen.getByRole('button', { name: /\+/ });
    expect(plus).toBeDisabled();
  });

  it('mostra "🔒" quando qty < milestone', () => {
    render(<Stepper qty={3} onChange={() => {}} milestone={5} />);
    expect(screen.getByText(/🔒/)).toBeInTheDocument();
    expect(screen.getByText(/2 tabelas/i)).toBeInTheDocument();
  });

  it('mostra "🎁 Cashback liberado" quando qty >= milestone', () => {
    render(<Stepper qty={5} onChange={() => {}} milestone={5} />);
    expect(screen.getByText(/🎁/)).toBeInTheDocument();
    expect(screen.getByText(/cashback liberado/i)).toBeInTheDocument();
  });

  it('barra de progresso width = qty/max%', () => {
    const { rerender } = render(<Stepper qty={5} onChange={() => {}} max={10} />);
    expect(screen.getByTestId('milestone-fill').style.width).toBe('50%');
    rerender(<Stepper qty={2} onChange={() => {}} max={10} />);
    expect(screen.getByTestId('milestone-fill').style.width).toBe('20%');
  });
});
```

- [ ] **Step 3: Run tests — fail**

```bash
pnpm test:run components/checkout/__tests__/Stepper.test.tsx
```

Expected: FAIL com `Cannot find module '../Stepper'`.

- [ ] **Step 4: Create `Stepper.tsx`**

Create `components/checkout/Stepper.tsx`:

```tsx
'use client';

import { Minus, Plus, Lock, Gift } from 'lucide-react';

type StepperProps = {
  qty: number;
  onChange: (qty: number) => void;
  min?: number;
  max?: number;
  milestone?: number;
};

export function Stepper({ qty, onChange, min = 1, max = 50, milestone = 5 }: StepperProps) {
  const fillPct = Math.min(100, (qty / max) * 100);
  const milestonePct = Math.min(100, (milestone / max) * 100);
  const liberado = qty >= milestone;
  const faltam = milestone - qty;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <button
          type="button"
          aria-label="Diminuir quantidade"
          onClick={() => onChange(qty - 1)}
          disabled={qty <= min}
          className="grid h-9 w-9 place-items-center rounded-md bg-zinc-800 font-mono text-yellow-400 disabled:opacity-30"
        >
          <Minus size={18} />
        </button>
        <span
          data-testid="stepper-num"
          className="font-mono text-2xl font-semibold text-yellow-400"
        >
          {qty}
        </span>
        <button
          type="button"
          aria-label="Aumentar quantidade"
          onClick={() => onChange(qty + 1)}
          disabled={qty >= max}
          className="grid h-9 w-9 place-items-center rounded-md bg-zinc-800 font-mono text-yellow-400 disabled:opacity-30"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="relative h-1.5 overflow-hidden rounded-full bg-zinc-900">
        <div
          data-testid="milestone-fill"
          className="h-full bg-yellow-400 transition-[width] duration-300"
          style={{ width: `${fillPct}%` }}
        />
        <div
          className="absolute -top-1 h-3.5 w-0.5 bg-yellow-400"
          style={{ left: `${milestonePct}%` }}
          aria-hidden
        />
      </div>

      <div
        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm ${
          liberado ? 'bg-green-400/10 text-green-400' : 'bg-zinc-800/40 text-zinc-400'
        }`}
      >
        {liberado ? (
          <>
            <Gift size={14} /> Cashback liberado!
          </>
        ) : (
          <>
            <Lock size={14} /> +{faltam} {faltam === 1 ? 'tabela' : 'tabelas'} pra liberar cashback
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests — pass**

```bash
pnpm test:run components/checkout/__tests__/Stepper.test.tsx
```

Expected: PASS, 8 tests verdes.

- [ ] **Step 6: Quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
```

- [ ] **Step 7: Commit**

```bash
git add components/checkout/Stepper.tsx components/checkout/__tests__/Stepper.test.tsx
git commit -m "feat(checkout): add Stepper component with milestone bar"
```

---

## Task 12: UI — `CashbackPicker` component + tests

**Goal:** Componente client de seleção de cashback (variante A v3 do mockup): tier groups (5×, 3×, 2×, 1×), callout colorido com fórmula dinâmica `valor_pago × mult`, lista de flag-rows selecionáveis. Recebe seleções já filtradas (mult > 0) e ordenadas (mult DESC, nome ASC) do server.

**Files:**

- Create: `components/checkout/CashbackPicker.tsx`
- Create: `components/checkout/__tests__/CashbackPicker.test.tsx`

- [ ] **Step 1: Create test file**

Create `components/checkout/__tests__/CashbackPicker.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CashbackPicker, type SelecaoElegivel } from '../CashbackPicker';

const SELECOES: SelecaoElegivel[] = [
  { id: 1, nome: 'Noruega', codigo_iso: 'NOR', bandeira_emoji: '🇳🇴', cashback_multiplicador: 5.0 },
  { id: 2, nome: 'Colômbia', codigo_iso: 'COL', bandeira_emoji: '🇨🇴', cashback_multiplicador: 5.0 },
  { id: 3, nome: 'Portugal', codigo_iso: 'POR', bandeira_emoji: '🇵🇹', cashback_multiplicador: 3.0 },
  { id: 4, nome: 'Brasil', codigo_iso: 'BRA', bandeira_emoji: '🇧🇷', cashback_multiplicador: 2.0 },
  { id: 5, nome: 'França', codigo_iso: 'FRA', bandeira_emoji: '🇫🇷', cashback_multiplicador: 1.0 },
];

describe('CashbackPicker', () => {
  it('renderiza todas as seleções passadas', () => {
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={null} onChange={() => {}} valor_pago={100} />,
    );
    expect(screen.getByText('Noruega')).toBeInTheDocument();
    expect(screen.getByText('Brasil')).toBeInTheDocument();
    expect(screen.getByText('França')).toBeInTheDocument();
  });

  it('agrupa em tiers 5× / 3× / 2× / 1×', () => {
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={null} onChange={() => {}} valor_pago={100} />,
    );
    expect(screen.getByText(/5× — AZARÕES/i)).toBeInTheDocument();
    expect(screen.getByText(/3× — TIME B/i)).toBeInTheDocument();
    expect(screen.getByText(/2× — SUL-AMERICANOS/i)).toBeInTheDocument();
    expect(screen.getByText(/1× — FAVORITAS/i)).toBeInTheDocument();
  });

  it('callout do tier 5× mostra valor × 5', () => {
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={null} onChange={() => {}} valor_pago={100} />,
    );
    // "R$ 100 × 5× = R$ 500"
    expect(screen.getByTestId('callout-5')).toHaveTextContent(/R\$ 100/);
    expect(screen.getByTestId('callout-5')).toHaveTextContent(/R\$ 500/);
  });

  it('callout atualiza com valor_pago dinâmico', () => {
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={null} onChange={() => {}} valor_pago={200} />,
    );
    expect(screen.getByTestId('callout-5')).toHaveTextContent(/R\$ 1\.000|R\$ 1000/);
    expect(screen.getByTestId('callout-2')).toHaveTextContent(/R\$ 400/);
  });

  it('clicar numa seleção chama onChange com o id', () => {
    const onChange = vi.fn();
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={null} onChange={onChange} valor_pago={100} />,
    );
    fireEvent.click(screen.getByText('Brasil').closest('[role="button"]')!);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('clicar na seleção já selecionada chama onChange(null) — toggle', () => {
    const onChange = vi.fn();
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={4} onChange={onChange} valor_pago={100} />,
    );
    fireEvent.click(screen.getByText('Brasil').closest('[role="button"]')!);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('marca a selecionada com badge SUA', () => {
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={4} onChange={() => {}} valor_pago={100} />,
    );
    const brasilRow = screen.getByText('Brasil').closest('[role="button"]')!;
    expect(brasilRow.querySelector('[data-testid="badge-sua"]')).toBeInTheDocument();
  });

  it('lista vazia → renderiza vazio sem crashar', () => {
    render(<CashbackPicker selecoes={[]} selectedId={null} onChange={() => {}} valor_pago={100} />);
    // Não há tiers
    expect(screen.queryByText(/5×/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — fail**

```bash
pnpm test:run components/checkout/__tests__/CashbackPicker.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create `CashbackPicker.tsx`**

Create `components/checkout/CashbackPicker.tsx`:

```tsx
'use client';

import { calcularValorCashback, type CashbackMultiplicador } from '@/lib/cashback';

export type SelecaoElegivel = {
  id: number;
  nome: string;
  codigo_iso: string;
  bandeira_emoji: string;
  cashback_multiplicador: number;
};

type CashbackPickerProps = {
  selecoes: SelecaoElegivel[];
  selectedId: number | null;
  onChange: (selecao_cashback_id: number | null) => void;
  valor_pago: number;
};

const TIER_LABELS: Record<number, { label: string; pct: string }> = {
  5.0: { label: '5× — AZARÕES', pct: '500%' },
  3.0: { label: '3× — TIME B', pct: '300%' },
  2.0: { label: '2× — SUL-AMERICANOS', pct: '200%' },
  1.0: { label: '1× — FAVORITAS', pct: '100%' },
};

const TIER_COLORS: Record<number, string> = {
  5.0: 'bg-purple-400/10 border-purple-400/35 text-purple-300',
  3.0: 'bg-orange-400/10 border-orange-400/35 text-orange-300',
  2.0: 'bg-green-400/10 border-green-400/35 text-green-300',
  1.0: 'bg-blue-400/10 border-blue-400/35 text-blue-300',
};

const BADGE_COLORS: Record<number, string> = {
  5.0: 'bg-purple-400/20 text-purple-300',
  3.0: 'bg-orange-400/20 text-orange-300',
  2.0: 'bg-green-400/20 text-green-300',
  1.0: 'bg-blue-400/20 text-blue-300',
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function CashbackPicker({
  selecoes,
  selectedId,
  onChange,
  valor_pago,
}: CashbackPickerProps) {
  // Group by multiplicador
  const tiers = [5.0, 3.0, 2.0, 1.0] as const;

  const handleClick = (id: number) => {
    onChange(selectedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {tiers.map((mult) => {
        const grupo = selecoes.filter((s) => s.cashback_multiplicador === mult);
        if (grupo.length === 0) return null;

        const retorno = calcularValorCashback(valor_pago, mult as CashbackMultiplicador);

        return (
          <div key={mult} className="space-y-2">
            <div className="flex items-baseline justify-between font-mono text-xs tracking-wider text-zinc-500 uppercase">
              <span>{TIER_LABELS[mult].label}</span>
              <span>{TIER_LABELS[mult].pct}</span>
            </div>

            <div
              data-testid={`callout-${Math.round(mult)}`}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm ${TIER_COLORS[mult]}`}
            >
              💸 {formatBRL(valor_pago)} × {Math.round(mult)}× ={' '}
              <strong>{formatBRL(retorno)}</strong> de volta no PIX
            </div>

            <div className="space-y-1.5">
              {grupo.map((s) => {
                const selected = selectedId === s.id;
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(s.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick(s.id)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                      selected
                        ? 'border-yellow-400 bg-yellow-400/5'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-2xl">{s.bandeira_emoji}</span>
                    <div className="flex-1 font-semibold text-zinc-100">{s.nome}</div>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${BADGE_COLORS[mult]}`}
                    >
                      {Math.round(mult)}×
                    </span>
                    {selected && (
                      <span
                        data-testid="badge-sua"
                        className="ml-1 rounded bg-yellow-400 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-950"
                      >
                        SUA
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — pass**

```bash
pnpm test:run components/checkout/__tests__/CashbackPicker.test.tsx
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
```

- [ ] **Step 6: Commit**

```bash
git add components/checkout/CashbackPicker.tsx components/checkout/__tests__/CashbackPicker.test.tsx
git commit -m "feat(checkout): add CashbackPicker with tier groups and dynamic callout"
```

---

## Task 13: UI — `FormulaCheckout` wrapper

**Goal:** Componente que orquestra Stepper + CashbackPicker + resumo + botão "Pagar". Estado central. Submit chama `criarCheckout` (server action). Toast em erro, redirect em sucesso.

**Files:**

- Create: `components/checkout/FormulaCheckout.tsx`

- [ ] **Step 1: Create `FormulaCheckout.tsx`**

Create `components/checkout/FormulaCheckout.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Stepper } from './Stepper';
import { CashbackPicker, type SelecaoElegivel } from './CashbackPicker';
import { criarCheckout } from '@/app/(dashboard)/comprar/actions';
import { CASHBACK_VALOR_MINIMO } from '@/lib/cashback';

type FormulaCheckoutProps = {
  selecoes: SelecaoElegivel[];
  qtyInicial?: number;
  cashbackInicial?: number | null;
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function FormulaCheckout({
  selecoes,
  qtyInicial = 1,
  cashbackInicial = null,
}: FormulaCheckoutProps) {
  const [qty, setQty] = useState(qtyInicial);
  const [selecaoCashbackId, setSelecaoCashbackId] = useState<number | null>(cashbackInicial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const valor_total = qty * 20;
  const cashbackHabilitado = valor_total >= CASHBACK_VALOR_MINIMO;
  const cashbackEfetivo = cashbackHabilitado ? selecaoCashbackId : null;
  const selecaoEscolhida = selecoes.find((s) => s.id === cashbackEfetivo);

  const onChangeQty = (q: number) => {
    setQty(q);
    if (q * 20 < CASHBACK_VALOR_MINIMO) {
      setSelecaoCashbackId(null);
    }
  };

  const onSubmit = () => {
    startTransition(async () => {
      const result = await criarCheckout({
        qty,
        selecao_cashback_id: cashbackEfetivo,
      });
      if (result.ok) {
        router.push(`/comprar/${result.bilhete_principal_id}/pix`);
      } else {
        toast.error(result.mensagem);
      }
    });
  };

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <header>
        <h1 className="font-display text-3xl tracking-wider uppercase">Comprar tabelas</h1>
        <p className="text-sm text-zinc-400">R$ 20,00 por tabela · pagamento via PIX</p>
      </header>

      <section>
        <h2 className="font-display mb-3 text-lg tracking-wide uppercase">Quantas tabelas?</h2>
        <Stepper qty={qty} onChange={onChangeQty} />
      </section>

      {cashbackHabilitado && (
        <section>
          <h2 className="font-display mb-3 text-lg tracking-wide uppercase">Escolhe tua seleção</h2>
          <CashbackPicker
            selecoes={selecoes}
            selectedId={cashbackEfetivo}
            onChange={setSelecaoCashbackId}
            valor_pago={valor_total}
          />
        </section>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between font-mono text-sm">
          <span className="text-zinc-400">
            {qty} {qty === 1 ? 'tabela' : 'tabelas'}
          </span>
          <span>{formatBRL(valor_total)}</span>
        </div>
        {selecaoEscolhida && (
          <div className="mt-2 flex items-center justify-between font-mono text-xs text-green-400">
            <span>
              {selecaoEscolhida.bandeira_emoji} {selecaoEscolhida.nome} (
              {Math.round(selecaoEscolhida.cashback_multiplicador)}×)
            </span>
            <span>
              se campeã: {formatBRL(valor_total * selecaoEscolhida.cashback_multiplicador)}
            </span>
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={onSubmit}
        disabled={pending}
        className="w-full rounded-lg bg-yellow-400 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-300 disabled:opacity-50"
      >
        {pending ? 'Gerando PIX…' : `Pagar ${formatBRL(valor_total)} via PIX`}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
```

- [ ] **Step 3: Commit**

```bash
git add components/checkout/FormulaCheckout.tsx
git commit -m "feat(checkout): add FormulaCheckout wrapper with state and submit"
```

---

## Task 14: UI — `TelaPIX` component

**Goal:** Componente client da tela de PIX: status pill animado, resumo, QR (PNG via base64), copia-cola, countdown 1s, polling 3s. Estados: aguardando / confirmado (auto-redirect) / expirado (CTA "Gerar novo PIX").

**Files:**

- Create: `components/checkout/TelaPIX.tsx`

- [ ] **Step 1: Create `TelaPIX.tsx`**

Create `components/checkout/TelaPIX.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Status = 'pendente' | 'confirmado' | 'expirado' | 'cancelado';

type Resumo = {
  qty: number;
  cashback?: { selecao: string; multiplicador: number; bandeira: string };
};

type TelaPIXProps = {
  bilheteId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiraEm: string;
  valorTotal: number;
  resumo: Resumo;
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatMMSS = (sec: number) => {
  if (sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function TelaPIX({
  bilheteId,
  qrCode,
  qrCodeBase64,
  expiraEm,
  valorTotal,
  resumo,
}: TelaPIXProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('pendente');
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const diff = new Date(expiraEm).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkout/${bilheteId}/status`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as { status: Status; expira_em: string };
      setStatus(json.status);
    } catch {
      /* silencioso; tenta de novo no próximo tick */
    }
  }, [bilheteId]);

  // Polling 3s
  useEffect(() => {
    if (status !== 'pendente') return;
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [status, poll]);

  // Countdown 1s
  useEffect(() => {
    const iv = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 0) return 0;
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Quando countdown bate 0 → força um poll extra
  useEffect(() => {
    if (secondsLeft === 0 && status === 'pendente') {
      poll();
    }
  }, [secondsLeft, status, poll]);

  // Auto-redirect em confirmado
  useEffect(() => {
    if (status === 'confirmado') {
      toast.success('Pagamento confirmado!');
      const timer = setTimeout(() => {
        router.push(`/palpites?bilhete=${bilheteId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, bilheteId, router]);

  const onCopy = () => {
    navigator.clipboard.writeText(qrCode).then(
      () => toast.success('Código copiado!'),
      () => toast.error('Erro ao copiar'),
    );
  };

  const onRetry = () => {
    const params = new URLSearchParams();
    params.set('qty', String(resumo.qty));
    if (resumo.cashback) {
      // Não temos o ID da seleção em resumo (só o nome) — caller passa via querystring
      // se quiser pré-preencher; aqui só passa qty.
    }
    router.push(`/comprar?${params.toString()}`);
  };

  // Estado: confirmado
  if (status === 'confirmado') {
    return (
      <div className="mx-auto max-w-sm px-4 py-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-400/20 px-3 py-1.5 font-mono text-xs font-semibold text-green-400">
          ✓ PAGAMENTO CONFIRMADO
        </div>
        <div className="mx-auto my-6 grid h-20 w-20 place-items-center rounded-full bg-green-400/15 text-4xl text-green-400">
          ⚽
        </div>
        <p className="text-sm text-zinc-200">
          {resumo.qty} {resumo.qty === 1 ? 'bilhete liberado' : 'bilhetes liberados'} pra palpitar.
        </p>
        <p className="mt-1 text-xs text-zinc-500">redirecionando…</p>
      </div>
    );
  }

  // Estado: expirado / cancelado
  if (status === 'expirado' || status === 'cancelado') {
    return (
      <div className="mx-auto max-w-sm px-4 py-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-400/15 px-3 py-1.5 font-mono text-xs font-semibold text-red-400">
          ⏱ TEMPO ESGOTADO
        </div>
        <div className="mx-auto my-6 grid h-16 w-16 place-items-center rounded-full bg-red-400/12 text-3xl">
          ⌛
        </div>
        <p className="text-sm text-zinc-100">
          <strong>Bilhete expirou</strong>
        </p>
        <p className="mt-2 mb-6 text-xs text-zinc-500">
          Você não pagou em 30min. Sem stress —<br />
          nenhum valor foi cobrado.
        </p>
        <button
          onClick={onRetry}
          className="w-full rounded-lg bg-yellow-400 px-4 py-3 font-bold text-zinc-950"
        >
          GERAR NOVO PIX
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-2 w-full rounded-lg border border-zinc-800 px-4 py-3 text-sm text-zinc-100"
        >
          Voltar
        </button>
      </div>
    );
  }

  // Estado: pendente (default)
  return (
    <div className="mx-auto max-w-sm space-y-4 px-4 py-6">
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-400/15 px-3 py-1.5 font-mono text-xs font-semibold text-orange-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
          AGUARDANDO PAGAMENTO
        </div>
      </div>

      <div className="text-center">
        <h1 className="font-display text-3xl">{formatBRL(valorTotal)}</h1>
        <p className="text-xs text-zinc-500">via PIX · Mercado Pago</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span>
            {resumo.qty} {resumo.qty === 1 ? 'tabela' : 'tabelas'}
          </span>
          <span className="font-mono">{formatBRL(valorTotal)}</span>
        </div>
        {resumo.cashback && (
          <div className="mt-2 flex justify-between border-t border-dashed border-zinc-800 pt-2 text-xs text-green-400">
            <span>
              {resumo.cashback.bandeira} {resumo.cashback.selecao}{' '}
              {Math.round(resumo.cashback.multiplicador)}×
            </span>
            <span className="font-mono">
              {formatBRL(valorTotal * resumo.cashback.multiplicador)} se campeã
            </span>
          </div>
        )}
      </div>

      <div className="mx-auto w-52 rounded-xl bg-white p-3">
        <img
          src={`data:image/png;base64,${qrCodeBase64}`}
          alt="QR code PIX"
          className="aspect-square w-full"
        />
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs">
        <span className="flex-1 truncate text-zinc-500">{qrCode}</span>
        <button
          onClick={onCopy}
          className="rounded bg-yellow-400 px-2 py-1 text-xs font-bold text-zinc-950"
        >
          COPIAR
        </button>
      </div>

      <div className="text-center">
        <p className="text-xs text-zinc-500">Expira em</p>
        <p className="font-mono text-xl font-bold text-orange-400">{formatMMSS(secondsLeft)}</p>
      </div>

      <p className="border-t border-dashed border-zinc-800 pt-3 text-center text-xs text-zinc-500">
        Abre o app do banco · escaneia o QR ou cola o código
        <br />
        Confirmação automática em segundos
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
```

- [ ] **Step 3: Commit**

```bash
git add components/checkout/TelaPIX.tsx
git commit -m "feat(checkout): add TelaPIX with polling, countdown, and 3 states"
```

---

## Task 15: Pages — `/comprar` e `/comprar/[id]/pix`

**Goal:** Server Components: `/comprar` busca selecoes elegíveis e renderiza `FormulaCheckout`; `/comprar/[id]/pix` valida ownership via RLS, redireciona se já confirmado/expirado, busca QR atualizado do MP e renderiza `TelaPIX`.

**Files:**

- Create: `app/(dashboard)/comprar/page.tsx`
- Create: `app/(dashboard)/comprar/[id]/pix/page.tsx`

- [ ] **Step 1: Create `app/(dashboard)/comprar/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FormulaCheckout } from '@/components/checkout/FormulaCheckout';

export const dynamic = 'force-dynamic';

type SearchParams = { qty?: string; cashback?: string };

export default async function ComprarPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/comprar');

  const { data: selecoes } = await supabase
    .from('selecoes')
    .select('id, nome, codigo_iso, bandeira_emoji, cashback_multiplicador')
    .gt('cashback_multiplicador', 0)
    .order('cashback_multiplicador', { ascending: false })
    .order('nome');

  const qtyInicial = Math.min(50, Math.max(1, Number(searchParams.qty) || 1));
  const cashbackInicial = searchParams.cashback ? Number(searchParams.cashback) : null;

  return (
    <FormulaCheckout
      selecoes={selecoes ?? []}
      qtyInicial={qtyInicial}
      cashbackInicial={cashbackInicial}
    />
  );
}
```

- [ ] **Step 2: Create `app/(dashboard)/comprar/[id]/pix/page.tsx`**

Create directory first:

```bash
mkdir -p "app/(dashboard)/comprar/[id]/pix"
```

Create file:

```tsx
import { redirect, notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TelaPIX } from '@/components/checkout/TelaPIX';
import { consultarPagamento } from '@/lib/mercadopago.io';

export const dynamic = 'force-dynamic';

export default async function PIXPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();

  const { data: bilhete } = await supabase
    .from('bilhetes_view')
    .select(
      `
      id, effective_status, expira_em, valor_pago, mp_payment_id,
      selecao_cashback_id,
      selecoes:selecao_cashback_id(nome, bandeira_emoji, cashback_multiplicador)
    `,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!bilhete) notFound();
  if (bilhete.effective_status === 'confirmado') {
    redirect(`/palpites?bilhete=${bilhete.id}`);
  }
  if (bilhete.effective_status !== 'pendente') {
    redirect('/comprar');
  }
  if (!bilhete.mp_payment_id) {
    redirect('/comprar');
  }

  const { count: qty } = await supabase
    .from('bilhetes')
    .select('id', { count: 'exact', head: true })
    .eq('mp_payment_id', bilhete.mp_payment_id);

  const mp = await consultarPagamento(bilhete.mp_payment_id);

  const selecaoRel = Array.isArray(bilhete.selecoes) ? bilhete.selecoes[0] : bilhete.selecoes;

  return (
    <TelaPIX
      bilheteId={bilhete.id}
      qrCode={mp.qr_code}
      qrCodeBase64={mp.qr_code_base64}
      expiraEm={bilhete.expira_em!}
      valorTotal={Number(bilhete.valor_pago)}
      resumo={{
        qty: qty ?? 1,
        cashback: selecaoRel
          ? {
              selecao: selecaoRel.nome,
              multiplicador: Number(selecaoRel.cashback_multiplicador),
              bandeira: selecaoRel.bandeira_emoji,
            }
          : undefined,
      }}
    />
  );
}
```

- [ ] **Step 3: Quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
```

Expected: tudo passa. Se aparecer warning sobre tipo de `bilhete.selecoes` (Supabase tipa related joins como `T | T[] | null`), o normalize via `Array.isArray` cobre.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/comprar/page.tsx" "app/(dashboard)/comprar/[id]/pix/page.tsx"
git commit -m "feat(checkout): add /comprar and /comprar/[id]/pix pages"
```

---

## Task 16: Landing CTA wiring

**Goal:** Linkar `Comprar minha tabela →` e `Garantir meu cashback →` da landing pra `/comprar`. Atualmente apontam pra `#`.

**Files:**

- Modify: `app/(public)/page.tsx` (e/ou os componentes da landing — F3 deve ter quebrado em sub-componentes)

- [ ] **Step 1: Localizar os CTAs**

Run:

```bash
grep -rn "Comprar minha tabela\|Garantir meu cashback" app
```

Expected: 2+ matches, geralmente em `app/(public)/page.tsx` ou `components/landing/*.tsx`.

- [ ] **Step 2: Replace `href="#"` com `href="/comprar"`**

Em cada arquivo localizado, substituir:

```tsx
<a href="#" ...>Comprar minha tabela →</a>
```

Por:

```tsx
<a href="/comprar" ...>Comprar minha tabela →</a>
```

E o mesmo pra "Garantir meu cashback →".

> **Decisão:** se o arquivo usa Next.js `<Link>`, troque `href="#"` por `href="/comprar"` (também válido). Não importa qual — ambos funcionam.

- [ ] **Step 3: Quality gates**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run
```

(Se o teste de página da landing — `app/(public)/page.test.tsx` — assertava no `href="#"`, atualizar pra `/comprar`. Roda primeiro pra ver.)

- [ ] **Step 4: Commit**

```bash
git add app components
git commit -m "chore(landing): wire CTAs Comprar/Cashback to /comprar"
```

---

## Task 17: E2E manual smoke + final verification

**Goal:** Validar a integração completa com o sandbox MP real. 8 cenários do §5 do spec. Sem código novo — só execução e verificação.

**Files:** nenhum (tudo manual)

**Pré-requisito:** Cadastrar URL de webhook no painel MP sandbox antes do Step 1. Duas opções:

- **a)** Domínio público estável (`https://malanacopa.com.br/api/webhooks/mercadopago`) → cadastra 1 vez, fica.
- **b)** Local + ngrok: `ngrok http 3000` → cadastra a URL `https://<sub>.ngrok.io/api/webhooks/mercadopago` no painel sandbox MP. Webhook secret precisa ser o mesmo do `.env.local`.

- [ ] **Step 1: Start dev server e verifique boot OK**

Run:

```bash
pnpm dev
```

Expected: app boota em `http://localhost:3000` sem erros. Especialmente: o `serverEnv` parser (Task 1) NÃO falha — significa que `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` estão populados.

Em outra aba, verifique cobertura:

```bash
pnpm test:run --coverage
```

Expected: cobertura ≥ 95% em `lib/cashback.ts`, `lib/checkout.ts`, `lib/mercadopago.ts`. Se falhar, voltar nas tasks correspondentes e adicionar testes.

- [ ] **Step 2: Cenário 1 — Compra simples 1 tabela R$ 20**

1. Login com magic link (o user de dev).
2. Visite `/comprar`.
3. Stepper em qty=1 → CashbackPicker NÃO aparece (qty\*20 < 100).
4. Clica "Pagar R$ 20,00 via PIX".
5. Redireciona pra `/comprar/<id>/pix` com QR.
6. Em outra aba, abre app sandbox MP do "comprador" e paga.
7. Polling detecta `confirmado` em até ~6s; toast aparece; redirect pra `/palpites?bilhete=<id>`.

- [ ] **Step 3: Cenário 2 — Compra 5 tabelas R$ 100 + cashback Brasil 2×**

1. `/comprar` → stepper qty=5.
2. CashbackPicker aparece. Clica em "Brasil" (tier 2×). Callout 2× mostra "R$ 100 × 2× = R$ 200".
3. Pagar → QR com R$ 100.
4. Pagar via sandbox.
5. Confirmado.
6. Verifica no Studio:
   ```sql
   SELECT id, valor_pago, selecao_cashback_id, cashback_multiplicador_snapshot, status_pagamento
   FROM bilhetes WHERE mp_payment_id = '<mp_id_do_passo_3>';
   ```
   Esperado: 5 linhas, 1 com valor_pago=100 + selecao_cashback_id=Brasil + snapshot=2.0; 4 com valor_pago=0 + selecao_cashback_id=null + snapshot=0; todas com status=`confirmado`.

- [ ] **Step 4: Cenário 3 — Tentativa de cashback em seleção inelegível**

1. `/comprar` qty=5 (R$ 100). Picker mostra só as 13 elegíveis.
2. Manualmente via curl, força um POST com selecao_cashback_id apontando pra Haiti (que tem mult=0):
   ```bash
   # Pegue um cookie de sessão válido do browser (DevTools → Application → Cookies)
   # E o ID do Haiti via Studio
   curl -X POST http://localhost:3000/comprar \
     -H "Cookie: <cookie>" \
     -F "qty=5" \
     -F "selecao_cashback_id=<haiti_id>"
   ```
   Esperado: server action retorna `{ ok: false, error: 'cashback_inelegivel', mensagem: 'Essa seleção não dá cashback.' }`.

(Alternativa mais simples: como o picker filtra no server, esse caso só ocorre via POST manual; o teste é mais defensivo que prático.)

- [ ] **Step 5: Cenário 4 — Cashback com qty < 5**

1. Mesma manipulação de curl, mas com qty=4 (R$ 80) e qualquer selecao_cashback_id elegível.
2. Esperado: `{ ok: false, error: 'cashback_min_value', mensagem: 'Cashback exige R$ 100 ou mais.' }`.

- [ ] **Step 6: Cenário 5 — Expiração do QR**

1. Cria bilhete e QR mas NÃO paga.
2. Espera 30min (ou edita `expira_em` direto no Studio pra `now() - 1 minute`).
3. Refresh `/comprar/<id>/pix` → vê estado "Bilhete expirou".
4. Clica "GERAR NOVO PIX" → volta pra `/comprar?qty=5` (pré-preenchido).

- [ ] **Step 7: Cenário 6 — Webhook duplicado**

1. Após cenário 2 (bilhete confirmado), abre o painel MP sandbox → Notificações.
2. Localiza o evento `payment.updated` daquele bilhete.
3. Clica "Reenviar".
4. Verifica nos Vercel logs (ou `console.error` local) que o webhook chegou DE NOVO.
5. Verifica no Studio:
   ```sql
   SELECT id, status_pagamento, pago_em, updated_at FROM bilhetes
   WHERE mp_payment_id = '<mp_id>';
   ```
   Esperado: status=`confirmado` (não mudou); `updated_at` continua o do primeiro webhook (ou pode ter mudado se a SP do Supabase atualiza `updated_at` mesmo em UPDATEs no-op — verifique se o `WHERE neq` funcionou: se nada mudou, `updated_at` permanece).

- [ ] **Step 8: Cenário 7 — Webhook com signature inválida**

```bash
curl -X POST http://localhost:3000/api/webhooks/mercadopago \
  -H "x-signature: ts=12345,v1=00000000000000000000000000000000000000000000000000000000000000" \
  -H "x-request-id: fake-req" \
  -H "Content-Type: application/json" \
  -d '{"action":"payment.updated","data":{"id":"FAKE_ID"}}'
```

Esperado: HTTP 401. Verifica nos logs: `Webhook MP: assinatura inválida`.

- [ ] **Step 9: Cenário 8 — Rate limit (6 chamadas em 1min)**

1. No browser logado, faz `/comprar` → "Pagar" 5 vezes seguidas (cancela cada PIX).
2. Na 6ª tentativa, server action retorna `{ ok: false, error: 'rate_limit', mensagem: 'Espera 1 minuto pra tentar de novo.' }`.
3. Toast vermelho aparece.

- [ ] **Step 10: Final smoke — quality gates + git log**

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:run --coverage
```

Esperado: tudo passa. Cobertura ≥ 95% nas 4 libs cobertas.

```bash
git log --oneline d6cdf31..HEAD
```

Esperado: 15 commits, um por task (Tasks 1-16; Task 17 é apenas verificação manual sem commit).

- [ ] **Step 11: Push e abre PR**

```bash
git push -u origin feat/checkout-mercadopago
gh pr create --base main --title "feat: F6 checkout + Mercado Pago" --body "$(cat <<'EOF'
## Summary
- Schema migration: rename asaas_payment_id → mp_payment_id, cashback diferenciado por tier (1×/2×/3×/5×) em 13 elegíveis, sem 20-slot, snapshot do multiplicador no bilhete, view bilhetes_view com effective_status (lazy expiration).
- 4 libs novas: cashback (cálculo), checkout (mappers MP↔domínio), mercadopago (HMAC signature + types), mercadopago.io (SDK calls). Cobertura ≥ 95% nas 3 puras.
- Server Action criarCheckout com TX1+TX2; route handlers polling + webhook idempotente.
- 4 componentes UI: Stepper, CashbackPicker, FormulaCheckout, TelaPIX. Pages /comprar e /comprar/[id]/pix.
- Landing CTA "Comprar" wired pra /comprar.

## Test plan
- [x] Vitest ≥ 95% (lib/cashback, lib/checkout, lib/mercadopago)
- [x] E2E manual em sandbox MP (8 cenários do §5 do spec)
- [x] Smoke counts post-migration: 13 elegíveis distribuídos nos tiers corretos
- [x] Trigger smokes: eligibility rejeita Haiti; snapshot popula em INSERT
- [x] Webhook smokes: signature inválida → 401; reenvio → idempotente

Spec: docs/superpowers/specs/2026-04-30-checkout-mercadopago-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Esperado: PR aberto no GitHub. Aguardar review humano antes de merge.

---

## Self-Review (executado pelo controller após escrever)

- [x] **Spec coverage:** todas as seções do spec (3.1-3.14, 4-8) têm tasks correspondentes.
  - §3.1 Migration → Task 2
  - §3.2 lib/cashback → Task 4
  - §3.3 lib/checkout → Task 5
  - §3.4 lib/mercadopago (puro) → Task 6
  - §3.5 lib/mercadopago.io → Task 7
  - §3.6 lib/env-server → Task 1
  - §3.7 .env.local.example → já feito na sessão de brainstorming (commit d6cdf31); não há task
  - §3.8 vitest.config → Task 1
  - §3.9 actions.ts → Task 8
  - §3.10 status route → Task 9
  - §3.11 webhook route → Task 10
  - §3.12 UI components → Tasks 11-14
  - §3.13 pages → Task 15
  - §3.14 landing CTA → Task 16
  - §4 plano de commits → mapeado em cada task
  - §5 critério de pronto + smoke E2E → Task 17
- [x] **Placeholder scan:** zero TBD/TODO/FIXME no plano.
- [x] **Type consistency:** `MPPaymentResponse` definido em `lib/mercadopago.ts` (Task 6) e importado em `lib/mercadopago.io.ts` (Task 7); `MPPaymentPayload` definido em `lib/checkout.ts` (Task 5) e importado em `lib/mercadopago.io.ts` (Task 7); `CashbackMultiplicador` definido em `lib/cashback.ts` (Task 4) e usado em `CashbackPicker.tsx` (Task 12). `SelecaoElegivel` declarado em `CashbackPicker.tsx` e re-importado em `FormulaCheckout.tsx` (Task 13). Todos os nomes batem.
- [x] **Granularidade:** cada task tem 5-10 steps, cada step é uma ação concreta (write file, run command, verify output, commit). Steps de teste seguem o padrão TDD (write test → fail → impl → pass → commit) onde aplicável.
