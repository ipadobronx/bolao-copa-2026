-- ============================================================================
-- F8 Ranking Realtime
-- Spec: docs/superpowers/specs/2026-05-01-ranking-realtime-design.md
-- ============================================================================

-- 1. View ranking_usuarios (uma linha por usuário, melhor bilhete)
CREATE VIEW public.ranking_usuarios
WITH (security_invoker = false) AS
WITH best AS (
  SELECT DISTINCT ON (user_id) *
  FROM public.ranking
  ORDER BY user_id,
           pontos_totais    DESC,
           acertos_exatos   DESC,
           acertou_campeao  DESC,
           pontos_mata_mata DESC,
           numero_bilhete   ASC
),
contagem AS (
  SELECT user_id, COUNT(*)::int AS total_bilhetes
  FROM public.bilhetes
  WHERE status_pagamento = 'confirmado'
  GROUP BY user_id
)
SELECT
  b.user_id,
  b.nome,
  b.bilhete_id            AS melhor_bilhete_id,
  b.numero_bilhete        AS melhor_numero_bilhete,
  b.pontos_totais,
  b.acertos_exatos,
  b.acertos_parciais,
  b.pontos_mata_mata,
  b.acertou_campeao,
  COALESCE(c.total_bilhetes, 0) AS total_bilhetes,
  ROW_NUMBER() OVER (
    ORDER BY b.pontos_totais    DESC,
             b.acertos_exatos   DESC,
             b.acertou_campeao  DESC,
             b.pontos_mata_mata DESC,
             b.numero_bilhete   ASC
  )::int AS posicao
FROM best b
LEFT JOIN contagem c ON c.user_id = b.user_id;

GRANT SELECT ON public.ranking_usuarios TO anon, authenticated;

-- 2. Tabela ranking_snapshots (histórico de posições para tendência)
CREATE TABLE public.ranking_snapshots (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id),
  posicao       int         NOT NULL,
  pontos_totais int         NOT NULL,
  periodo       text        NOT NULL,
  snapshot_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, periodo)
);

ALTER TABLE public.ranking_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated lê snapshots"
  ON public.ranking_snapshots FOR SELECT TO authenticated USING (true);

-- 3. Tabela ranking_signals (sinal para Realtime)
CREATE TABLE public.ranking_signals (
  id         int         PRIMARY KEY DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ranking_signals VALUES (1, now());

ALTER TABLE public.ranking_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated lê signal"
  ON public.ranking_signals FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.ranking_signals TO authenticated;

-- 4. Função + trigger em palpites → atualiza ranking_signals
CREATE OR REPLACE FUNCTION public.notify_ranking_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.ranking_signals SET updated_at = now() WHERE id = 1;
  RETURN NULL;
END;
$$;

CREATE TRIGGER palpites_ranking_signal
AFTER UPDATE OF pontos_calculados ON public.palpites
FOR EACH STATEMENT
EXECUTE FUNCTION public.notify_ranking_updated();
