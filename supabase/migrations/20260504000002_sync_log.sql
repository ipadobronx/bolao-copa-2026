CREATE TABLE public.sync_jogos_log (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciado_em             timestamptz NOT NULL DEFAULT now(),
  finalizado_em           timestamptz,
  fonte                   text        NOT NULL CHECK (fonte IN ('cron', 'manual')),
  jogos_verificados       int         NOT NULL DEFAULT 0,
  jogos_atualizados       int         NOT NULL DEFAULT 0,
  placeholders_resolvidos int         NOT NULL DEFAULT 0,
  erros                   jsonb       NOT NULL DEFAULT '[]',
  status                  text        NOT NULL DEFAULT 'processando'
                          CHECK (status IN ('processando', 'sucesso', 'parcial', 'erro'))
);

ALTER TABLE public.sync_jogos_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read sync_log" ON public.sync_jogos_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
