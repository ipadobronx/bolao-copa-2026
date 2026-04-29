# Feature 2 — Schema do banco

**Data:** 2026-04-29
**Status:** Aprovado para implementação
**Autor:** Brainstorm conduzido com Jonatas
**Próximo passo:** writing-plans → executing-plans em worktree separado

---

## 1. Contexto e motivação

Segunda feature da seção 5 do `CLAUDE.md`. Feature 1 (Setup do projeto) deixou:

- 4 clients Supabase prontos (`browser`, `server`, `admin`, `middleware`) tipados via `Database` placeholder em `lib/supabase/types.ts`
- `supabase/config.toml` linkado ao projeto cloud `rvprwtrcpdyoljlekxdx`
- `supabase/migrations/` vazio
- `pnpm supabase:types` script funcional, gerando types vazios atualmente

Esta feature constrói o data layer completo sobre o qual as próximas 12 features vão consultar e mutar:

- **Schema:** 7 tabelas, 1 view (`ranking`), 3 enums, 13 triggers, 8 functions
- **RLS:** habilitado em todas tabelas, policies por tabela seguindo o modelo de privilégios definido nas decisões abaixo
- **Seed:** 48 selecoes da Copa 2026 (FIFA, sorteio dez/2025) + 104 jogos placeholder (datas reais, times TBD em mata-mata) + 1 row em `copa_resultados`
- **Tipos:** regeneração de `lib/supabase/types.ts` a partir do schema real

Esta feature **não entrega:**

- Lógica de pontuação (cálculo de `pontos_calculados`) → Feature 5
- Recálculo automático após admin marcar jogo finalizado → Feature 10
- Cron de expiração de bilhetes pendentes → Feature 6 (checkout/Asaas)
- UI alguma → Features 3, 4, 7-11
- Materialização da view `ranking` se latência > 500ms → futura, conforme CLAUDE.md §6

---

## 2. Decisões consolidadas no brainstorming

| # | Pergunta | Escolha | Motivação |
|---|----------|---------|-----------|
| Q1 | Dados reais dos jogos | **C → Real (ajustado)** | Sorteio fechou em dez/2025 + repescagem em mar/2026; 48 selecoes e 12 grupos definidos. 104 jogos com datas/horários/cidades-sede do calendário oficial FIFA |
| Q2 | Visibilidade de palpites alheios | **B — públicos a partir do início do jogo** | Engagement com integridade; pré-jogo só dono+admin, pós-início público entre autenticados |
| Q3 | Estrutura de migration | **B — 1 migration DDL + supabase/seed.sql** | Padrão Supabase; separa contrato (schema) de dado de exemplo |
| Q4 | Nomes das selecoes | **A → Real (ajustado pro user fornecer ground truth)** | Brasil grupo C com Marrocos/Escócia/Haiti — confirmado pelo user; restante derivado da lista oficial FIFA com `-- TODO confirmar` inline em casos de dúvida |
| — | Defesa em profundidade | **C híbrido** | RLS em tudo + DB triggers SOMENTE pras 2 regras críticas mandadas pelo CLAUDE.md (cashback 20-slot, palpite window) + protections de colunas sensíveis (pagamento, pontuação) |
| — | View ranking — security | **A → `WITH (security_invoker = false)` + GRANT pra anon/authenticated** | Ranking público por natureza; view só projeta `nome` (sem email/CPF) |
| — | Tiebreaker do ranking | **pontos_totais → acertos_exatos → acertos_parciais → numero_bilhete ASC** | Ordem cronológica como último critério (numero_bilhete é serial, único) |

---

## 3. Arquitetura

### 3.1 Enums

```sql
CREATE TYPE fase_jogo AS ENUM (
  'grupos', '16avos', 'oitavas', 'quartas', 'semis', 'disputa_terceiro', 'final'
);

CREATE TYPE status_pagamento AS ENUM (
  'pendente', 'confirmado', 'expirado', 'cancelado'
);

CREATE TYPE tipo_bonus AS ENUM (
  'campeao', 'vice', 'terceiro', 'quarto', 'artilheiro', 'revelacao'
);
```

