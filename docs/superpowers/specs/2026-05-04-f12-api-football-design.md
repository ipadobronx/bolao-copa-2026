# Feature 12 — Cron API-Football: Automação de Resultados

**Data:** 2026-05-04
**Status:** Aprovado para implementação
**Autor:** Brainstorm conduzido com Jonatas
**Próximo passo:** writing-plans → executing-plans em worktree separado

---

## 1. Contexto e motivação

F12 é a automação completa de resultados durante a Copa 2026. Elimina trabalho manual do admin: sync a cada 2h detecta jogos finalizados na API-Football, atualiza placares, recalcula pontos e resolve placeholders de mata-mata — tudo sem intervenção humana.

**F1–F11 mergeadas.** F10 entregou toda a lógica de recálculo (`lib/recalculo.ts`, `POST /api/admin/recalcular`). F12 reutiliza essa lógica como consumer — nenhum recálculo reimplementado.

---

## 2. Decisões tomadas durante o brainstorming

| # | Pergunta | Escolha | Motivação |
|---|----------|---------|-----------|
| Q1 | Recalcular ao sincronizar? | **Sim — full automation** | Sem recálculo o sync não automatiza nada; admin tem fallback manual (botão F10) se falhar |
| Q2 | Resolver placeholders mata-mata? | **Sim — automático** | Mata-mata é onde admin mais sofre; zero benefit em manter manual |
| Q3 | Mapping inicial de `external_id` | **C como primária (data+fase), A como fallback (lazy por times)** | API-Football tem IDs estáveis pré-Copa; lazy cobre edge cases pós-mapping |
| Q4 | Arquitetura de cron | **Next.js Route Handler + Vercel Cron** | Consistente com F10 (decisão Q6); importa `lib/recalculo.ts` diretamente; sem Deno |
| Q5 | Quota API | **`GET /fixtures?ids=X,Y,Z`** | 1 req por run; ~12 reqs/dia durante Copa; 0 reqs fora da Copa (early return) |

---

## 3. O que F12 entrega

**Entrega:**
- `lib/api-football.ts` — HTTP client tipado (parse de fixtures, mapas de nomes e fases)
- `lib/sync-jogos.ts` — lógica pura: API response → UPDATE payloads (sem I/O, testável)
- `app/api/cron/sync-jogos/route.ts` — POST, guard `CRON_SECRET`
- `app/api/admin/sync-jogos-manual/route.ts` — POST, guard `is_admin`
- `app/api/admin/mapear-fixtures/route.ts` — POST, is_admin (mapping one-time)
- `components/admin/SyncStatus.tsx` — último sync + botão "Sincronizar agora" + "Mapear fixtures"
- `vercel.json` — cron `0 */2 * * *`
- Migration `sync_jogos_log`
- `lib/env-server.ts` + `.env.local.example` atualizados
- TDD ≥ 95% em `lib/api-football.ts` e `lib/sync-jogos.ts`

**Não entrega:**
- Ranking realtime baseado em gols ao vivo
- Notificações WhatsApp (F13)
- Histórico de scores intermediários
- UI para editar `external_id` individual (usa `PATCH /api/admin/jogos/[id]` do F10)

---

## 4. Arquitetura de arquivos

```
lib/
  api-football.ts              ← HTTP client + mapas estáticos + parse
  sync-jogos.ts                ← lógica pura: updates + resolução de placeholder
  env-server.ts                ← + API_FOOTBALL_KEY + CRON_SECRET

app/api/
  cron/sync-jogos/route.ts     ← POST, CRON_SECRET guard
  admin/
    sync-jogos-manual/route.ts ← POST, is_admin guard
    mapear-fixtures/route.ts   ← POST, is_admin guard

components/admin/
  SyncStatus.tsx               ← Client Component

supabase/migrations/
  20260504000002_sync_log.sql

vercel.json                    ← NOVO

Modificados:
  lib/env-server.ts
  app/(admin)/admin/jogos/JogosClient.tsx  ← inclui SyncStatus
  .env.local.example
```

---

## 5. Algoritmo de sync (por run)

### 5.1 Janela de tempo

```sql
SELECT jogos.*,
       sc.nome AS selecao_casa_nome,
       sf.nome AS selecao_fora_nome
FROM jogos
LEFT JOIN selecoes sc ON sc.id = selecao_casa_id
LEFT JOIN selecoes sf ON sf.id = selecao_fora_id
WHERE finalizado = false
  AND external_id IS NOT NULL
  AND data_hora BETWEEN now() - interval '3 hours' AND now() + interval '1 hour'
```

`−3h` cobre jogos que deveriam ter terminado (inclui prorrogação + margem).
`+1h` detecta mudanças de horário FIFA em jogos prestes a começar.

