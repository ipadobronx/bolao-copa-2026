-- ============================================================================
-- Bolão Copa 2026 — Feature 6: Checkout + Mercado Pago
-- ============================================================================
-- Spec: docs/superpowers/specs/2026-04-30-checkout-mercadopago-design.md
--
-- 1. Renomeia bilhetes.asaas_payment_id → mp_payment_id (+index pra webhook)
-- 2. Atualiza protect_bilhete_payment_columns:
--    - referência à coluna nova (mp_payment_id)
--    - protege selecao_cashback_id (não pode mudar pós-pagamento)
--    - protege cashback_multiplicador_snapshot
-- 3. Drop trigger 20-slot + função + index parcial (sem limite de vagas)
-- 4. Adiciona selecoes.cashback_multiplicador (numeric(3,1), default 0)
-- 5. Seed das 13 elegíveis (1×/2×/3×/5×)
-- 6. Adiciona bilhetes.cashback_multiplicador_snapshot (numeric(3,1), default 0)
-- 7. Trigger enforce_cashback_eligibility: rejeita selecao com mult=0;
--    popula snapshot automaticamente em INSERT ou se selecao_cashback_id mudar
-- 8. View bilhetes_view com effective_status (lazy expiration)
-- ============================================================================

-- 1. Rename + index pra webhook lookup
ALTER TABLE bilhetes RENAME COLUMN asaas_payment_id TO mp_payment_id;

CREATE INDEX bilhetes_mp_payment_id_idx
  ON bilhetes(mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;

-- 2. Atualiza trigger de proteção de colunas (renomeia ref + adiciona 2 colunas)
CREATE OR REPLACE FUNCTION public.protect_bilhete_payment_columns() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.user_id                       IS DISTINCT FROM OLD.user_id
       OR NEW.numero_bilhete             IS DISTINCT FROM OLD.numero_bilhete
       OR NEW.status_pagamento           IS DISTINCT FROM OLD.status_pagamento
       OR NEW.mp_payment_id              IS DISTINCT FROM OLD.mp_payment_id
       OR NEW.valor_pago                 IS DISTINCT FROM OLD.valor_pago
       OR NEW.cashback_pago              IS DISTINCT FROM OLD.cashback_pago
       OR NEW.cashback_multiplicador_snapshot IS DISTINCT FROM OLD.cashback_multiplicador_snapshot
       OR NEW.selecao_cashback_id        IS DISTINCT FROM OLD.selecao_cashback_id
       OR NEW.pago_em                    IS DISTINCT FROM OLD.pago_em
       OR NEW.expira_em                  IS DISTINCT FROM OLD.expira_em
    THEN
      RAISE EXCEPTION 'Colunas de pagamento somente alteráveis via service_role'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Remove enforcement legado de 20 vagas
DROP TRIGGER IF EXISTS bilhetes_cashback_slot_trigger ON bilhetes;
DROP FUNCTION IF EXISTS public.enforce_cashback_slot_limit();
DROP INDEX IF EXISTS bilhetes_cashback_active_idx;

-- 4. Cashback multiplicador em selecoes
ALTER TABLE selecoes
  ADD COLUMN cashback_multiplicador numeric(3,1) NOT NULL DEFAULT 0
    CHECK (cashback_multiplicador IN (0, 1.0, 2.0, 3.0, 5.0));

-- 5. Seed dos 13 elegíveis (idempotente — UPDATEs por codigo_iso)
UPDATE selecoes SET cashback_multiplicador = 1.0 WHERE codigo_iso IN ('FRA','ESP','ENG');
UPDATE selecoes SET cashback_multiplicador = 2.0 WHERE codigo_iso IN ('BRA','ARG');
UPDATE selecoes SET cashback_multiplicador = 3.0 WHERE codigo_iso IN ('POR','GER','NED');
UPDATE selecoes SET cashback_multiplicador = 5.0 WHERE codigo_iso IN ('NOR','SUI','BEL','COL','URU');

-- 6. Snapshot do multiplicador na linha do bilhete (item Q6)
ALTER TABLE bilhetes
  ADD COLUMN cashback_multiplicador_snapshot numeric(3,1) NOT NULL DEFAULT 0
    CHECK (cashback_multiplicador_snapshot >= 0);

-- 7. Trigger: valida elegibilidade + popula snapshot automaticamente
CREATE OR REPLACE FUNCTION public.enforce_cashback_eligibility() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  mult numeric(3,1);
BEGIN
  IF NEW.selecao_cashback_id IS NULL THEN
    NEW.cashback_multiplicador_snapshot := 0;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR OLD.selecao_cashback_id IS DISTINCT FROM NEW.selecao_cashback_id THEN

    SELECT cashback_multiplicador INTO mult
    FROM public.selecoes
    WHERE id = NEW.selecao_cashback_id;

    IF mult IS NULL THEN
      RAISE EXCEPTION 'Seleção % não existe', NEW.selecao_cashback_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF mult <= 0 THEN
      RAISE EXCEPTION 'Seleção % não é elegível para cashback (multiplicador 0)',
        NEW.selecao_cashback_id
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.cashback_multiplicador_snapshot := mult;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bilhetes_cashback_eligibility_trigger
BEFORE INSERT OR UPDATE OF selecao_cashback_id ON bilhetes
FOR EACH ROW EXECUTE FUNCTION public.enforce_cashback_eligibility();

-- 8. View bilhetes_view com effective_status (lazy expiration — Q3)
CREATE OR REPLACE VIEW public.bilhetes_view
WITH (security_invoker = true) AS
SELECT
  b.*,
  CASE
    WHEN b.status_pagamento = 'pendente'
         AND b.expira_em IS NOT NULL
         AND b.expira_em < now()
    THEN 'expirado'::status_pagamento
    ELSE b.status_pagamento
  END AS effective_status
FROM public.bilhetes b;

GRANT SELECT ON public.bilhetes_view TO authenticated;