### 3.2 Tabelas

#### `profiles`

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text,
  email text NOT NULL,
  telefone text,
  cpf text,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_email_idx ON profiles(email);
CREATE UNIQUE INDEX profiles_cpf_unique ON profiles(cpf) WHERE cpf IS NOT NULL;
```

#### `selecoes`

```sql
CREATE TABLE selecoes (
  id smallserial PRIMARY KEY,
  nome text NOT NULL,
  codigo_iso text NOT NULL UNIQUE,
  bandeira_emoji text NOT NULL,
  grupo char(1) NOT NULL CHECK (grupo BETWEEN 'A' AND 'L'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX selecoes_grupo_idx ON selecoes(grupo);
```

#### `jogos`

```sql
CREATE TABLE jogos (
  id smallserial PRIMARY KEY,
  numero_jogo smallint NOT NULL UNIQUE CHECK (numero_jogo BETWEEN 1 AND 104),
  fase fase_jogo NOT NULL,
  data_hora timestamptz NOT NULL,
  selecao_casa_id smallint REFERENCES selecoes(id),
  selecao_fora_id smallint REFERENCES selecoes(id),
  placeholder_casa text,
  placeholder_fora text,
  gols_casa smallint CHECK (gols_casa >= 0),
  gols_fora smallint CHECK (gols_fora >= 0),
  finalizado boolean NOT NULL DEFAULT false,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT casa_defined CHECK (
    selecao_casa_id IS NOT NULL OR placeholder_casa IS NOT NULL
  ),
  CONSTRAINT fora_defined CHECK (
    selecao_fora_id IS NOT NULL OR placeholder_fora IS NOT NULL
  ),
  CONSTRAINT placar_consistente CHECK (
    (finalizado = true AND gols_casa IS NOT NULL AND gols_fora IS NOT NULL)
    OR finalizado = false
  )
);

CREATE INDEX jogos_data_hora_idx ON jogos(data_hora);
CREATE INDEX jogos_fase_idx ON jogos(fase);
```

#### `bilhetes`

```sql
CREATE TABLE bilhetes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_bilhete serial UNIQUE,
  status_pagamento status_pagamento NOT NULL DEFAULT 'pendente',
  valor_pago numeric(10,2) NOT NULL CHECK (valor_pago >= 0),
  asaas_payment_id text,
  selecao_cashback_id smallint REFERENCES selecoes(id),
  cashback_pago boolean NOT NULL DEFAULT false,
  pago_em timestamptz,
  expira_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cashback_min_value CHECK (
    selecao_cashback_id IS NULL OR valor_pago >= 100.00
  )
);

CREATE INDEX bilhetes_user_id_idx ON bilhetes(user_id);
CREATE INDEX bilhetes_status_idx ON bilhetes(status_pagamento);
CREATE INDEX bilhetes_cashback_active_idx ON bilhetes(selecao_cashback_id)
  WHERE selecao_cashback_id IS NOT NULL
    AND status_pagamento IN ('pendente', 'confirmado');
```

#### `palpites`

```sql
CREATE TABLE palpites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bilhete_id uuid NOT NULL REFERENCES bilhetes(id) ON DELETE CASCADE,
  jogo_id smallint NOT NULL REFERENCES jogos(id),
  gols_casa smallint NOT NULL CHECK (gols_casa BETWEEN 0 AND 30),
  gols_fora smallint NOT NULL CHECK (gols_fora BETWEEN 0 AND 30),
  pontos_calculados smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bilhete_id, jogo_id)
);

