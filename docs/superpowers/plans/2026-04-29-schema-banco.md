# Schema do banco — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete data layer for Bolão Copa 2026 — 7 tables, 1 view (`ranking`), 3 enums, 13 triggers, 8 functions — applied to the linked Supabase Cloud dev project, with seed data (48 selecoes from FIFA 2026 draw + 104 jogos with placeholder teams + 1 copa_resultados singleton), and regenerated TypeScript types in `lib/supabase/types.ts`.

**Architecture:** Single migration file (`supabase/migrations/<timestamp>_initial_schema.sql`) containing DDL + RLS + triggers + view. Seed data in `supabase/seed.sql` (Supabase canonical pattern). Migration applied to cloud dev `rvprwtrcpdyoljlekxdx` via `supabase db push`. Types regenerated via `pnpm supabase:types` against the post-apply schema.

**Tech Stack:** Postgres 14.5 (Supabase Cloud), `supabase` CLI, pnpm.

**Spec:** `docs/superpowers/specs/2026-04-29-schema-banco-design.md` (commit `41df505` on `main`).

**Prerequisites for the developer (verify before starting):**

- [ ] Worktree set up at `feat/schema-banco` branch (the controller creates this via using-git-worktrees skill before dispatching tasks)
- [ ] `supabase --version` returns a working version (CLI installed during Feature 1)
- [ ] `supabase status` from the worktree shows the linked project ref `rvprwtrcpdyoljlekxdx`
- [ ] `.env.local` exists in the worktree with valid `SUPABASE_SERVICE_ROLE_KEY` (preserved from Feature 1; see Feature 1's manual steps if missing)
- [ ] `pnpm install` already ran successfully in the worktree (Feature 1 setup)
- [ ] All quality gates pass on the starting state: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:run`
- [ ] HEAD of `feat/schema-banco` branch is `41df505` or descendant (i.e., includes the spec commit)
- [ ] **Cloud dev project schema check** — In the Supabase Studio SQL editor for `rvprwtrcpdyoljlekxdx`, run:

  ```sql
  SELECT tablename FROM pg_tables WHERE schemaname = 'public';
  ```

  Expected: 0 rows (clean public schema).

  If rows are returned (legacy test tables): **STOP and consult the user**. Decide whether to drop them (`DROP TABLE ... CASCADE`) before applying this migration, or apply our migration into the existing schema (which may collide). Do not proceed silently.

---

## Task 1: Scaffold initial migration stub

**Goal:** Create the empty timestamped migration file via `supabase migration new`. No SQL yet.

**Files:**

- Create: `supabase/migrations/<timestamp>_initial_schema.sql`

### Steps

- [ ] **Step 1.1: Create the migration file via supabase CLI**

```bash
supabase migration new initial_schema
```

Expected output: `Created new migration at supabase/migrations/<timestamp>_initial_schema.sql.`

The CLI generates a timestamp prefix (UTC, format `YYYYMMDDhhmmss`). The file starts empty.

- [ ] **Step 1.2: Verify the file exists and is empty**

```bash
ls -la supabase/migrations/
```

Expected: a single file matching `*_initial_schema.sql` (e.g., `20260429160000_initial_schema.sql`).

```bash
wc -l supabase/migrations/*_initial_schema.sql
```

Expected: `0` (empty file).

- [ ] **Step 1.3: Add a header comment to the migration file**

The migration file should start with a clear banner so future readers know what it is. Replace the empty content with:

```sql
-- ============================================================================
-- Bolão Copa 2026 — Initial Schema
-- ============================================================================
-- Feature 2 of the Bolão Copa 2026 project.
-- Spec: docs/superpowers/specs/2026-04-29-schema-banco-design.md
--
-- Builds the complete data layer:
--   - 3 enums (fase_jogo, status_pagamento, tipo_bonus)
--   - 7 tables (profiles, selecoes, jogos, bilhetes, palpites,
--              palpites_bonus, copa_resultados)
--   - 1 view (ranking) with public read access
--   - 8 functions and 13 triggers (set_updated_at, is_admin,
--     handle_new_user, prevent_palpite_after_start,
--     prevent_bonus_when_unconfirmed, enforce_cashback_slot_limit,
--     protect_bilhete_payment_columns, protect_score_column)
--   - RLS policies on all 7 tables
--
-- Apply via:  supabase db push
-- Seed via:   supabase/seed.sql (auto-runs after migrations on `db reset`)
-- ============================================================================
```

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/
git commit -m "chore: scaffold initial schema migration"
```

Verify the commit:

```bash
git log --oneline -1
```

Expected: `<hash> chore: scaffold initial schema migration`

---

## Task 2: Add enums, tables, indexes, and `set_updated_at` trigger

**Goal:** Populate the migration file with the 3 enums, 7 tables (with their indexes and CHECK constraints), and the generic `set_updated_at` trigger applied to 6 tables.

**Files:**

- Modify: `supabase/migrations/<timestamp>_initial_schema.sql` (append SQL after the header)

### Steps

- [ ] **Step 2.1: Append enums section to the migration file**

Append the following AFTER the header banner from Task 1:

```sql

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE fase_jogo AS ENUM (
  'grupos', '16avos', 'oitavas', 'quartas', 'semis', 'disputa_terceiro', 'final'
);

CREATE TYPE status_pagamento AS ENUM (
  'pendente', 'confirmado', 'expirado', 'cancelado'
);

CREATE TYPE tipo_bonus AS ENUM (
  'campeao', 'vice', 'terceiro', 'quarto', 'artilheiro', 'revelacao'
);
```

- [ ] **Step 2.2: Append `profiles` table**

```sql

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- 2.1 profiles ----------------------------------------------------------------

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  email text NOT NULL,
  telefone text,
  cpf text,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_email_idx ON profiles(email);
CREATE UNIQUE INDEX profiles_cpf_unique ON profiles(cpf) WHERE cpf IS NOT NULL;
```

- [ ] **Step 2.3: Append `selecoes` table**

```sql

-- 2.2 selecoes ----------------------------------------------------------------

CREATE TABLE selecoes (
  id smallserial PRIMARY KEY,
  nome text NOT NULL,
  codigo_iso text NOT NULL UNIQUE,
  bandeira_emoji text NOT NULL,
  grupo char(1) NOT NULL CHECK (grupo BETWEEN 'A' AND 'L'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX selecoes_grupo_idx ON selecoes(grupo);
```

- [ ] **Step 2.4: Append `jogos` table**

```sql

-- 2.3 jogos -------------------------------------------------------------------

CREATE TABLE jogos (
  id smallserial PRIMARY KEY,
  numero_jogo smallint NOT NULL UNIQUE CHECK (numero_jogo BETWEEN 1 AND 104),
  fase fase_jogo NOT NULL,
  data_hora timestamptz NOT NULL,
  selecao_casa_id smallint REFERENCES selecoes(id),
  selecao_fora_id smallint REFERENCES selecoes(id),
  placeholder_casa text,
  placeholder_fora text,
  gols_casa smallint CHECK (gols_casa >= 0),
  gols_fora smallint CHECK (gols_fora >= 0),
  finalizado boolean NOT NULL DEFAULT false,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT casa_defined CHECK (
    selecao_casa_id IS NOT NULL OR placeholder_casa IS NOT NULL
  ),
  CONSTRAINT fora_defined CHECK (
    selecao_fora_id IS NOT NULL OR placeholder_fora IS NOT NULL
  ),
  CONSTRAINT placar_consistente CHECK (
    (finalizado = true AND gols_casa IS NOT NULL AND gols_fora IS NOT NULL)
    OR finalizado = false
  )
);

CREATE INDEX jogos_data_hora_idx ON jogos(data_hora);
CREATE INDEX jogos_fase_idx ON jogos(fase);
```

- [ ] **Step 2.5: Append `bilhetes` table**

```sql

-- 2.4 bilhetes ----------------------------------------------------------------

CREATE TABLE bilhetes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_bilhete serial UNIQUE,
  status_pagamento status_pagamento NOT NULL DEFAULT 'pendente',
  valor_pago numeric(10,2) NOT NULL CHECK (valor_pago >= 0),
  asaas_payment_id text,
  selecao_cashback_id smallint REFERENCES selecoes(id),
  cashback_pago boolean NOT NULL DEFAULT false,
  pago_em timestamptz,
  expira_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cashback_min_value CHECK (
    selecao_cashback_id IS NULL OR valor_pago >= 100.00
  )
);

CREATE INDEX bilhetes_user_id_idx ON bilhetes(user_id);
CREATE INDEX bilhetes_status_idx ON bilhetes(status_pagamento);
CREATE INDEX bilhetes_cashback_active_idx ON bilhetes(selecao_cashback_id)
  WHERE selecao_cashback_id IS NOT NULL
    AND status_pagamento IN ('pendente', 'confirmado');
```

- [ ] **Step 2.6: Append `palpites` table**

```sql

-- 2.5 palpites ----------------------------------------------------------------

CREATE TABLE palpites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bilhete_id uuid NOT NULL REFERENCES bilhetes(id) ON DELETE CASCADE,
  jogo_id smallint NOT NULL REFERENCES jogos(id),
  gols_casa smallint NOT NULL CHECK (gols_casa BETWEEN 0 AND 30),
  gols_fora smallint NOT NULL CHECK (gols_fora BETWEEN 0 AND 30),
  pontos_calculados smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bilhete_id, jogo_id)
);

CREATE INDEX palpites_bilhete_idx ON palpites(bilhete_id);
CREATE INDEX palpites_jogo_idx ON palpites(jogo_id);
```

- [ ] **Step 2.7: Append `palpites_bonus` table**

```sql

-- 2.6 palpites_bonus ----------------------------------------------------------

CREATE TABLE palpites_bonus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bilhete_id uuid NOT NULL REFERENCES bilhetes(id) ON DELETE CASCADE,
  tipo tipo_bonus NOT NULL,
  selecao_id smallint REFERENCES selecoes(id),
  jogador_nome text,
  pontos_calculados smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bilhete_id, tipo),
  CONSTRAINT bonus_payload CHECK (
    (tipo = 'artilheiro' AND jogador_nome IS NOT NULL AND selecao_id IS NULL)
    OR
    (tipo <> 'artilheiro' AND selecao_id IS NOT NULL AND jogador_nome IS NULL)
  )
);

CREATE INDEX palpites_bonus_bilhete_idx ON palpites_bonus(bilhete_id);
```

- [ ] **Step 2.8: Append `copa_resultados` table**

```sql

-- 2.7 copa_resultados (singleton) ---------------------------------------------

CREATE TABLE copa_resultados (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  campeao_id smallint REFERENCES selecoes(id),
  vice_id smallint REFERENCES selecoes(id),
  terceiro_id smallint REFERENCES selecoes(id),
  quarto_id smallint REFERENCES selecoes(id),
  artilheiro_nome text,
  revelacao_id smallint REFERENCES selecoes(id),
  finalizada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2.9: Append `set_updated_at` function and triggers**

```sql

-- ============================================================================
-- 3. set_updated_at — generic timestamp trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_jogos BEFORE UPDATE ON jogos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_bilhetes BEFORE UPDATE ON bilhetes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_palpites BEFORE UPDATE ON palpites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_palpites_bonus BEFORE UPDATE ON palpites_bonus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_copa_resultados BEFORE UPDATE ON copa_resultados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [ ] **Step 2.10: Verify the migration file looks complete for this task**

Inspect the file:

```bash
wc -l supabase/migrations/*_initial_schema.sql
```

Expected: roughly 200 lines (banner + enums + 7 tables + indexes + set_updated_at function and 6 triggers).

```bash
grep -c "^CREATE TABLE" supabase/migrations/*_initial_schema.sql
```

Expected: `7`.

```bash
grep -c "^CREATE TYPE" supabase/migrations/*_initial_schema.sql
```

Expected: `3`.

```bash
grep -c "^CREATE TRIGGER" supabase/migrations/*_initial_schema.sql
```

Expected: `6` (the six `set_updated_at_*` triggers; business-rule triggers come in Task 3).

**Note:** the migration is NOT applied to the cloud dev yet. We accumulate the full file across Tasks 2-5, then apply once after Task 6. Don't run `supabase db push` here.

- [ ] **Step 2.11: Run quality gates (sanity check)**

The migration file isn't TypeScript, so typecheck is unaffected. But `pnpm format` will lint the SQL via prettier (which has limited SQL support; mostly leaves `.sql` files alone, but `.prettierignore` excludes `supabase/.temp` already). Verify nothing else broke:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
```

All four must remain clean (3 tests passing on the smoke test from Feature 1's `lib/__tests__/utils.test.ts`).

- [ ] **Step 2.12: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add enums, tables, indexes, updated_at trigger"
```

---

## Task 3: Add business rule triggers

**Goal:** Append the 5 business-logic functions/triggers to the migration: `is_admin()`, `handle_new_user`, `prevent_palpite_after_start`, `prevent_bonus_when_unconfirmed`, `enforce_cashback_slot_limit`.

**Files:**

- Modify: `supabase/migrations/<timestamp>_initial_schema.sql` (append after Task 2 content)

### Steps

- [ ] **Step 3.1: Append section banner and `is_admin()` helper**

```sql

-- ============================================================================
-- 4. BUSINESS RULE FUNCTIONS AND TRIGGERS
-- ============================================================================

-- 4.1 is_admin() — RLS helper -------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;
```

- [ ] **Step 3.2: Append `handle_new_user()` trigger**

```sql

-- 4.2 handle_new_user — auto-create profile on signup ------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 3.3: Append `prevent_palpite_after_start()` trigger**

```sql

-- 4.3 prevent_palpite_after_start — palpite window + bilhete confirmed -------

CREATE OR REPLACE FUNCTION public.prevent_palpite_after_start() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  jogo_data_hora timestamptz;
  bilhete_status status_pagamento;
BEGIN
  SELECT data_hora INTO jogo_data_hora
  FROM public.jogos WHERE id = NEW.jogo_id;

  SELECT status_pagamento INTO bilhete_status
  FROM public.bilhetes WHERE id = NEW.bilhete_id;

  IF bilhete_status <> 'confirmado' THEN
    RAISE EXCEPTION 'Bilhete % não está confirmado (status atual: %)',
      NEW.bilhete_id, bilhete_status
      USING ERRCODE = 'check_violation';
  END IF;

  IF jogo_data_hora <= now() THEN
    RAISE EXCEPTION 'Janela de palpite encerrada: jogo % iniciou em %',
      NEW.jogo_id, jogo_data_hora
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER palpites_window_trigger
BEFORE INSERT OR UPDATE ON palpites
FOR EACH ROW EXECUTE FUNCTION public.prevent_palpite_after_start();
```

- [ ] **Step 3.4: Append `prevent_bonus_when_unconfirmed()` trigger**

```sql

-- 4.4 prevent_bonus_when_unconfirmed — bonus only on confirmed bilhete -------

CREATE OR REPLACE FUNCTION public.prevent_bonus_when_unconfirmed() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  bilhete_status status_pagamento;
BEGIN
  SELECT status_pagamento INTO bilhete_status
  FROM public.bilhetes WHERE id = NEW.bilhete_id;

  IF bilhete_status <> 'confirmado' THEN
    RAISE EXCEPTION 'Bilhete % não está confirmado (status atual: %)',
      NEW.bilhete_id, bilhete_status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER palpites_bonus_confirmed_trigger
BEFORE INSERT OR UPDATE ON palpites_bonus
FOR EACH ROW EXECUTE FUNCTION public.prevent_bonus_when_unconfirmed();
```

- [ ] **Step 3.5: Append `enforce_cashback_slot_limit()` trigger**

```sql

-- 4.5 enforce_cashback_slot_limit — rigid 20-slot cap (CLAUDE.md §3.3) -------

CREATE OR REPLACE FUNCTION public.enforce_cashback_slot_limit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  current_count int;
BEGIN
  IF NEW.selecao_cashback_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.selecao_cashback_id IS NOT DISTINCT FROM NEW.selecao_cashback_id THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent INSERTs/UPDATEs targeting the same selecao.
  -- Two webhook handlers confirming bilhetes for the same team will block
  -- on this lock until the first transaction commits or rolls back.
  PERFORM pg_advisory_xact_lock(
    hashtext('cashback_slot_' || NEW.selecao_cashback_id::text)
  );

  SELECT COUNT(*) INTO current_count
  FROM public.bilhetes
  WHERE selecao_cashback_id = NEW.selecao_cashback_id
    AND id <> NEW.id
    AND status_pagamento IN ('pendente', 'confirmado')
    AND (expira_em IS NULL OR expira_em > now());

  IF current_count >= 20 THEN
    RAISE EXCEPTION 'Limite de 20 vagas de cashback atingido para a seleção %',
      NEW.selecao_cashback_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bilhetes_cashback_slot_trigger
BEFORE INSERT OR UPDATE OF selecao_cashback_id ON bilhetes
FOR EACH ROW EXECUTE FUNCTION public.enforce_cashback_slot_limit();
```

- [ ] **Step 3.6: Verify the migration file**

```bash
grep -c "^CREATE TRIGGER" supabase/migrations/*_initial_schema.sql
```

Expected: `10` (6 from Task 2 + 4 added in this task: `on_auth_user_created`, `palpites_window_trigger`, `palpites_bonus_confirmed_trigger`, `bilhetes_cashback_slot_trigger`).

```bash
grep -c "CREATE OR REPLACE FUNCTION" supabase/migrations/*_initial_schema.sql
```

Expected: `6` (1 from Task 2: `set_updated_at` + 5 added in this task: `is_admin`, `handle_new_user`, `prevent_palpite_after_start`, `prevent_bonus_when_unconfirmed`, `enforce_cashback_slot_limit`).

- [ ] **Step 3.7: Quality gates**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
```

All clean.

- [ ] **Step 3.8: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add business rule triggers"
```

---

## Task 4: Add RLS policies and column protection triggers

**Goal:** Append all RLS policies (7 tables) and 2 column-protection triggers (`protect_bilhete_payment_columns`, `protect_score_column`) to the migration.

**Files:**

- Modify: `supabase/migrations/<timestamp>_initial_schema.sql` (append after Task 3 content)

### Steps

- [ ] **Step 4.1: Append section banner and column protection functions**

```sql

-- ============================================================================
-- 5. COLUMN PROTECTION TRIGGERS
-- ============================================================================
-- These triggers enforce that certain columns can only be modified by the
-- service_role (used by webhook handlers and admin Edge Functions). Even
-- if RLS allows the row update, the trigger blocks specific column changes
-- coming from the `authenticated` or `anon` roles.

-- 5.1 protect_bilhete_payment_columns ----------------------------------------

CREATE OR REPLACE FUNCTION public.protect_bilhete_payment_columns() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.user_id          IS DISTINCT FROM OLD.user_id
       OR NEW.numero_bilhete    IS DISTINCT FROM OLD.numero_bilhete
       OR NEW.status_pagamento  IS DISTINCT FROM OLD.status_pagamento
       OR NEW.asaas_payment_id  IS DISTINCT FROM OLD.asaas_payment_id
       OR NEW.valor_pago        IS DISTINCT FROM OLD.valor_pago
       OR NEW.cashback_pago     IS DISTINCT FROM OLD.cashback_pago
       OR NEW.pago_em           IS DISTINCT FROM OLD.pago_em
       OR NEW.expira_em         IS DISTINCT FROM OLD.expira_em
    THEN
      RAISE EXCEPTION 'Colunas de pagamento somente alteráveis via service_role'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bilhetes_protect_payment_columns
BEFORE UPDATE ON bilhetes
FOR EACH ROW EXECUTE FUNCTION public.protect_bilhete_payment_columns();

-- 5.2 protect_score_column (palpites + palpites_bonus) -----------------------

CREATE OR REPLACE FUNCTION public.protect_score_column() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NEW.pontos_calculados IS DISTINCT FROM OLD.pontos_calculados
  THEN
    RAISE EXCEPTION 'pontos_calculados somente alterável via service_role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER palpites_protect_score
BEFORE UPDATE ON palpites
FOR EACH ROW EXECUTE FUNCTION public.protect_score_column();

CREATE TRIGGER palpites_bonus_protect_score
BEFORE UPDATE ON palpites_bonus
FOR EACH ROW EXECUTE FUNCTION public.protect_score_column();
```

- [ ] **Step 4.2: Append RLS section banner and `profiles` policies**

```sql

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================
-- All tables enable RLS. Policies are PERMISSIVE by default (OR-combined).
-- Tests of the policy effects are documented in the spec section 5.

-- 6.1 profiles ---------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- Block users from promoting themselves to admin via UPDATE.
REVOKE UPDATE (is_admin) ON profiles FROM authenticated;
-- INSERT: blocked by absence of policy. handle_new_user (SECURITY DEFINER) bypasses.
-- DELETE: blocked by absence of policy. ON DELETE CASCADE from auth.users handles cleanup.
```

- [ ] **Step 4.3: Append `selecoes`, `jogos`, `copa_resultados` policies**

```sql

-- 6.2 selecoes ---------------------------------------------------------------

ALTER TABLE selecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY selecoes_select_all ON selecoes
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY selecoes_admin_write ON selecoes
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6.3 jogos ------------------------------------------------------------------

ALTER TABLE jogos ENABLE ROW LEVEL SECURITY;

CREATE POLICY jogos_select_all ON jogos
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY jogos_admin_write ON jogos
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6.4 copa_resultados --------------------------------------------------------

ALTER TABLE copa_resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY copa_resultados_select_all ON copa_resultados
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY copa_resultados_admin_update ON copa_resultados
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
-- INSERT/DELETE: blocked. Singleton; row created by seed.
```

- [ ] **Step 4.4: Append `bilhetes` policies**

```sql

-- 6.5 bilhetes ---------------------------------------------------------------

ALTER TABLE bilhetes ENABLE ROW LEVEL SECURITY;

CREATE POLICY bilhetes_select_own_or_admin ON bilhetes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY bilhetes_insert_own ON bilhetes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status_pagamento = 'pendente'
    AND cashback_pago = false
  );

CREATE POLICY bilhetes_update_own_or_admin ON bilhetes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
-- DELETE: blocked.
```

- [ ] **Step 4.5: Append `palpites` policies**

```sql

-- 6.6 palpites ---------------------------------------------------------------

ALTER TABLE palpites ENABLE ROW LEVEL SECURITY;

CREATE POLICY palpites_select_own_or_started ON palpites
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = palpites.bilhete_id AND b.user_id = auth.uid()
    )
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM jogos j
      WHERE j.id = palpites.jogo_id AND j.data_hora <= now()
    )
  );

CREATE POLICY palpites_insert_own ON palpites
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = bilhete_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY palpites_update_own ON palpites
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = palpites.bilhete_id AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = bilhete_id AND b.user_id = auth.uid()
    )
  );
-- DELETE: blocked.
```

- [ ] **Step 4.6: Append `palpites_bonus` policies**

```sql

-- 6.7 palpites_bonus ---------------------------------------------------------

ALTER TABLE palpites_bonus ENABLE ROW LEVEL SECURITY;

CREATE POLICY palpites_bonus_select_own_or_copa_started ON palpites_bonus
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = palpites_bonus.bilhete_id AND b.user_id = auth.uid()
    )
    OR public.is_admin()
    OR (SELECT MIN(data_hora) FROM jogos) <= now()
  );

CREATE POLICY palpites_bonus_insert_own ON palpites_bonus
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = bilhete_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY palpites_bonus_update_own ON palpites_bonus
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = palpites_bonus.bilhete_id AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = bilhete_id AND b.user_id = auth.uid()
    )
  );
-- DELETE: blocked.
```

- [ ] **Step 4.7: Verify the migration file**

```bash
grep -c "^CREATE POLICY" supabase/migrations/*_initial_schema.sql
```

Expected: `17` (profiles 2 + selecoes 2 + jogos 2 + copa_resultados 2 + bilhetes 3 + palpites 3 + palpites_bonus 3 = 17).

```bash
grep -c "ENABLE ROW LEVEL SECURITY" supabase/migrations/*_initial_schema.sql
```

Expected: `7` (one per table).

```bash
grep -c "^CREATE TRIGGER" supabase/migrations/*_initial_schema.sql
```

Expected: `13` (10 from Tasks 2-3 + 3 added in this task: `bilhetes_protect_payment_columns`, `palpites_protect_score`, `palpites_bonus_protect_score`).

```bash
grep -c "CREATE OR REPLACE FUNCTION" supabase/migrations/*_initial_schema.sql
```

Expected: `8` (6 from Tasks 2-3 + 2 added in this task: `protect_bilhete_payment_columns`, `protect_score_column`).

- [ ] **Step 4.8: Quality gates**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
```

All clean.

- [ ] **Step 4.9: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add RLS policies and column protection"
```

---

## Task 5: Add `ranking` view

**Goal:** Append the `ranking` view (with `WITH (security_invoker = false)` and public GRANT) to the migration.

**Files:**

- Modify: `supabase/migrations/<timestamp>_initial_schema.sql` (append after Task 4 content)

### Steps

- [ ] **Step 5.1: Append the ranking view**

```sql

-- ============================================================================
-- 7. VIEW: ranking
-- ============================================================================
-- Aggregates points + tiebreakers per confirmed bilhete.
-- WITH (security_invoker = false) makes the view run as the owner (postgres),
-- bypassing RLS on underlying tables. Justifiable: the view only projects
-- non-sensitive columns (numero_bilhete, user_id as opaque uuid, nome).
-- Tiebreakers (in order):
--   1. pontos_totais DESC
--   2. acertos_exatos DESC
--   3. acertos_parciais DESC
--   4. numero_bilhete ASC (chronological order; first to register wins ties)

CREATE OR REPLACE VIEW public.ranking
WITH (security_invoker = false) AS
WITH palpite_aggregates AS (
  SELECT
    p.bilhete_id,
    COALESCE(SUM(p.pontos_calculados), 0)::int AS pontos_palpites,
    COUNT(*) FILTER (
      WHERE j.finalizado = true
        AND p.gols_casa = j.gols_casa
        AND p.gols_fora = j.gols_fora
    )::int AS acertos_exatos,
    COUNT(*) FILTER (
      WHERE j.finalizado = true
        AND COALESCE(p.pontos_calculados, 0) > 0
        AND NOT (p.gols_casa = j.gols_casa AND p.gols_fora = j.gols_fora)
    )::int AS acertos_parciais
  FROM palpites p
  JOIN jogos j ON j.id = p.jogo_id
  GROUP BY p.bilhete_id
),
bonus_aggregates AS (
  SELECT
    bilhete_id,
    COALESCE(SUM(pontos_calculados), 0)::int AS pontos_bonus
  FROM palpites_bonus
  GROUP BY bilhete_id
)
SELECT
  b.id AS bilhete_id,
  b.numero_bilhete,
  b.user_id,
  COALESCE(pr.nome, '') AS nome,
  COALESCE(pa.pontos_palpites, 0) + COALESCE(ba.pontos_bonus, 0) AS pontos_totais,
  COALESCE(pa.acertos_exatos, 0) AS acertos_exatos,
  COALESCE(pa.acertos_parciais, 0) AS acertos_parciais,
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(pa.pontos_palpites, 0) + COALESCE(ba.pontos_bonus, 0) DESC,
      COALESCE(pa.acertos_exatos, 0) DESC,
      COALESCE(pa.acertos_parciais, 0) DESC,
      b.numero_bilhete ASC
  )::int AS posicao
FROM bilhetes b
LEFT JOIN palpite_aggregates pa ON pa.bilhete_id = b.id
LEFT JOIN bonus_aggregates ba ON ba.bilhete_id = b.id
LEFT JOIN profiles pr ON pr.id = b.user_id
WHERE b.status_pagamento = 'confirmado';

-- Grant public read access. Anon and authenticated both can SELECT.
GRANT SELECT ON public.ranking TO anon, authenticated;
```

- [ ] **Step 5.2: Verify the migration file**

```bash
grep -c "^CREATE OR REPLACE VIEW" supabase/migrations/*_initial_schema.sql
```

Expected: `1`.

```bash
grep "GRANT SELECT" supabase/migrations/*_initial_schema.sql
```

Expected: `GRANT SELECT ON public.ranking TO anon, authenticated;`

```bash
wc -l supabase/migrations/*_initial_schema.sql
```

Expected: ~600 lines total.

- [ ] **Step 5.3: Quality gates**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
```

All clean.

- [ ] **Step 5.4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add ranking view with public access"
```

---

## Task 6: Add seed data — 48 selecoes, 104 jogos, copa_resultados singleton

**Goal:** Create `supabase/seed.sql` with the FIFA 2026 ground truth data.

**Files:**

- Create: `supabase/seed.sql`

### Steps

- [ ] **Step 6.1: Fetch the official FIFA 2026 draw and calendar**

The seed data must match the FIFA 2026 World Cup official draw (December 5, 2025, Kennedy Center) and the playoff results (March 2026). Confirmed by the user: **Brasil is in Group C alongside Marrocos, Escócia, and Haiti**. The remaining 11 groups (A, B, D-L) and the 104-match calendar must be sourced from the official FIFA publication.

Use WebFetch to retrieve the authoritative source:

```
WebFetch URL: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026
Prompt: "List all 48 teams in the World Cup 2026 grouped by their group letter (A through L). For each team, give the country name and ISO 3166-1 alpha-3 code. Then list the full match calendar with each match's number (1-104), phase (group stage / round of 32 / round of 16 / quarterfinals / semifinals / third place / final), date and time in Eastern Time (UTC-4), home team or placeholder description, and away team or placeholder description."
```

If the FIFA page does not have the calendar in a structured form, fall back to:

```
WebSearch: "FIFA World Cup 2026 full match schedule calendar 104 games"
```

Cross-check the result against any other authoritative source (e.g., the official tournament booklet, ESPN, BBC). Mark any unresolvable ambiguity with `-- TODO confirmar` inline in the seed SQL — the user will review and correct before merging.

If WebFetch is unavailable or rate-limited, STOP and report BLOCKED with a clear request for the user to provide the data manually.

- [ ] **Step 6.2: Create `supabase/seed.sql` header**

```sql
-- ============================================================================
-- Bolão Copa 2026 — Seed Data
-- ============================================================================
-- Sources:
--   - FIFA 2026 official draw (Dec 5, 2025, Kennedy Center)
--   - Inter-confederation playoff results (March 2026)
--   - FIFA official match calendar
--
-- Confirmed: Brasil (BRA) in Group C with Marrocos (MAR), Escócia (SCO),
--            and Haiti (HAI).
--
-- This file runs AFTER all migrations on `supabase db reset`. Idempotency:
-- if re-running on existing data, the implementer should TRUNCATE tables
-- first or use ON CONFLICT clauses (currently the inserts assume empty
-- tables — re-running blindly will fail on UNIQUE constraints).
-- ============================================================================
```

- [ ] **Step 6.3: Append the 48 selecoes INSERTs**

Generate one INSERT statement listing all 48 teams. Order by group letter (A through L), 4 teams per group. Schema:

```sql

-- ============================================================================
-- 1. SELECOES (48 nações, sorteio FIFA 5 dez 2025 + repescagem mar 2026)
-- ============================================================================

INSERT INTO selecoes (nome, codigo_iso, bandeira_emoji, grupo) VALUES
  -- Grupo A (4 teams)
  ('<nome>', '<ISO3>', '<emoji>', 'A'),
  ('<nome>', '<ISO3>', '<emoji>', 'A'),
  ('<nome>', '<ISO3>', '<emoji>', 'A'),
  ('<nome>', '<ISO3>', '<emoji>', 'A'),
  -- Grupo B (4 teams)
  ('<nome>', '<ISO3>', '<emoji>', 'B'),
  -- ... (continue for all 12 groups)
  -- Grupo C (4 teams) — CONFIRMED by user
  ('Brasil',   'BRA', '🇧🇷', 'C'),
  ('Marrocos', 'MAR', '🇲🇦', 'C'),
  ('Escócia',  'SCO', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'C'),
  ('Haiti',    'HAI', '🇭🇹', 'C'),
  -- ... (continue through Grupo L)
  ('<nome>', '<ISO3>', '<emoji>', 'L');
```

Implementer: replace the `<nome>`, `<ISO3>`, `<emoji>` placeholders with the actual values from Step 6.1's WebFetch result. The `nome` field uses the Portuguese-Brazilian name (e.g., "Estados Unidos" not "United States", "Alemanha" not "Germany"). The `codigo_iso` is ISO 3166-1 alpha-3 (3 uppercase letters). The `bandeira_emoji` is the Unicode regional indicator pair (e.g., 🇧🇷 for Brasil). For Escócia (SCO), use the subdivision flag emoji `🏴󠁧󠁢󠁳󠁣󠁴󠁿` (Scotland flag).

If any team is uncertain (e.g., the inter-confederation playoff winners, where my training data ends before the actual playoff), mark inline with a comment:

```sql
  ('Bolívia',  'BOL', '🇧🇴', 'F'),  -- TODO confirmar (inter-confederation playoff winner)
```

End the INSERT statement with a single semicolon after the last row (no comma). Confirm row count:

```bash
grep -cE "^  \('" supabase/seed.sql
```

Expected output: `48` exactly. If different, the row count is wrong — go back and fix.

- [ ] **Step 6.4: Append the 104 jogos INSERTs**

Generate one INSERT statement listing all 104 matches in ascending `numero_jogo` order. Schema:

```sql

-- ============================================================================
-- 2. JOGOS (104 partidas, calendário oficial FIFA, times placeholder)
-- ============================================================================

INSERT INTO jogos (numero_jogo, fase, data_hora, placeholder_casa, placeholder_fora) VALUES
  -- Fase de grupos: 72 jogos, 11-21 jun 2026
  --   Round 1 (24 matches, jun 11-13)
  (1,  'grupos', '2026-06-11 17:00:00-04', 'Grupo A - Time 1', 'Grupo A - Time 2'),
  (2,  'grupos', '2026-06-11 20:00:00-04', 'Grupo B - Time 1', 'Grupo B - Time 2'),
  -- ... (22 more round-1 matches)
  --   Round 2 (24 matches, jun 14-17)
  (25, 'grupos', '2026-06-14 13:00:00-04', 'Grupo A - Time 3', 'Grupo A - Time 4'),
  -- ... (23 more round-2 matches)
  --   Round 3 (24 matches, jun 18-21)
  (49, 'grupos', '2026-06-18 17:00:00-04', 'Grupo A - Time 1', 'Grupo A - Time 3'),
  -- ... (23 more round-3 matches)
  -- 16avos: 16 jogos, 24-27 jun
  (73,  '16avos', '2026-06-27 13:00:00-04', '1A', '2B'),
  -- ... (15 more)
  -- Oitavas: 8 jogos, 30 jun - 1 jul
  (89,  'oitavas', '2026-06-30 13:00:00-04', 'V J73', 'V J74'),
  -- ... (7 more)
  -- Quartas: 4 jogos, 4-5 jul
  (97,  'quartas', '2026-07-04 13:00:00-04', 'V J89', 'V J90'),
  -- ... (3 more)
  -- Semis: 2 jogos, 14-15 jul
  (101, 'semis', '2026-07-14 21:00:00-04', 'V J97', 'V J98'),
  (102, 'semis', '2026-07-15 21:00:00-04', 'V J99', 'V J100'),
  -- Disputa de 3º: 1 jogo, 18 jul
  (103, 'disputa_terceiro', '2026-07-18 16:00:00-04', 'P J101', 'P J102'),
  -- Final: 1 jogo, 19 jul
  (104, 'final', '2026-07-19 16:00:00-04', 'V J101', 'V J102');
```

Conventions:

- **`data_hora`** uses the timezone offset from the venue's local time as listed by FIFA. Example: matches in NYC (Eastern Time) use `-04:00`, matches in Mexico City use `-06:00`. Postgres `timestamptz` normalizes to UTC internally; the offset is just for human-readability of the source SQL.

- **Group stage rotation:** each group has 4 teams playing 6 matches across 3 matchdays. The pairing rotation between matchdays follows FIFA's official calendar (don't guess — the implementer must derive each match's `placeholder_casa` / `placeholder_fora` from the WebFetch result of Step 6.1). The only universal rule: matchday 3 of the group stage has both matches in each group kicking off SIMULTANEOUSLY per FIFA rules (anti-collusion), so `data_hora` must match within each group on round 3.

- **Knockout placeholders:** Use the conventions:
  - `1X` = team that finished 1st in group X
  - `2X` = team that finished 2nd in group X
  - `V Jnn` = vencedor (winner) of match number nn
  - `P Jnn` = perdedor (loser) of match number nn (only used for disputa de 3º)

- **`numero_jogo`** is sequential 1-104 in chronological order.

- **Bracket structure** for the knockout rounds (104 matches total split as 72/16/8/4/2/1/1) follows the FIFA 2026 expanded format. The exact pairings (which group winner plays which group runner-up) come from the official FIFA bracket published after the December 2025 draw. Mark uncertain pairings with `-- TODO confirmar`.

- **Dates:** if the WebFetch in Step 6.1 doesn't yield exact times for all 104 matches, mark the unresolved ones inline:

  ```sql
  (5, 'grupos', '2026-06-12 17:00:00-04', 'Grupo C - Time 1', 'Grupo C - Time 2'), -- TODO confirmar data/hora
  ```

Confirm row count:

```bash
grep -cE "^  \([0-9]" supabase/seed.sql
```

Expected output: `104` exactly. If different, the row count is wrong — go back and fix.

- [ ] **Step 6.5: Append `copa_resultados` singleton**

```sql

-- ============================================================================
-- 3. COPA_RESULTADOS (singleton — admin atualiza durante/após a Copa)
-- ============================================================================

INSERT INTO copa_resultados (id, finalizada) VALUES (1, false);
```

- [ ] **Step 6.6: Verify seed file structure**

```bash
wc -l supabase/seed.sql
```

Expected: roughly 175-200 lines (header + 48 selecoes + 104 jogos + 1 copa_resultados + section banners).

```bash
grep -c "^INSERT INTO" supabase/seed.sql
```

Expected: `3` (one INSERT per table: selecoes, jogos, copa_resultados).

```bash
grep "TODO confirmar" supabase/seed.sql | wc -l
```

Expected: a small but non-zero number (e.g., 5-15) marking entries the implementer couldn't fully verify against authoritative sources. The user reviews these before applying to production.

- [ ] **Step 6.7: Quality gates**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
```

All clean.

- [ ] **Step 6.8: Commit**

```bash
git add supabase/seed.sql
git commit -m "chore(db): add seed data — 48 selecoes, 104 jogos, copa_resultados"
```

---

## Manual Checkpoint A — Apply migration and seed to Supabase Cloud dev

This checkpoint is **for the developer to perform manually**. Subagents cannot run interactive `supabase db push` reliably. The controller pauses subagent dispatch here until the developer reports back.

- [ ] **Checkpoint A.1: Apply the migration**

From the worktree directory:

```bash
supabase db push
```

Expected output: lists the migration filename, applies it, then runs `supabase/seed.sql`. Final line: "Finished applying migrations" or similar.

If the push fails with a conflict on existing tables, see the Prerequisites section's note about cleaning the public schema first.

If the push hangs longer than 60 seconds, the network connection to the Supabase project may be flaky. Retry once.

- [ ] **Checkpoint A.2: Run smoke validations in Supabase Studio**

Open `https://supabase.com/dashboard/project/rvprwtrcpdyoljlekxdx/sql/new`. Run each query and verify the expected output:

```sql
-- 1) Table count
SELECT COUNT(*) AS table_count FROM pg_tables WHERE schemaname = 'public';
-- Expected: 7
```

```sql
-- 2) Selecoes count
SELECT COUNT(*) FROM selecoes;
-- Expected: 48
```

```sql
-- 3) Jogos count + breakdown by phase
SELECT fase, COUNT(*) FROM jogos GROUP BY fase ORDER BY fase;
-- Expected:
--   16avos             16
--   disputa_terceiro    1
--   final               1
--   grupos             72
--   oitavas             8
--   quartas             4
--   semis               2
```

```sql
-- 4) Copa resultados singleton
SELECT id, finalizada FROM copa_resultados;
-- Expected: 1 row, finalizada = false
```

```sql
-- 5) Brasil group C check
SELECT codigo_iso FROM selecoes WHERE grupo = 'C' ORDER BY codigo_iso;
-- Expected: BRA, HAI, MAR, SCO  (4 rows)
```

```sql
-- 6) RLS enabled on all 7 tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'selecoes', 'jogos', 'bilhetes',
                    'palpites', 'palpites_bonus', 'copa_resultados')
ORDER BY tablename;
-- Expected: all 7 rows with rowsecurity = true
```

If any of these fail, STOP and report back to the controller with the specific failure. The migration may need to be re-applied or rolled back.

- [ ] **Checkpoint A.3: Trigger smoke tests (optional but recommended)**

Run in the Studio SQL editor (still using the postgres role, which bypasses RLS but NOT the triggers):

```sql
-- 1) Insert a fake bilhete in 'pendente' status
INSERT INTO bilhetes (user_id, valor_pago, status_pagamento)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 20.00, 'pendente')
RETURNING id;
-- Note the returned UUID; use it below as <FAKE_BILHETE_ID>.
-- Note: this requires a fake user_id which won't actually exist in auth.users.
-- The FK to auth.users will reject it. Skip this test, or first create a fake
-- auth user via the Studio UI, OR proceed to the magic link signup test below.
```

The trigger smoke tests are most reliably done after a real magic link signup (Checkpoint A.4). Skip ahead.

- [ ] **Checkpoint A.4: Magic link signup smoke test**

To verify `handle_new_user` trigger works end-to-end:

1. Open `pnpm dev` in the worktree (do NOT do this through a subagent; the dev server hangs the bash tool. Run it in the developer's own terminal.).

2. Visit `http://localhost:3000/login` (placeholder page from Feature 1).

3. Manually call the Supabase magic link API. Since Feature 1's `/login` page is just a placeholder with no form, do this from the Supabase Studio Auth dashboard instead:
   - Open `https://supabase.com/dashboard/project/rvprwtrcpdyoljlekxdx/auth/users`
   - Click "Add user" → "Send magic link" with email `abn3t0@gmail.com`
   - Receive the magic link in the inbox; click it. The link redirects to `localhost:3000/auth/callback` which currently returns 501 (placeholder). Ignore the page response; the auth was already exchanged.

4. Verify in Studio SQL editor:
   ```sql
   SELECT id, email, is_admin FROM profiles WHERE email = 'abn3t0@gmail.com';
   ```
   Expected: 1 row, with `is_admin = false`. If the row exists, the `handle_new_user` trigger fired correctly during the auth.users insert.

5. Stop the dev server (Ctrl+C in the developer's terminal, or kill the orphan process per Feature 1's pattern).

- [ ] **Checkpoint A.5: Promote first admin**

```sql
UPDATE profiles SET is_admin = true WHERE email = 'abn3t0@gmail.com';
-- Expected: UPDATE 1
```

Verify:

```sql
SELECT id, email, is_admin FROM profiles WHERE is_admin = true;
-- Expected: 1 row with the admin's email
```

This step uses the postgres role via Studio (which bypasses the `REVOKE UPDATE (is_admin)` from `authenticated`).

When the developer reports back that all of Checkpoint A passed, the controller resumes subagent dispatch with Task 7.

---

## Task 7: Regenerate Supabase types

**Goal:** Replace the placeholder `lib/supabase/types.ts` with the real types regenerated from the now-applied schema.

**Files:**

- Modify: `lib/supabase/types.ts` (overwrite with `pnpm supabase:types` output)

### Steps

- [ ] **Step 7.1: Run the type generation script**

From the worktree directory:

```bash
pnpm supabase:types
```

Expected behavior: the `supabase:types` script (added in Feature 1's `package.json`) runs `supabase gen types typescript --linked > lib/supabase/types.ts`. The output overwrites the placeholder.

If it fails with "no project linked", the user needs to re-run `supabase link --project-ref rvprwtrcpdyoljlekxdx` (per Feature 1's setup) and try again.

- [ ] **Step 7.2: Verify the regenerated types**

```bash
wc -l lib/supabase/types.ts
```

Expected: 500-800 lines (was 175 with the placeholder; now contains all 7 tables, the view, and the 3 enums).

```bash
grep -E "^      (profiles|selecoes|jogos|bilhetes|palpites|palpites_bonus|copa_resultados|ranking):" lib/supabase/types.ts
```

Expected: 8 matches (7 tables + 1 view).

```bash
grep -E "(fase_jogo|status_pagamento|tipo_bonus):" lib/supabase/types.ts
```

Expected: 3 matches.

- [ ] **Step 7.3: Run typecheck against the new types**

The 3 Supabase clients (`lib/supabase/{browser,server,admin,middleware}.ts`) and the env loader will all compile against the new `Database` type. None of them currently consume specific table types — they're only generic over `Database` — but typecheck must still pass.

```bash
pnpm typecheck
```

Expected: zero errors.

- [ ] **Step 7.4: Run all quality gates**

```bash
pnpm lint
pnpm format:check
pnpm test:run
pnpm build
```

All four must pass clean. `pnpm build` is included as a final sanity check that the app still builds with the new types.

If `pnpm format:check` fails because Prettier doesn't like the auto-generated types file's formatting, run `pnpm format` once to normalize, then `pnpm format:check` again. If issues persist, add `lib/supabase/types.ts` to `.prettierignore` (auto-generated files shouldn't be hand-formatted) and commit that adjustment with the types regen.

- [ ] **Step 7.5: Commit**

```bash
git add lib/supabase/types.ts .prettierignore
git commit -m "chore: regenerate Supabase types from cloud dev"
```

(`.prettierignore` only included if you needed to add the types file there in Step 7.4. Otherwise omit.)

---

## Manual Checkpoint B — Final acceptance

Run by the developer after all 7 tasks complete. The controller waits for the developer to confirm before proceeding to merge.

- [ ] **B.1:** `git log --oneline 41df505..HEAD` shows exactly 7 commits in the order:
  ```
  <hash> chore: regenerate Supabase types from cloud dev
  <hash> chore(db): add seed data — 48 selecoes, 104 jogos, copa_resultados
  <hash> feat(db): add ranking view with public access
  <hash> feat(db): add RLS policies and column protection
  <hash> feat(db): add business rule triggers
  <hash> feat(db): add enums, tables, indexes, updated_at trigger
  <hash> chore: scaffold initial schema migration
  ```

- [ ] **B.2:** All quality gates pass: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:run && pnpm build`

- [ ] **B.3:** Smoke counts in Studio match expected (re-run Checkpoint A.2's queries).

- [ ] **B.4:** `is_admin = true` is set for `abn3t0@gmail.com` in `profiles` (from Checkpoint A.5).

- [ ] **B.5:** `lib/supabase/types.ts` is the real generated types (not the placeholder), showing all 7 tables under `public.Tables` and the ranking view under `public.Views`.

- [ ] **B.6:** Working tree is clean: `git status` shows nothing.

- [ ] **B.7:** No `.env.local` was committed: `git log --all -- .env.local` is empty.

- [ ] **B.8:** All `-- TODO confirmar` markers in `supabase/seed.sql` have been reviewed by the user and either resolved or accepted as known-pending. (User has 24h window after merge to resolve before any UI feature consumes the data.)

When all checkboxes pass, the feature is ready for merge to `main` via `superpowers:finishing-a-development-branch`.

---

## Notes for the next developer (Feature 3)

- **`lib/supabase/types.ts` now has real types.** Server Components and Client Components in Feature 3 (Landing page) and beyond can do `await supabase.from('selecoes').select('*')` and get autocomplete + type-checked column names.

- **No bilhetes/palpites data yet.** All seed bilhetes/palpites/palpites_bonus tables are empty. The view `ranking` returns 0 rows until users start signing up, paying, and submitting palpites. Test data can be inserted via Studio after promoting yourself to admin.

- **Cashback slot trigger fires at INSERT time.** When Feature 6 (checkout) builds the bilhete creation flow, it must handle the trigger's `check_violation` exception gracefully — translating the message into a UI-friendly toast like "Vagas de cashback para essa seleção esgotadas".

- **Palpite window trigger.** Feature 7 (UI de palpites) must check `jogo.data_hora > now()` client-side to disable inputs, but rely on the trigger as the authoritative defense. Both layers must be in place; CLAUDE.md §3.4 mandates "defesa em profundidade".

- **Service role rotation.** The service_role key from Feature 1 was exposed in chat. It powers the upcoming Asaas webhook handler (Feature 6) and admin Edge Functions (Feature 10). Recommend rotating in `https://supabase.com/dashboard/project/rvprwtrcpdyoljlekxdx/settings/api` before Feature 6 deploys to production. Update `.env.local` and any Vercel environment variables accordingly.

- **`-- TODO confirmar` markers in `supabase/seed.sql`.** Treat these as known-pending. If Feature 3 lands while they're unresolved, the landing page may show placeholder names like "Time A1" — acceptable for dev but not for launch. Resolve before public release.