### 5.2 Fluxo principal

```
1. Busca jogos elegíveis (query acima)
2. Lazy match: jogos com external_id IS NULL na janela → tenta match por
   (TEAM_NAME_MAP[fixture.teams.home.name] === selecao_casa.nome AND data_hora ±30min)
   usando o mapa estático de lib/api-football.ts (sem coluna extra no banco).
   Se bate → salva external_id e inclui no sync
3. Se lista total vazia → grava log { status: 'sucesso', jogos_verificados: 0 } → return 200
4. GET /fixtures?ids=X,Y,Z
5. Para cada fixture:
   FT / AET / PEN → finalizado = true, atualiza gols
   LIVE (1H/2H/HT/ET/BT/P) → atualiza gols, finalizado permanece false
   NS / PST / CANC / ABD → skip
6. Monta updates via lib/sync-jogos.ts (pura)
7. Executa updates no banco (idempotente)
8. Para cada jogo recém-finalizado (false → true):
   a. Importa e chama calcularUpdatesPalpites de lib/recalculo.ts diretamente (não via HTTP) + upsert em palpites
   b. Resolve placeholders de dependentes
9. Grava sync_jogos_log
```

### 5.3 Resolução de placeholder (mata-mata)

Executada imediatamente após recálculo do jogo X:

```
1. SELECT jogos WHERE placeholder_casa ~ 'Vencedor Jogo X'
                   OR placeholder_fora ~ 'Vencedor Jogo X'
                   OR placeholder_casa ~ 'Perdedor Jogo X'
                   OR placeholder_fora ~ 'Perdedor Jogo X'

2. Determina winner/loser:
   gols_casa > gols_fora  → winner = selecao_casa_id, loser = selecao_fora_id
   gols_fora > gols_casa  → winner = selecao_fora_id, loser = selecao_casa_id
   igual + status PEN     → usa fixture.score.penalty.home/away da API
   igual + não-PEN        → warning, skip (admin resolve manual)

3. Só escreve se selecao_*_id IS NULL (não sobrescreve resolução manual)
4. Loga cada resolução em sync_jogos_log.erros (campo reutilizado como detalhes)
```

Casos que ficam para admin resolver manualmente:
- Placeholder com formato não reconhecido (ex: `"V QF3"`)
- Jogo referenciado ainda não finalizado
- Empate em 90min sem informação de pênaltis na API

---

## 6. Mapping inicial — `POST /api/admin/mapear-fixtures`

Rota one-time, idempotente (pode ser re-executada).

```
1. GET /fixtures?league=1&season=2026  (1 request)
2. Para cada fixture:
   GRUPO (teams conhecidos):
     Match por TEAM_NAME_MAP[fixture.teams.home.name] === jogo.selecao_casa.nome
             AND TEAM_NAME_MAP[fixture.teams.away.name] === jogo.selecao_fora.nome
   MATA-MATA (teams = "TBD"):
     Match por data_hora ≈ fixture.date ± 30min AND fase_mapped(fixture.league.round)
3. UPDATE jogos SET external_id = fixture.fixture.id
4. Retorna { mapeados: N, warnings: [{fixture_id, nosso_jogo_id?, motivo}] }
```

**Mapas estáticos em `lib/api-football.ts`:**

```ts
// 48 entradas — nomes API → nomes do banco
const TEAM_NAME_MAP: Record<string, string> = {
  'Brazil': 'Brasil', 'France': 'França', 'Germany': 'Alemanha',
  'Netherlands': 'Holanda', 'England': 'Inglaterra', ...
}

// Fases — strings da API → enum FaseJogo
const ROUND_FASE_MAP: Record<string, FaseJogo> = {
  'Group Stage': 'grupos',
  'Round of 32': '16avos',
  'Round of 16': 'oitavas',
  'Quarter-finals': 'quartas',
  'Semi-finals': 'semis',
  '3rd Place Final': 'disputa_terceiro',
  'Final': 'final',
}
```

> **Antes de implementar:** fazer 1 request manual a `/fixtures?league=1&season=2026` e validar strings reais de `teams.home.name` e `league.round`. Ajustar mapas conforme necessário.

**UI no `/admin/jogos`:** botão "Mapear fixtures" visível no `SyncStatus` enquanto jogos mapeados < 104. Clique abre modal com JSON de resultado (mapeados + warnings).

---

## 7. `lib/api-football.ts` — interface