CREATE INDEX palpites_bilhete_idx ON palpites(bilhete_id);
CREATE INDEX palpites_jogo_idx ON palpites(jogo_id);
```

#### `palpites_bonus`

```sql
CREATE TABLE palpites_bonus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bilhete_id uuid NOT NULL REFERENCES bilhetes(id) ON DELETE CASCADE,
  tipo tipo_bonus NOT NULL,
  selecao_id smallint REFERENCES selecoes(id),
  jogador_nome text,
  pontos_calculados smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bilhete_id, tipo),
  CONSTRAINT bonus_payload CHECK (
    (tipo = 'artilheiro' AND jogador_nome IS NOT NULL AND selecao_id IS NULL)
    OR
    (tipo <> 'artilheiro' AND selecao_id IS NOT NULL AND jogador_nome IS NULL)
  )
);

CREATE INDEX palpites_bonus_bilhete_idx ON palpites_bonus(bilhete_id);
```

#### `copa_resultados`

```sql
CREATE TABLE copa_resultados (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  campeao_id smallint REFERENCES selecoes(id),
  vice_id smallint REFERENCES selecoes(id),
  terceiro_id smallint REFERENCES selecoes(id),
  quarto_id smallint REFERENCES selecoes(id),
  artilheiro_nome text,
  revelacao_id smallint REFERENCES selecoes(id),
  finalizada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.3 `set_updated_at` (trigger genérico aplicado a 6 tabelas)

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_jogos BEFORE UPDATE ON jogos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_bilhetes BEFORE UPDATE ON bilhetes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_palpites BEFORE UPDATE ON palpites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_palpites_bonus BEFORE UPDATE ON palpites_bonus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_copa_resultados BEFORE UPDATE ON copa_resultados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### 3.4 Functions e triggers de regra de negócio

#### `is_admin()` — helper RLS

```sql
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;
```

#### `handle_new_user()` — auto-cria profile no signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### `prevent_palpite_after_start()` — janela + bilhete confirmado

```sql
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

  IF jogo_data_hora <= now() THEN
    RAISE EXCEPTION 'Janela de palpite encerrada: jogo % iniciou em %',
      NEW.jogo_id, jogo_data_hora
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER palpites_window_trigger
BEFORE INSERT OR UPDATE ON palpites
FOR EACH ROW EXECUTE FUNCTION public.prevent_palpite_after_start();
```

#### `prevent_bonus_when_unconfirmed()` — bonus só em bilhete confirmado

```sql
CREATE OR REPLACE FUNCTION public.prevent_bonus_when_unconfirmed() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  bilhete_status status_pagamento;
BEGIN
  SELECT status_pagamento INTO bilhete_status
  FROM public.bilhetes WHERE id = NEW.bilhete_id;

  IF bilhete_status <> 'confirmado' THEN
    RAISE EXCEPTION 'Bilhete % não está confirmado (status atual: %)',
      NEW.bilhete_id, bilhete_status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER palpites_bonus_confirmed_trigger
BEFORE INSERT OR UPDATE ON palpites_bonus
FOR EACH ROW EXECUTE FUNCTION public.prevent_bonus_when_unconfirmed();
```

#### `enforce_cashback_slot_limit()` — limite rígido de 20 vagas (CLAUDE.md §3.3)

```sql
CREATE OR REPLACE FUNCTION public.enforce_cashback_slot_limit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  current_count int;
BEGIN
  IF NEW.selecao_cashback_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.selecao_cashback_id IS NOT DISTINCT FROM NEW.selecao_cashback_id THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('cashback_slot_' || NEW.selecao_cashback_id::text)
  );

  SELECT COUNT(*) INTO current_count
  FROM public.bilhetes
  WHERE selecao_cashback_id = NEW.selecao_cashback_id
    AND id <> NEW.id
    AND status_pagamento IN ('pendente', 'confirmado')
    AND (expira_em IS NULL OR expira_em > now());

  IF current_count >= 20 THEN
    RAISE EXCEPTION 'Limite de 20 vagas de cashback atingido para a seleção %',
      NEW.selecao_cashback_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bilhetes_cashback_slot_trigger
BEFORE INSERT OR UPDATE OF selecao_cashback_id ON bilhetes
FOR EACH ROW EXECUTE FUNCTION public.enforce_cashback_slot_limit();
```

`pg_advisory_xact_lock` previne race condition entre webhooks Asaas concorrentes.

#### `protect_bilhete_payment_columns()` — proteção de colunas sensíveis

```sql
CREATE OR REPLACE FUNCTION public.protect_bilhete_payment_columns() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.user_id          IS DISTINCT FROM OLD.user_id
       OR NEW.numero_bilhete    IS DISTINCT FROM OLD.numero_bilhete
       OR NEW.status_pagamento  IS DISTINCT FROM OLD.status_pagamento
       OR NEW.asaas_payment_id  IS DISTINCT FROM OLD.asaas_payment_id
       OR NEW.valor_pago        IS DISTINCT FROM OLD.valor_pago
       OR NEW.cashback_pago     IS DISTINCT FROM OLD.cashback_pago
       OR NEW.pago_em           IS DISTINCT FROM OLD.pago_em
       OR NEW.expira_em         IS DISTINCT FROM OLD.expira_em
    THEN
      RAISE EXCEPTION 'Colunas de pagamento somente alteráveis via service_role'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bilhetes_protect_payment_columns
BEFORE UPDATE ON bilhetes
FOR EACH ROW EXECUTE FUNCTION public.protect_bilhete_payment_columns();
```

#### `protect_score_column()` — proteção de `pontos_calculados` (palpites + bonus)

```sql
CREATE OR REPLACE FUNCTION public.protect_score_column() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NEW.pontos_calculados IS DISTINCT FROM OLD.pontos_calculados
  THEN
    RAISE EXCEPTION 'pontos_calculados somente alterável via service_role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER palpites_protect_score
BEFORE UPDATE ON palpites
FOR EACH ROW EXECUTE FUNCTION public.protect_score_column();

CREATE TRIGGER palpites_bonus_protect_score
BEFORE UPDATE ON palpites_bonus
FOR EACH ROW EXECUTE FUNCTION public.protect_score_column();
```

Pontuação é a regra mais crítica do sistema (CLAUDE.md §3.1) — defesa em profundidade igual ao bilhete de pagamento.

### 3.5 RLS policies

#### `profiles`

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

REVOKE UPDATE (is_admin) ON profiles FROM authenticated;
```

INSERT bloqueado (handle_new_user é SECURITY DEFINER, bypassa). DELETE bloqueado (CASCADE de auth.users cuida).

#### `selecoes`, `jogos`, `copa_resultados` — read-públicas, write-admin

```sql
ALTER TABLE selecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY selecoes_select_all ON selecoes
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY selecoes_admin_write ON selecoes
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE jogos ENABLE ROW LEVEL SECURITY;

CREATE POLICY jogos_select_all ON jogos
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY jogos_admin_write ON jogos
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE copa_resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY copa_resultados_select_all ON copa_resultados
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY copa_resultados_admin_update ON copa_resultados
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
```

#### `bilhetes`

```sql
ALTER TABLE bilhetes ENABLE ROW LEVEL SECURITY;

CREATE POLICY bilhetes_select_own_or_admin ON bilhetes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY bilhetes_insert_own ON bilhetes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status_pagamento = 'pendente'
    AND cashback_pago = false
  );

