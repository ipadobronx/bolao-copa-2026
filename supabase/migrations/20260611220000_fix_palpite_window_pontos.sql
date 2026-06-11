-- Fix: prevent_palpite_after_start bloqueava QUALQUER update em palpites de
-- jogo já iniciado — inclusive a gravação de pontos_calculados pelo recálculo
-- (cron API-Football / admin "lançar resultado"). Como o 1º jogo só terminou
-- em 11/06/2026, o bug nunca tinha surgido: na prática, nenhum jogo finalizado
-- conseguia pontuar (ranking ficaria zerado a Copa inteira).
--
-- Correção: a janela só deve barrar quando o PALPITE (gols) muda. Atualização
-- de pontos_calculados (gols inalterados) deve passar mesmo após o apito.
-- protect_score_column já garante que só service_role altera pontos_calculados,
-- então isso não abre brecha para usuário.

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

  -- Só barra a janela quando o placar do palpite é inserido/alterado.
  -- Updates que só mexem em pontos_calculados (recálculo pós-jogo) passam.
  IF jogo_data_hora <= now()
     AND (
       TG_OP = 'INSERT'
       OR NEW.gols_casa IS DISTINCT FROM OLD.gols_casa
       OR NEW.gols_fora IS DISTINCT FROM OLD.gols_fora
     )
  THEN
    RAISE EXCEPTION 'Janela de palpite encerrada: jogo % iniciou em %',
      NEW.jogo_id, jogo_data_hora
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
