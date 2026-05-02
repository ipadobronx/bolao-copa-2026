-- supabase/migrations/20260502000000_admin_overview_functions.sql
-- ============================================================================
-- F9 Admin Overview — funções SQL para KPIs, pagamentos e vendas
-- Spec: docs/superpowers/specs/2026-05-02-admin-overview-design.md
-- Todas SECURITY DEFINER — acessíveis apenas via service_role (admin client)
-- ============================================================================

-- 1. KPIs gerais
CREATE OR REPLACE FUNCTION public.admin_overview_kpis()
RETURNS TABLE(
  tabelas_vendidas bigint,
  apostadores      bigint,
  arrecadado       numeric,
  pendentes        bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COUNT(*)              FILTER (WHERE status_pagamento = 'confirmado')::bigint AS tabelas_vendidas,
    COUNT(DISTINCT user_id) FILTER (WHERE status_pagamento = 'confirmado')::bigint AS apostadores,
    COALESCE(SUM(valor_pago) FILTER (WHERE status_pagamento = 'confirmado'), 0) AS arrecadado,
    COUNT(*)              FILTER (WHERE status_pagamento = 'pendente')::bigint AS pendentes
  FROM public.bilhetes
$$;

REVOKE EXECUTE ON FUNCTION public.admin_overview_kpis() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_overview_kpis() TO service_role;

-- 2. Últimos pagamentos (com join em profiles e selecoes)
CREATE OR REPLACE FUNCTION public.admin_ultimos_pagamentos(lim int DEFAULT 10)
RETURNS TABLE(
  id                    uuid,
  numero_bilhete        int,
  valor_pago            numeric,
  status_pagamento      text,
  pago_em               timestamptz,
  created_at            timestamptz,
  nome                  text,
  bandeira_emoji        text,
  selecao_nome          text,
  total_bilhetes_usuario bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    b.id,
    b.numero_bilhete,
    b.valor_pago,
    b.status_pagamento::text,
    b.pago_em,
    b.created_at,
    COALESCE(p.nome, 'Apostador') AS nome,
    s.bandeira_emoji,
    s.nome AS selecao_nome,
    (
      SELECT COUNT(*)
      FROM public.bilhetes b2
      WHERE b2.user_id = b.user_id
        AND b2.status_pagamento = 'confirmado'
    )::bigint AS total_bilhetes_usuario
  FROM public.bilhetes b
  JOIN public.profiles p ON p.id = b.user_id
  LEFT JOIN public.selecoes s ON s.id = b.selecao_cashback_id
  ORDER BY COALESCE(b.pago_em, b.created_at) DESC
  LIMIT lim
$$;

REVOKE EXECUTE ON FUNCTION public.admin_ultimos_pagamentos(int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_ultimos_pagamentos(int) TO service_role;

-- 3. Vendas por dia (últimos 7 dias, apenas confirmadas)
CREATE OR REPLACE FUNCTION public.admin_vendas_diarias()
RETURNS TABLE(
  date    text,
  tabelas int,
  receita numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    DATE(COALESCE(pago_em, created_at))::text AS date,
    COUNT(*)::int                              AS tabelas,
    COALESCE(SUM(valor_pago), 0)              AS receita
  FROM public.bilhetes
  WHERE status_pagamento = 'confirmado'
    AND COALESCE(pago_em, created_at) >= now() - interval '7 days'
  GROUP BY DATE(COALESCE(pago_em, created_at))
  ORDER BY date ASC
$$;

REVOKE EXECUTE ON FUNCTION public.admin_vendas_diarias() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_vendas_diarias() TO service_role;
