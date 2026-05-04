-- ============================================================================
-- F10 Admin: Entrada de Resultados + Recálculo de Pontos
-- Spec: docs/superpowers/specs/2026-05-04-admin-resultados-design.md §9
-- ============================================================================
-- Tabela de jobs para recálculo global assíncrono (fire-and-forget).
-- RLS: admins autenticados podem ler; writes via service_role.
-- Realtime habilitado para feedback de progresso no client.
-- ============================================================================

CREATE TABLE public.recalculo_jobs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  escopo            text        NOT NULL CHECK (escopo IN ('jogo', 'bonus', 'global')),
  jogo_id           smallint    REFERENCES public.jogos(id),
  bonus_tipos       text[],
  status            text        NOT NULL DEFAULT 'processando'
                                CHECK (status IN ('processando', 'concluido', 'erro')),
  total_processados int,
  erro_msg          text,
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz
);

ALTER TABLE public.recalculo_jobs ENABLE ROW LEVEL SECURITY;

-- Admins autenticados podem ler seus jobs; writes são exclusivos do service_role
CREATE POLICY "admins can read jobs"
  ON public.recalculo_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Habilita Realtime para feedback de progresso no Client Component
ALTER PUBLICATION supabase_realtime ADD TABLE public.recalculo_jobs;
