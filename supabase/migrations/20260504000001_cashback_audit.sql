-- ============================================================================
-- Bolão Copa 2026 — Feature 11: Admin Cashbacks
-- ============================================================================
-- Spec: docs/superpowers/specs/2026-05-04-f11-cashbacks-design.md §5
--
-- 1. Adiciona cashback_pago_em e cashback_pago_por em bilhetes (audit trail)
-- 2. Atualiza protect_bilhete_payment_columns para incluir novas colunas
-- 3. Cria RPC admin_cashbacks_kpis() SECURITY DEFINER
-- ============================================================================

-- 1. Audit trail do pagamento de cashback
ALTER TABLE public.bilhetes
  ADD COLUMN cashback_pago_em  timestamptz,
  ADD COLUMN cashback_pago_por uuid REFERENCES public.profiles(id);

-- 2. Atualiza trigger de proteção — inclui as 2 novas colunas na lista imutável
--    (replica o corpo completo porque CREATE OR REPLACE substitui a função inteira)
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

-- 3. RPC para os 4 KPI cards de /admin/cashbacks
CREATE OR REPLACE FUNCTION public.admin_cashbacks_kpis()
RETURNS TABLE (
  exposicao_total      numeric,
  pior_cenario_selecao text,
  pior_cenario_valor   numeric,
  bilhetes_elegiveis   bigint,
  a_pagar_agora        bigint
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
    SELECT selecao_cashback_id, selecao_nome, SUM(exposicao) AS total_exposicao
    FROM base
    GROUP BY selecao_cashback_id, selecao_nome
  ),
  pior AS (
    SELECT selecao_nome, total_exposicao FROM por_selecao
    ORDER BY total_exposicao DESC LIMIT 1
  ),
  copa AS (
    SELECT campeao_id, finalizada FROM copa_resultados WHERE id = 1
  )
  SELECT
    COALESCE((SELECT SUM(exposicao) FROM base), 0)  AS exposicao_total,
    COALESCE((SELECT selecao_nome FROM pior), '—')  AS pior_cenario_selecao,
    COALESCE((SELECT total_exposicao FROM pior), 0) AS pior_cenario_valor,
    (SELECT COUNT(*) FROM base)                     AS bilhetes_elegiveis,
    CASE
      WHEN (SELECT finalizada FROM copa) = true THEN (
        SELECT COUNT(*) FROM base
        WHERE selecao_cashback_id = (SELECT campeao_id FROM copa)
          AND cashback_pago = false
      )
      ELSE NULL
    END AS a_pagar_agora;
$$;