```ts
export type ApiFixtureStatus =
  'NS' | 'LIVE' | '1H' | 'HT' | '2H' | 'ET' | 'BT' | 'P' |
  'FT' | 'AET' | 'PEN' | 'PST' | 'CANC' | 'ABD' | 'AWD' | 'WO'

export type ApiFixture = {
  fixture: { id: number; date: string; status: { short: ApiFixtureStatus } }
  teams: {
    home: { id: number; name: string }
    away: { id: number; name: string }
  }
  goals: { home: number | null; away: number | null }
  score: { penalty: { home: number | null; away: number | null } }
  league: { round: string }
}

// Busca fixtures específicos (usado no cron)
export async function fetchFixtures(externalIds: string[]): Promise<ApiFixture[]>

// Busca todos os fixtures da Copa (usado no mapping)
export async function fetchAllFixtures(league: number, season: number): Promise<ApiFixture[]>

// Parse de um fixture → o que o banco precisa saber
export type ParsedFixture = {
  externalId: string
  finalizado: boolean
  gols_casa: number | null
  gols_fora: number | null
  penaltyWinnerSide: 'home' | 'away' | null  // null se não-PEN
} | null  // null = status ignorável (NS, PST, CANC…)

export function parseFixture(fixture: ApiFixture): ParsedFixture
```

---

## 8. `lib/sync-jogos.ts` — interface

```ts
export type JogoBanco = {
  id: number
  external_id: string | null
  finalizado: boolean
  gols_casa: number | null
  gols_fora: number | null
  selecao_casa_id: number | null
  selecao_fora_id: number | null
  placeholder_casa: string | null
  placeholder_fora: string | null
  numero_jogo: number
}

export type JogoUpdate = {
  id: number
  gols_casa: number
  gols_fora: number
  finalizado: boolean
}

export type PlaceholderUpdate = {
  id: number  // jogo dependente
  selecao_casa_id?: number
  selecao_fora_id?: number
}

export type PlaceholderWarning = {
  jogo_id: number
  motivo: string
}

// Dado jogo do banco + parsed fixture → update ou null (nada a fazer)
export function calcularUpdateJogo(
  jogo: JogoBanco,
  parsed: ParsedFixture,
): JogoUpdate | null

// Dado jogo recém-finalizado + todos os jogos com placeholder → resoluções
export function calcularResolucoesPlaceholder(
  jogoFinalizado: JogoUpdate & { selecao_casa_id: number; selecao_fora_id: number; numero_jogo: number },
  jogosComPlaceholder: JogoBanco[],
  penaltyWinnerSide: 'home' | 'away' | null,
): { updates: PlaceholderUpdate[]; warnings: PlaceholderWarning[] }
```

---

## 9. `sync_jogos_log` — migration e RLS

```sql
-- supabase/migrations/20260504000002_sync_log.sql

CREATE TABLE public.sync_jogos_log (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciado_em             timestamptz NOT NULL DEFAULT now(),
  finalizado_em           timestamptz,
  fonte                   text        NOT NULL CHECK (fonte IN ('cron', 'manual')),
  jogos_verificados       int         NOT NULL DEFAULT 0,
  jogos_atualizados       int         NOT NULL DEFAULT 0,
  placeholders_resolvidos int         NOT NULL DEFAULT 0,
  erros                   jsonb       NOT NULL DEFAULT '[]',
  -- ex: [{"jogo_id": 45, "mensagem": "penalty winner indeterminado"}]
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
-- Writes exclusivos via service_role
```

**Status `parcial`:** pelo menos 1 jogo atualizado + pelo menos 1 erro. Admin vê warnings e usa botões F10 para reprocessar.

---

## 10. Segurança das rotas

| Rota | Guard |
|------|-------|
| `POST /api/cron/sync-jogos` | `Authorization: Bearer CRON_SECRET` — retorna 401 se falhar. Sem sessão de usuário. |
| `POST /api/admin/sync-jogos-manual` | `is_admin` via `createSupabaseServerClient` — padrão F9/F10 |
| `POST /api/admin/mapear-fixtures` | `is_admin` — idem |

Em dev: `curl -X POST http://localhost:3000/api/cron/sync-jogos -H "Authorization: Bearer $CRON_SECRET"`

---

## 11. `SyncStatus` — UI em `/admin/jogos`

Client Component incluído no header de `JogosClient`. Server Component pai passa `ultimoSync` como prop.

```
Última sync: há 43min — 2 jogos atualizados   [Sincronizar agora ↻]
                                               [Mapear fixtures ⚙]   ← só se mapeados < 104
```

- "Sincronizar agora" → POST `/api/admin/sync-jogos-manual` → spinner → toast `"Sync concluído — N jogos atualizados"`
- "Mapear fixtures" → POST `/api/admin/mapear-fixtures` → modal colapsável com JSON de resultado

---

