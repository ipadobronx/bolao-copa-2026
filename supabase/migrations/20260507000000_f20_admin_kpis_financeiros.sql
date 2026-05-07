-- supabase/migrations/20260507000000_f20_admin_kpis_financeiros.sql
-- ============================================================================
-- F20.3 Admin KPIs financeiros — snapshot fixo + análise por período
-- Snapshot: Vendas hoje (destaque), semana, mês, total (sem filtro)
-- Período: Vendas, bilhetes, ticket médio, conversão PIX (filtro from-to)
-- Todas SECURITY DEFINER — acessíveis apenas via service_role (admin client)
-- ============================================================================

-- 1. Snapshot fixo de vendas (independe de filtro do usuário)
CREATE OR REPLACE FUNCTION public.admin_vendas_snapshot()
RETURNS TABLE(
  vendas_hoje    numeric,
  vendas_semana  numeric,
  vendas_mes     numeric,
  vendas_total   numeric
)
LANGUAGE sql
SET search_path = public, pg_temp
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COALESCE(SUM(valor_pago) FILTER (
      WHERE COALESCE(pago_em, created_at) >= date_trunc('day', now())
    ), 0) AS vendas_hoje,
    COALESCE(SUM(valor_pago) FILTER (
      WHERE COALESCE(pago_em, created_at) >= now() - interval '7 days'
    ), 0) AS vendas_semana,
    COALESCE(SUM(valor_pago) FILTER (
      WHERE COALESCE(pago_em, created_at) >= date_trunc('month', now())
    ), 0) AS vendas_mes,
    COALESCE(SUM(valor_pago), 0) AS vendas_total
  FROM public.bilhetes
  WHERE status_pagamento = 'confirmado'
$$;

REVOKE EXECUTE ON FUNCTION public.admin_vendas_snapshot() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_vendas_snapshot() TO service_role;

-- 2. KPIs por período (range customizável)
-- p_from / p_to são timestamptz inclusivos no início, exclusivos no fim.
-- Conversão PIX usa created_at do bilhete (independe de pago_em);
-- vendas/ticket usam COALESCE(pago_em, created_at) pra alinhar com snapshot.
CREATE OR REPLACE FUNCTION public.admin_kpis_periodo(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS TABLE(
  vendas               numeric,
  bilhetes_confirmados bigint,
  bilhetes_criados     bigint,
  ticket_medio         numeric,
  conversao_pix        numeric
)
LANGUAGE sql
SET search_path = public, pg_temp
SECURITY DEFINER
STABLE
AS $$
  WITH conf AS (
    SELECT valor_pago
    FROM public.bilhetes
    WHERE status_pagamento = 'confirmado'
      AND COALESCE(pago_em, created_at) >= p_from
      AND COALESCE(pago_em, created_at) <  p_to
  ),
  criados AS (
    SELECT id, status_pagamento
    FROM public.bilhetes
    WHERE created_at >= p_from
      AND created_at <  p_to
  )
  SELECT
    COALESCE((SELECT SUM(valor_pago) FROM conf), 0)                                AS vendas,
    (SELECT COUNT(*) FROM conf)::bigint                                            AS bilhetes_confirmados,
    (SELECT COUNT(*) FROM criados)::bigint                                         AS bilhetes_criados,
    CASE
      WHEN (SELECT COUNT(*) FROM conf) = 0 THEN 0
      ELSE COALESCE((SELECT SUM(valor_pago) FROM conf), 0) / (SELECT COUNT(*) FROM conf)
    END                                                                            AS ticket_medio,
    CASE
      WHEN (SELECT COUNT(*) FROM criados) = 0 THEN 0
      ELSE
        (SELECT COUNT(*) FROM criados WHERE status_pagamento = 'confirmado')::numeric
        / (SELECT COUNT(*) FROM criados)::numeric
    END                                                                            AS conversao_pix
$$;

REVOKE EXECUTE ON FUNCTION public.admin_kpis_periodo(timestamptz, timestamptz) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_kpis_periodo(timestamptz, timestamptz) TO service_role;
