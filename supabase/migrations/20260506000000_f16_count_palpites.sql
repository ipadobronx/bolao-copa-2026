-- supabase/migrations/20260506000000_f16_count_palpites.sql
-- F16: RPC pra contar palpites preenchidos do user em bilhetes confirmados.
-- Necessário pro card de progresso do dashboard (% preenchido).

CREATE OR REPLACE FUNCTION public.count_palpites_confirmados(uid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COUNT(p.id)::int
  FROM public.palpites p
  JOIN public.bilhetes b ON b.id = p.bilhete_id
  WHERE b.user_id = uid
    AND b.status_pagamento = 'confirmado'
$$;

GRANT EXECUTE ON FUNCTION public.count_palpites_confirmados(uuid) TO authenticated;

COMMENT ON FUNCTION public.count_palpites_confirmados(uuid) IS
  'F16: count de palpites do user em bilhetes confirmados. Security invoker — RLS de palpites/bilhetes enforça acesso. Usado pelo dashboard pra calcular % preenchido.';