## 12. `vercel.json` e env vars

```json
{
  "crons": [
    { "path": "/api/cron/sync-jogos", "schedule": "0 */2 * * *" }
  ]
}
```

`lib/env-server.ts` — schema Zod adiciona:
```ts
API_FOOTBALL_KEY: z.string().min(1),
CRON_SECRET: z.string().min(1),
```

`.env.local.example` adiciona:
```
API_FOOTBALL_KEY=
CRON_SECRET=
```

---

## 13. TDD — cobertura ≥ 95%

### `lib/__tests__/api-football.test.ts`

| Caso | Input | Esperado |
|------|-------|----------|
| FT normal | `{ status: 'FT', goals: { home: 2, away: 1 } }` | `{ finalizado: true, gols_casa: 2, gols_fora: 1, penaltyWinnerSide: null }` |
| AET | `{ status: 'AET', goals: { home: 1, away: 0 } }` | `{ finalizado: true, gols_casa: 1, gols_fora: 0, penaltyWinnerSide: null }` |
| PEN — home wins | `{ status: 'PEN', goals: { home: 1, away: 1 }, score: { penalty: { home: 4, away: 2 } } }` | `{ finalizado: true, gols_casa: 1, gols_fora: 1, penaltyWinnerSide: 'home' }` |
| PEN — away wins | `{ status: 'PEN', goals: { home: 0, away: 0 }, score: { penalty: { home: 3, away: 5 } } }` | `{ penaltyWinnerSide: 'away' }` |
| LIVE (2H) | `{ status: '2H', goals: { home: 0, away: 1 } }` | `{ finalizado: false, gols_casa: 0, gols_fora: 1 }` |
| HT | `{ status: 'HT', goals: { home: 1, away: 1 } }` | `{ finalizado: false, gols_casa: 1, gols_fora: 1 }` |
| NS | `{ status: 'NS', goals: { home: null, away: null } }` | `null` |
| PST (adiado) | `{ status: 'PST' }` | `null` |
| Goals null em LIVE | `{ status: '1H', goals: { home: null, away: null } }` | `{ gols_casa: null, gols_fora: null, finalizado: false }` |

### `lib/__tests__/sync-jogos.test.ts`

**`calcularUpdateJogo`:**

| Caso | Descrição | Esperado |
|------|-----------|----------|
| Nada a atualizar | jogo já finalizado no banco, API retorna FT com mesmo placar | `null` |
| Gols iguais ao banco | banco `2×1`, API retorna `2×1` LIVE | `null` |
| Atualização ao vivo | banco `0×0`, API retorna `1H` com `1×0` | update gols, `finalizado: false` |
| Finalização | banco `finalizado=false`, API retorna FT `2×1` | update gols + `finalizado: true` |
| Fixture null (NS) | `parseFixture` retornou `null` | `null` |
| Idempotência | roda 2× com mesma API response | mesmo resultado |

**`calcularResolucoesPlaceholder`:**

| Caso | Descrição | Esperado |
|------|-----------|----------|
| Vencedor home | jogo 45 encerra 2×1, dependente tem `placeholder_casa = "Vencedor Jogo 45"` | `selecao_casa_id = selecao_casa_id_do_45` |
| Vencedor away | jogo 45 encerra 0×1, dependente tem `placeholder_fora = "Vencedor Jogo 45"` | `selecao_fora_id = selecao_fora_id_do_45` |
| Perdedor (3º lugar) | jogo 47 encerra 1×3, dependente tem `placeholder_casa = "Perdedor Jogo 47"` | `selecao_casa_id = selecao_casa_id_do_47` |
| PEN, home vence | `penaltyWinnerSide='home'`, `placeholder_fora = "Vencedor Jogo 49"` | `selecao_fora_id = selecao_casa_id_do_49` |
| `selecao_*_id` já preenchido | admin resolveu antes | skip, sem update |
| Placeholder não reconhecido | `placeholder_casa = "V QF3"` | `warnings: [{ jogo_id, motivo }]`, sem update |
| Nenhum dependente | lista de jogos vazia | `{ updates: [], warnings: [] }` |
| Empate não-PEN | gols iguais, `penaltyWinnerSide=null` | `warnings: [{ motivo: "empate sem winner de pênaltis" }]` |

---

## 14. Dependências novas

- `vercel.json` (arquivo novo — sem npm deps adicionais)
- Nenhum pacote npm novo: fetch nativo (Node 18+), Zod e Supabase já instalados

---

## 15. Contrato com F13 (WhatsApp)

F13 pode subscrever em `sync_jogos_log` via Supabase Realtime para disparar notificações quando `jogos_atualizados > 0`. F12 não precisa saber de F13.