CREATE POLICY bilhetes_update_own_or_admin ON bilhetes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
```

(Trigger `protect_bilhete_payment_columns` complementa: user que tenta alterar coluna sensível é bloqueado mesmo passando RLS.)

#### `palpites` — visibilidade pós-início do jogo (decisão Q2)

```sql
ALTER TABLE palpites ENABLE ROW LEVEL SECURITY;

CREATE POLICY palpites_select_own_or_started ON palpites
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = palpites.bilhete_id AND b.user_id = auth.uid()
    )
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM jogos j
      WHERE j.id = palpites.jogo_id AND j.data_hora <= now()
    )
  );

CREATE POLICY palpites_insert_own ON palpites
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = bilhete_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY palpites_update_own ON palpites
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = palpites.bilhete_id AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = bilhete_id AND b.user_id = auth.uid()
    )
  );
```

(Trigger `protect_score_column` complementa: user não altera `pontos_calculados`.)

#### `palpites_bonus` — visibilidade pós-início da Copa

```sql
ALTER TABLE palpites_bonus ENABLE ROW LEVEL SECURITY;

CREATE POLICY palpites_bonus_select_own_or_copa_started ON palpites_bonus
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = palpites_bonus.bilhete_id AND b.user_id = auth.uid()
    )
    OR public.is_admin()
    OR (SELECT MIN(data_hora) FROM jogos) <= now()
  );

