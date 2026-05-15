-- Migration: Palpite especial "Neymar vai ser convocado?"
--
-- Brincadeira promocional pré-Copa. Cada user palpita Sim/Não uma vez no
-- checkout. Quem acertar ganha 1 tabela grátis (admin distribui via SQL manual
-- após a convocação oficial).
--
-- Não interfere com pontuação/ranking — é uma feature paralela ao bolão.

-- ============================================================================
-- 1. Tabelas
-- ============================================================================

-- 1.1 Respostas dos usuários (PK = user_id → 1 row por usuário)
CREATE TABLE public.palpites_neymar (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  resposta   boolean NOT NULL,                       -- true = Sim, false = Não
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.palpites_neymar IS
  'Palpite Sim/Não "Neymar vai ser convocado pra Copa 2026?". 1 row por user; vencedor recebe bilhete grátis via INSERT manual.';

-- 1.2 Config single-row (mesmo padrão de copa_resultados)
CREATE TABLE public.neymar_config (
  id               smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  deadline         timestamptz NOT NULL,
  resposta_correta boolean,                          -- NULL até admin definir
  pergunta         text NOT NULL DEFAULT 'Neymar vai ser convocado pra Copa 2026?'
);

INSERT INTO public.neymar_config (id, deadline)
  VALUES (1, '2026-05-18 23:59:00-03');

COMMENT ON TABLE public.neymar_config IS
  'Config single-row (id=1). deadline trava escrita em palpites_neymar; resposta_correta é setada manualmente pelo admin após convocação.';

-- ============================================================================
-- 2. Helper SQL function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.neymar_aberto() RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT now() < (SELECT deadline FROM public.neymar_config WHERE id = 1)
$$;

COMMENT ON FUNCTION public.neymar_aberto() IS
  'true enquanto o usuário pode salvar/editar palpite do Neymar. Usado por RLS e pelo server action.';

-- ============================================================================
-- 3. Trigger updated_at (reusa função set_updated_at do initial_schema)
-- ============================================================================

CREATE TRIGGER set_updated_at_palpites_neymar BEFORE UPDATE ON public.palpites_neymar
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. RLS
-- ============================================================================

ALTER TABLE public.palpites_neymar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neymar_config   ENABLE ROW LEVEL SECURITY;

-- palpites_neymar: owner-only, e só grava com janela aberta
CREATE POLICY "owner reads own neymar"
  ON public.palpites_neymar FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "owner inserts neymar when open"
  ON public.palpites_neymar FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.neymar_aberto());

CREATE POLICY "owner updates neymar when open"
  ON public.palpites_neymar FOR UPDATE
  USING (user_id = auth.uid() AND public.neymar_aberto())
  WITH CHECK (user_id = auth.uid() AND public.neymar_aberto());

CREATE POLICY "admin manages neymar palpites"
  ON public.palpites_neymar FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- neymar_config: leitura pública (UI precisa de deadline + pergunta), escrita só admin
CREATE POLICY "anyone reads neymar_config"
  ON public.neymar_config FOR SELECT
  USING (true);

CREATE POLICY "admin writes neymar_config"
  ON public.neymar_config FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 5. Permissões pra RPC
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.neymar_aberto() TO anon, authenticated;
