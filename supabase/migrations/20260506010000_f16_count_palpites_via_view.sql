-- F16 fix: RPC count_palpites_confirmados passa a usar bilhetes_view.effective_status
-- como fonte autoritativa de status (em vez de bilhetes.status_pagamento direto).
--
-- Comportamento idêntico hoje (effective_status só altera pendentes expirados,
-- nunca confirmados), mas alinha o RPC com o princípio "effective_status é a
-- verdade autoritativa" usado no resto do código (ex: page.tsx do dashboard).
-- Defesa contra schema drift futuro.

CREATE OR REPLACE FUNCTION public.count_palpites_confirmados(uid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COUNT(p.id)::int
  FROM public.palpites p
  JOIN public.bilhetes_view b ON b.id = p.bilhete_id
  WHERE b.user_id = uid
    AND b.effective_status = 'confirmado'
$$;

-- GRANT já existe da migration anterior (não precisa repetir).
-- COMMENT atualizado pra refletir nova fonte:
COMMENT ON FUNCTION public.count_palpites_confirmados(uuid) IS
  'F16: count de palpites do user em bilhetes confirmados. Usa bilhetes_view.effective_status. Security invoker — RLS de palpites/bilhetes enforça acesso. Usado pelo dashboard pra calcular % preenchido.';