CREATE POLICY palpites_bonus_insert_own ON palpites_bonus
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = bilhete_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY palpites_bonus_update_own ON palpites_bonus
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = palpites_bonus.bilhete_id AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bilhetes b
      WHERE b.id = bilhete_id AND b.user_id = auth.uid()
    )
  );
```

### 3.6 View `ranking`

`WITH (security_invoker = false)` faz a view rodar com privilégios do owner (postgres) — bypassa RLS das tabelas underlying. Justificável: a view só projeta `nome` (não email, não CPF, não payment data).

```sql
CREATE OR REPLACE VIEW public.ranking
WITH (security_invoker = false) AS
WITH palpite_aggregates AS (
  SELECT
    p.bilhete_id,
    COALESCE(SUM(p.pontos_calculados), 0)::int AS pontos_palpites,
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
)
SELECT
  b.id AS bilhete_id,
  b.numero_bilhete,
  b.user_id,
  COALESCE(pr.nome, '') AS nome,
  COALESCE(pa.pontos_palpites, 0) + COALESCE(ba.pontos_bonus, 0) AS pontos_totais,
  COALESCE(pa.acertos_exatos, 0) AS acertos_exatos,
  COALESCE(pa.acertos_parciais, 0) AS acertos_parciais,
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(pa.pontos_palpites, 0) + COALESCE(ba.pontos_bonus, 0) DESC,
      COALESCE(pa.acertos_exatos, 0) DESC,
      COALESCE(pa.acertos_parciais, 0) DESC,
      b.numero_bilhete ASC
  )::int AS posicao
FROM bilhetes b
LEFT JOIN palpite_aggregates pa ON pa.bilhete_id = b.id
LEFT JOIN bonus_aggregates ba ON ba.bilhete_id = b.id
LEFT JOIN profiles pr ON pr.id = b.user_id
WHERE b.status_pagamento = 'confirmado';

GRANT SELECT ON public.ranking TO anon, authenticated;
```

### 3.7 Seed (`supabase/seed.sql`)

#### Selecoes (48 nações da Copa 2026)

48 INSERTs em `selecoes`. Lista derivada do sorteio FIFA de 05/12/2025 + repescagem de mar/2026. Confirmado pelo user: **Brasil grupo C** com Marrocos, Escócia e Haiti. Restante dos grupos (A, B, D-L) detalhado no Plan, com `-- TODO confirmar` inline em qualquer entrada com dúvida.

Exemplo de estrutura:

```sql
INSERT INTO selecoes (nome, codigo_iso, bandeira_emoji, grupo) VALUES
  ('Canadá',         'CAN', '🇨🇦', 'A'),
  ('México',         'MEX', '🇲🇽', 'A'),
  -- ... (46 outras linhas, listadas no plano de implementação)
  ('Brasil',         'BRA', '🇧🇷', 'C'),
  ('Marrocos',       'MAR', '🇲🇦', 'C'),
  ('Escócia',        'SCO', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'C'),
  ('Haiti',          'HAI', '🇭🇹', 'C')
  -- ...
