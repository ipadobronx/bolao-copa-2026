-- ============================================================================
-- Bolão Copa 2026 — Atualiza view `ranking` com tiebreakers de §3.5
-- ============================================================================
-- Feature 5 (lib/pontuacao + view tiebreakers)
-- Spec: docs/superpowers/specs/2026-04-30-pontuacao-design.md
--
-- Mudanças vs F2:
--   1. Adiciona coluna `pontos_mata_mata` (soma de pontos_calculados em
--      jogos com fase <> 'grupos'). Usada no critério #3 de desempate.
--   2. Adiciona coluna `acertou_campeao` (boolean: bilhete tem palpite_bonus
--      tipo='campeao' batendo com copa_resultados.campeao_id). Usada no #2.
--   3. Remove `acertos_parciais` da chain de empate (mantida como display).
--   4. Ordem final: pontos_totais > acertos_exatos > acertou_campeao
--                   > pontos_mata_mata > numero_bilhete ASC
--
-- CREATE OR REPLACE preserva grants (anon/authenticated) e ordem 1-8 das
-- colunas existentes; novas colunas aparecem em 9 e 10.
-- ============================================================================

CREATE OR REPLACE VIEW public.ranking
WITH (security_invoker = false) AS
WITH palpite_aggregates AS (
  SELECT
    p.bilhete_id,
    COALESCE(SUM(p.pontos_calculados), 0)::int AS pontos_palpites,
    COALESCE(
      SUM(p.pontos_calculados) FILTER (WHERE j.fase <> 'grupos'),
      0
    )::int AS pontos_mata_mata,
    COUNT(*) FILTER (
      WHERE j.finalizado = true
        AND p.gols_casa = j.gols_casa
        AND p.gols_fora = j.gols_fora
    )::int AS acertos_exatos,
    COUNT(*) FILTER (
      WHERE j.finalizado = true
        AND COALESCE(p.pontos_calculados, 0) > 0
        AND NOT (p.gols_casa = j.gols_casa AND p.gols_fora = j.gols_fora)
    )::int AS acertos_parciais
  FROM palpites p
  JOIN jogos j ON j.id = p.jogo_id
  GROUP BY p.bilhete_id
),
bonus_aggregates AS (
  SELECT
    bilhete_id,
    COALESCE(SUM(pontos_calculados), 0)::int AS pontos_bonus
  FROM palpites_bonus
  GROUP BY bilhete_id
),
campeao_hit AS (
  SELECT pb.bilhete_id
  FROM palpites_bonus pb
  CROSS JOIN copa_resultados cr
  WHERE cr.id = 1
    AND cr.campeao_id IS NOT NULL
    AND pb.tipo = 'campeao'
    AND pb.selecao_id = cr.campeao_id
)
SELECT
  b.id AS bilhete_id,                                                     -- col 1 (preservada)
  b.numero_bilhete,                                                       -- col 2
  b.user_id,                                                              -- col 3
  COALESCE(pr.nome, '') AS nome,                                          -- col 4
  COALESCE(pa.pontos_palpites, 0) + COALESCE(ba.pontos_bonus, 0)
    AS pontos_totais,                                                     -- col 5
  COALESCE(pa.acertos_exatos, 0) AS acertos_exatos,                       -- col 6
  COALESCE(pa.acertos_parciais, 0) AS acertos_parciais,                   -- col 7 (display)
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(pa.pontos_palpites, 0) + COALESCE(ba.pontos_bonus, 0) DESC,
      COALESCE(pa.acertos_exatos, 0) DESC,
      (ch.bilhete_id IS NOT NULL) DESC,            -- §3.5 #2: acertou campeão
      COALESCE(pa.pontos_mata_mata, 0) DESC,       -- §3.5 #3: pontos em mata-mata
      b.numero_bilhete ASC                         -- §3.5 #4: fallback determinístico
  )::int AS posicao,                                                      -- col 8 (preservada)
  COALESCE(pa.pontos_mata_mata, 0) AS pontos_mata_mata,                   -- col 9 (NOVA)
  (ch.bilhete_id IS NOT NULL) AS acertou_campeao                          -- col 10 (NOVA)
FROM bilhetes b
LEFT JOIN palpite_aggregates pa ON pa.bilhete_id = b.id
LEFT JOIN bonus_aggregates    ba ON ba.bilhete_id = b.id
LEFT JOIN campeao_hit         ch ON ch.bilhete_id = b.id
LEFT JOIN profiles            pr ON pr.id = b.user_id
WHERE b.status_pagamento = 'confirmado';

-- Grants são preservados pelo CREATE OR REPLACE; não re-grantear.
