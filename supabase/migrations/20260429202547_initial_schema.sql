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