;
```

#### Jogos (104 partidas, datas reais, times placeholder)

72 jogos de fase de grupos (3 rodadas × 24 jogos) + 32 jogos de mata-mata (16avos: 16, oitavas: 8, quartas: 4, semis: 2, disputa de 3º: 1, final: 1). Datas e horários do calendário oficial FIFA.

Exemplo de estrutura:

```sql
INSERT INTO jogos (numero_jogo, fase, data_hora, placeholder_casa, placeholder_fora) VALUES
  -- Fase de grupos
  (1,  'grupos', '2026-06-11 17:00:00-04', 'Grupo A - Time 1', 'Grupo A - Time 2'),
  (2,  'grupos', '2026-06-11 20:00:00-04', 'Grupo B - Time 1', 'Grupo B - Time 2'),
  -- ... (70 outras linhas)
  -- Mata-mata
  (73, '16avos', '2026-06-27 13:00:00-04', '1A', '2B'),
  (74, '16avos', '2026-06-27 17:00:00-04', '1C', '2D'),
  -- ... (28 outras linhas)
  (101, 'semis',            '2026-07-14 21:00:00-04', 'V QF1', 'V QF2'),
  (102, 'semis',            '2026-07-15 21:00:00-04', 'V QF3', 'V QF4'),
  (103, 'disputa_terceiro', '2026-07-18 16:00:00-04', 'P SF1', 'P SF2'),
  (104, 'final',            '2026-07-19 16:00:00-04', 'V SF1', 'V SF2');
