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

-- ============================================================================
-- 5. COLUMN PROTECTION TRIGGERS
-- ============================================================================

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

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================

-- 6.1 profiles ---------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

REVOKE UPDATE (is_admin) ON profiles FROM authenticated;

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

-- ============================================================================
-- 7. VIEW: ranking
-- ============================================================================

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

GRANT SELECT ON public.ranking TO anon, authenticated;
