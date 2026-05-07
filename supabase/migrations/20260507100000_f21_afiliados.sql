-- ============================================================================
-- Bolão Copa 2026 — Feature 21: MVP Afiliados (vendas comissionadas)
-- ============================================================================
-- 1. Tabela afiliados (cadastro manual via /admin/afiliados)
-- 2. bilhetes.afiliado_id (atribuição last-click via localStorage 30d)
-- 3. Tabela afiliado_pagamentos (registro manual quando afiliado pedir saque)
-- 4. RPC admin_afiliados_stats() — vendas, comissão devida, paga, saldo
-- 5. Atualiza protect_bilhete_payment_columns p/ proteger afiliado_id
-- 6. RLS: admin-only em afiliados e afiliado_pagamentos
-- ============================================================================

-- 1. Tabela de afiliados ------------------------------------------------------

CREATE TABLE public.afiliados (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo       text UNIQUE NOT NULL,
  nome         text NOT NULL,
  contato      text,
  comissao_pct numeric(5,2) NOT NULL DEFAULT 10.00
    CHECK (comissao_pct >= 0 AND comissao_pct <= 100),
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  notes        text,
  CONSTRAINT codigo_format CHECK (codigo ~ '^[a-z0-9_-]{3,30}$')
);

CREATE INDEX idx_afiliados_codigo ON public.afiliados(codigo) WHERE ativo = true;

-- 2. Atribuição no bilhete ----------------------------------------------------

ALTER TABLE public.bilhetes
  ADD COLUMN afiliado_id uuid REFERENCES public.afiliados(id) ON DELETE SET NULL;

CREATE INDEX idx_bilhetes_afiliado ON public.bilhetes(afiliado_id)
  WHERE afiliado_id IS NOT NULL AND status_pagamento = 'confirmado';

-- 3. Pagamentos manuais a afiliados -------------------------------------------

CREATE TABLE public.afiliado_pagamentos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id uuid NOT NULL REFERENCES public.afiliados(id) ON DELETE RESTRICT,
  valor       numeric(10,2) NOT NULL CHECK (valor > 0),
  metodo      text NOT NULL DEFAULT 'pix',
  pago_em     timestamptz NOT NULL DEFAULT now(),
  referencia  text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_afiliado_pagamentos_afiliado ON public.afiliado_pagamentos(afiliado_id);

-- 4. Atualiza protect trigger p/ incluir afiliado_id na lista imutável --------
-- Replica corpo completo (CREATE OR REPLACE substitui a função inteira).

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
       OR NEW.cashback_pago_em                IS DISTINCT FROM OLD.cashback_pago_em
       OR NEW.cashback_pago_por               IS DISTINCT FROM OLD.cashback_pago_por
       OR NEW.cashback_multiplicador_snapshot IS DISTINCT FROM OLD.cashback_multiplicador_snapshot
       OR NEW.selecao_cashback_id             IS DISTINCT FROM OLD.selecao_cashback_id
       OR NEW.afiliado_id                     IS DISTINCT FROM OLD.afiliado_id
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

-- 5. RPC admin_afiliados_stats() ---------------------------------------------
-- Stats consolidadas por afiliado ativo: vendas confirmadas, comissão devida,
-- já paga e saldo a pagar. Ordenado por total_vendas DESC.

CREATE OR REPLACE FUNCTION public.admin_afiliados_stats()
RETURNS TABLE(
  afiliado_id        uuid,
  codigo             text,
  nome               text,
  comissao_pct       numeric,
  total_vendas       numeric,
  bilhetes_vendidos  bigint,
  comissao_devida    numeric,
  comissao_paga      numeric,
  saldo              numeric
)
LANGUAGE sql
SET search_path = public, pg_temp
SECURITY DEFINER
STABLE
AS $$
  SELECT
    a.id AS afiliado_id,
    a.codigo,
    a.nome,
    a.comissao_pct,
    COALESCE(SUM(b.valor_pago), 0) AS total_vendas,
    COUNT(b.id)::bigint AS bilhetes_vendidos,
    COALESCE(SUM(b.valor_pago) * (a.comissao_pct / 100), 0) AS comissao_devida,
    COALESCE((SELECT SUM(valor) FROM afiliado_pagamentos WHERE afiliado_id = a.id), 0) AS comissao_paga,
    COALESCE(SUM(b.valor_pago) * (a.comissao_pct / 100), 0)
      - COALESCE((SELECT SUM(valor) FROM afiliado_pagamentos WHERE afiliado_id = a.id), 0) AS saldo
  FROM public.afiliados a
  LEFT JOIN public.bilhetes b
    ON b.afiliado_id = a.id
   AND b.status_pagamento = 'confirmado'
  WHERE a.ativo = true
  GROUP BY a.id, a.codigo, a.nome, a.comissao_pct
  ORDER BY total_vendas DESC
$$;

REVOKE EXECUTE ON FUNCTION public.admin_afiliados_stats() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_afiliados_stats() TO service_role;

-- 6. RLS — admin-only em ambas as tabelas ------------------------------------
-- Service_role bypassa RLS (todos os reads/writes vêm do admin client).
-- authenticated não vê nada por padrão; admin (is_admin()) tem acesso completo.

ALTER TABLE public.afiliados ENABLE ROW LEVEL SECURITY;

CREATE POLICY afiliados_admin_all ON public.afiliados
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.afiliado_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY afiliado_pagamentos_admin_all ON public.afiliado_pagamentos
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