```

Convenções de placeholder:
- Fase de grupos: `Grupo X - Time N` até admin substituir por seleção real
- 16avos / oitavas / quartas: `1A`, `2B`, `V XX`, `P XX` (vencedor/perdedor de jogo X)
- Semis: `V QF1` etc. (vencedor das quartas)
- Disputa de 3º / Final: `V SF1`, `P SF1` (vencedor/perdedor das semis)

`data_hora` em UTC-4 (Eastern Time). Lista completa no Plan, com `-- TODO confirmar` em horários onde houver dúvida.

#### `copa_resultados` (singleton)

```sql
INSERT INTO copa_resultados (id, finalizada) VALUES (1, false);
```

---

## 4. Plano de commits (sequência reviewable)

| # | Mensagem | Conteúdo |
|---|---|---|
| 1 | `chore: scaffold initial schema migration` | `supabase migration new initial_schema` (cria stub timestamped vazio) |
| 2 | `feat(db): add enums, tables, indexes, updated_at trigger` | Enums (3) + 7 tabelas + indexes + CHECK constraints + função/triggers `set_updated_at` |
| 3 | `feat(db): add business rule triggers` | `is_admin()`, `handle_new_user`, `prevent_palpite_after_start`, `prevent_bonus_when_unconfirmed`, `enforce_cashback_slot_limit` |
| 4 | `feat(db): add RLS policies and column protection` | Policies pra todas 7 tabelas + `protect_bilhete_payment_columns` + `protect_score_column` |
| 5 | `feat(db): add ranking view with public access` | View `ranking` com `WITH (security_invoker = false)` + GRANT pra anon/authenticated |
| 6 | `chore(db): add seed data — 48 selecoes, 104 jogos, copa_resultados` | `supabase/seed.sql` com dados reais FIFA — `-- TODO confirmar` inline em casos de dúvida |
| 7 | `chore: regenerate Supabase types from cloud dev` | `lib/supabase/types.ts` regenerado após `supabase db push` |

---

## 5. Critério de pronto da feature

- [ ] **Migration única** (`supabase/migrations/<timestamp>_initial_schema.sql`) aplica via `supabase db push` sem erro
- [ ] **Seed** (`supabase/seed.sql`) aplica sem erro: 48 selecoes + 104 jogos + 1 copa_resultados
- [ ] **`pnpm supabase:types`** regenera `lib/supabase/types.ts` (cresce de ~175 → ~600 linhas)
- [ ] **`pnpm typecheck`** passa com types reais (sem `any`)
- [ ] **`pnpm lint` + `pnpm format:check` + `pnpm test:run`** continuam passando
- [ ] Smoke counts (via Supabase Studio):
  - `SELECT COUNT(*) FROM selecoes` → 48
  - `SELECT COUNT(*) FROM jogos` → 104
  - `SELECT COUNT(*) FROM jogos WHERE fase = 'grupos'` → 72
  - `SELECT COUNT(*) FROM jogos WHERE fase <> 'grupos'` → 32
  - `SELECT COUNT(*) FROM copa_resultados` → 1
- [ ] Brasil no grupo C com Marrocos/Escócia/Haiti:
  - `SELECT codigo_iso FROM selecoes WHERE grupo = 'C' ORDER BY codigo_iso` → BRA, HAI, MAR, SCO
- [ ] Trigger smokes (no Studio):
  - INSERT em `palpites` com bilhete `pendente` → erro
  - INSERT em `palpites` com bilhete `confirmado` mas jogo iniciado → erro
  - 21º INSERT pra mesma `selecao_cashback_id` → erro
  - UPDATE em `bilhetes.status_pagamento` por user → erro
  - UPDATE em `palpites.pontos_calculados` por user → erro
- [ ] Auth signup smoke (manual): magic link → user em `auth.users` → row em `profiles` automaticamente (`is_admin=false`)
- [ ] `git log --oneline` mostra os 7 commits temáticos

---

## 6. Steps manuais que o desenvolvedor executa

1. **Aplicar migration + seed na cloud dev:**
   ```bash
   supabase db push
   ```
   Se houver conflitos com schema existente, opções:
   - `supabase db reset --linked` (DESTRUTIVO — apaga schema public). Use só se cloud dev é descartável.
   - Aplicar DROP IF EXISTS adequados manualmente antes do push.

2. **Regenerar types:**
   ```bash
   pnpm supabase:types
   ```

3. **Promover primeiro admin** (após primeiro signin via magic link, no Supabase Studio SQL editor):
   ```sql
   UPDATE profiles SET is_admin = true WHERE email = 'abn3t0@gmail.com';
   ```

4. **Validações smoke** (queries acima, no Studio).

---

## 7. Riscos e pontos de atenção

- **Schema public possivelmente sujo na cloud dev `rvprwtrcpdyoljlekxdx`:** rodar `\dt public.*` no Studio antes do push pra confirmar limpeza.
- **Service role key exposta no chat (Feature 1):** ainda recomendado rotacionar antes de aplicar essa migration. Webhook handler (Feature 6) vai usar essa key — comprometida, é vetor de write irrestrito.
- **`pg_advisory_xact_lock` em serverless:** Vercel functions são processos curtos. O lock é por TX, funciona em qualquer worker.
- **Subquery escalar `MIN(data_hora) FROM jogos` em RLS de bonus:** com 104 jogos, OK; planner deve cachear. Se virar bottleneck, mover pra função STABLE.
- **Re-apply de migration após prod:** Supabase migrations são imutáveis em prod. Bug descoberto depois → criar 2ª migration de correção.
- **Performance da view `ranking`:** com >1k bilhetes em prod, latência pode passar 500ms (CLAUDE.md §6). Plano contingente: materializar com refresh a cada 5min (durante jogos, 1min). Não nesta feature.

---

## 8. O que NÃO está aqui (escopo)

- Lógica de pontuação real (10/7/5 pts, multiplicadores, +2 bônus) → Feature 5
- Edge Function de recálculo após admin marcar jogo finalizado → Feature 10
- Cron de expiração de bilhetes pendentes → Feature 6
- UI de admin (marcar resultados, gerenciar cashbacks, KPIs) → Features 9-11
- UI de palpites, dashboard, landing → Features 3, 4, 7
- Materialização de ranking → futura, condicionada a perf
- Janela de bonus picks pré-Copa → enforced em app (Feature 7)
- Tradução de erros `check_violation` pra UI amigável → cada feature mapeia o seu
- Backups, replicação, monitoring → infra Supabase Cloud
- Cidade-sede de jogos como coluna em `jogos` → fora do escopo do CLAUDE.md §4; pode entrar via Feature 12 (API-Football) se relevante
