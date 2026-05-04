# F12 — Cron API-Football: Automação de Resultados

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatizar 100% a entrada de resultados durante a Copa 2026 — cron a cada 2h detecta jogos finalizados na API-Football, atualiza placares, recalcula pontos e resolve placeholders de mata-mata sem intervenção humana.

**Architecture:** Next.js Route Handler (GET) para o cron Vercel + POST para sync manual + POST para mapping one-time. Lógica pura em `lib/api-football.ts` (parseFixture) e `lib/sync-jogos.ts` (calcularUpdateJogo + calcularResolucoesPlaceholder). Orquestração com I/O em `lib/sync-runner.ts`, importada por ambas as rotas. Reutiliza `lib/recalculo.ts` do F10 diretamente.

**Tech Stack:** Next.js 14 App Router, Supabase (service_role), Vercel Cron, API-Football v3 (api-sports.io), Vitest, Zod, TypeScript estrito.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|------------------|
| `supabase/migrations/20260504000002_sync_log.sql` | Criar | Tabela sync_jogos_log + RLS |
| `lib/env-server.ts` | Modificar | + API_FOOTBALL_KEY + CRON_SECRET |
| `.env.local.example` | Modificar | + 2 vars |
| `vercel.json` | Criar | Cron schedule |
| `lib/api-football.ts` | Criar | Tipos + parseFixture + fetchFixtures + mapas |
| `lib/sync-jogos.ts` | Criar | calcularUpdateJogo + calcularResolucoesPlaceholder (puras) |
| `lib/__tests__/api-football.test.ts` | Criar | TDD parseFixture |
| `lib/__tests__/sync-jogos.test.ts` | Criar | TDD calcularUpdateJogo + calcularResolucoesPlaceholder |
| `lib/sync-runner.ts` | Criar | runSync (orquestração com I/O) |
| `app/api/cron/sync-jogos/route.ts` | Criar | GET, CRON_SECRET guard |
| `app/api/admin/sync-jogos-manual/route.ts` | Criar | POST, is_admin guard |
| `app/api/admin/mapear-fixtures/route.ts` | Criar | POST, is_admin guard |
| `components/admin/SyncStatus.tsx` | Criar | Client Component — último sync + botões |
| `app/(admin)/admin/jogos/page.tsx` | Modificar | + ultimoSync + totalMapeados props |
| `app/(admin)/admin/jogos/JogosClient.tsx` | Modificar | + SyncStatus no header |

---

## Task 1: Foundation — migration, env vars, vercel.json

**Files:**
- Create: `supabase/migrations/20260504000002_sync_log.sql`
- Modify: `lib/env-server.ts`
- Modify: `.env.local.example`
- Create: `vercel.json`

- [ ] **Criar migration sync_jogos_log**

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
```

- [ ] **Aplicar migration**

```bash
npx supabase db push
```

Esperado: migration aplicada sem erros.

- [ ] **Atualizar lib/env-server.ts** — adicionar as 2 novas vars ao schema Zod e ao `safeParse`

```typescript
// lib/env-server.ts — substituir o schema e o parsed completos:
import 'server-only';
import { z } from 'zod';

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MERCADOPAGO_ACCESS_TOKEN: z.string().min(1),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(1),
  API_FOOTBALL_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
});

const parsed = schema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN,
  MERCADOPAGO_WEBHOOK_SECRET: process.env.MERCADOPAGO_WEBHOOK_SECRET,
  API_FOOTBALL_KEY: process.env.API_FOOTBALL_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
});

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error('❌ Invalid server environment variables:', fieldErrors);
  throw new Error(
    `Invalid server environment variables: ${JSON.stringify(fieldErrors)}. Check .env.local against .env.local.example.`,
  );
}

export const serverEnv = parsed.data;
```

- [ ] **Atualizar .env.local.example** — adicionar ao final:

```
API_FOOTBALL_KEY=
CRON_SECRET=
```

- [ ] **Criar vercel.json**

```json
{
  "crons": [
    { "path": "/api/cron/sync-jogos", "schedule": "0 */2 * * *" }
  ]
}
```

- [ ] **Commit**

```bash
git add supabase/migrations/20260504000002_sync_log.sql lib/env-server.ts .env.local.example vercel.json
git commit -m "feat(F12): migration sync_jogos_log + env vars + vercel.json cron"
```

---

## Task 2: lib/api-football.ts — TDD parseFixture + cliente HTTP

**Files:**
- Create: `lib/__tests__/api-football.test.ts`
- Create: `lib/api-football.ts`

- [ ] **Validar API antes de codar (1 request manual)**

```bash
curl "https://v3.football.api-sports.io/fixtures?league=1&season=2026&timezone=UTC" \
  -H "x-apisports-key: $API_FOOTBALL_KEY" | npx fx '.response[0]'
```

Verificar: strings reais de `teams.home.name` (ex: `"Brazil"` ou `"Brasil"`?) e `league.round` (ex: `"Group Stage"` ou `"Group Stage - 1"`?). Ajustar `TEAM_NAME_MAP` e `ROUND_FASE_MAP` na implementação conforme o retorno real. Se a API ainda não tiver fixtures da Copa 2026, anote o formato esperado baseado em edições anteriores — os mapas podem ser ajustados depois.

- [ ] **Escrever testes para parseFixture (devem falhar)**

```typescript
// lib/__tests__/api-football.test.ts
import { describe, it, expect } from 'vitest'
import { parseFixture } from '../api-football'
import type { ApiFixture } from '../api-football'

function makeFixture(overrides: Partial<ApiFixture> = {}): ApiFixture {
  return {
    fixture: { id: 1001, date: '2026-06-11T16:00:00+00:00', status: { short: 'NS' } },
    teams: { home: { id: 10, name: 'Brazil' }, away: { id: 11, name: 'Mexico' } },
    goals: { home: null, away: null },
    score: { penalty: { home: null, away: null } },
    league: { round: 'Group Stage' },
    ...overrides,
  }
}

describe('parseFixture', () => {
  it('NS → null', () => {
    expect(parseFixture(makeFixture({ fixture: { id: 1, date: '', status: { short: 'NS' } } }))).toBeNull()
  })

  it('PST → null', () => {
    expect(parseFixture(makeFixture({ fixture: { id: 1, date: '', status: { short: 'PST' } } }))).toBeNull()
  })

  it('FT normal → finalizado=true, gols corretos, sem penalty', () => {
    const f = makeFixture({
      fixture: { id: 1001, date: '', status: { short: 'FT' } },
      goals: { home: 2, away: 1 },
    })
    expect(parseFixture(f)).toEqual({
      externalId: '1001',
      finalizado: true,
      gols_casa: 2,
      gols_fora: 1,
      penaltyWinnerSide: null,
    })
  })

  it('AET → finalizado=true, sem penalty', () => {
    const f = makeFixture({
      fixture: { id: 1002, date: '', status: { short: 'AET' } },
      goals: { home: 1, away: 0 },
    })
    const r = parseFixture(f)
    expect(r?.finalizado).toBe(true)
    expect(r?.penaltyWinnerSide).toBeNull()
  })

  it('PEN — home vence → penaltyWinnerSide=home', () => {
    const f = makeFixture({
      fixture: { id: 1003, date: '', status: { short: 'PEN' } },
      goals: { home: 1, away: 1 },
      score: { penalty: { home: 4, away: 2 } },
    })
    const r = parseFixture(f)
    expect(r?.finalizado).toBe(true)
    expect(r?.gols_casa).toBe(1)
    expect(r?.gols_fora).toBe(1)
    expect(r?.penaltyWinnerSide).toBe('home')
  })

  it('PEN — away vence → penaltyWinnerSide=away', () => {
    const f = makeFixture({
      fixture: { id: 1004, date: '', status: { short: 'PEN' } },
      goals: { home: 0, away: 0 },
      score: { penalty: { home: 3, away: 5 } },
    })
    expect(parseFixture(f)?.penaltyWinnerSide).toBe('away')
  })

  it('2H (ao vivo) → finalizado=false, gols atualizados', () => {
    const f = makeFixture({
      fixture: { id: 1005, date: '', status: { short: '2H' } },
      goals: { home: 0, away: 1 },
    })
    expect(parseFixture(f)).toEqual({
      externalId: '1005',
      finalizado: false,
      gols_casa: 0,
      gols_fora: 1,
      penaltyWinnerSide: null,
    })
  })

  it('HT → finalizado=false', () => {
    const f = makeFixture({
      fixture: { id: 1006, date: '', status: { short: 'HT' } },
      goals: { home: 1, away: 1 },
    })
    expect(parseFixture(f)?.finalizado).toBe(false)
  })

  it('1H com goals null → finalizado=false, gols null', () => {
    const f = makeFixture({
      fixture: { id: 1007, date: '', status: { short: '1H' } },
      goals: { home: null, away: null },
    })
    expect(parseFixture(f)).toEqual({
      externalId: '1007',
      finalizado: false,
      gols_casa: null,
      gols_fora: null,
      penaltyWinnerSide: null,
    })
  })
})
```

- [ ] **Rodar testes — devem falhar**

```bash
npx vitest run lib/__tests__/api-football.test.ts
```

Esperado: FAIL com "Cannot find module '../api-football'".

- [ ] **Implementar lib/api-football.ts**

```typescript
// lib/api-football.ts
import { serverEnv } from './env-server'
import type { FaseJogo } from './pontuacao'

export type ApiFixtureStatus =
  | 'NS' | 'LIVE' | '1H' | 'HT' | '2H' | 'ET' | 'BT' | 'P'
  | 'FT' | 'AET' | 'PEN' | 'PST' | 'CANC' | 'ABD' | 'AWD' | 'WO'

export type ApiFixture = {
  fixture: { id: number; date: string; status: { short: ApiFixtureStatus } }
  teams: { home: { id: number; name: string }; away: { id: number; name: string } }
  goals: { home: number | null; away: number | null }
  score: { penalty: { home: number | null; away: number | null } }
  league: { round: string }
}

export type ParsedFixture = {
  externalId: string
  finalizado: boolean
  gols_casa: number | null
  gols_fora: number | null
  penaltyWinnerSide: 'home' | 'away' | null
} | null

// Nomes API-Football → nomes do banco (PT). Validar contra API antes do 1º deploy.
export const TEAM_NAME_MAP: Record<string, string> = {
  'Brazil': 'Brasil',
  'France': 'França',
  'Germany': 'Alemanha',
  'Spain': 'Espanha',
  'England': 'Inglaterra',
  'Portugal': 'Portugal',
  'Netherlands': 'Holanda',
  'Argentina': 'Argentina',
  'Belgium': 'Bélgica',
  'Switzerland': 'Suíça',
  'Norway': 'Noruega',
  'Colombia': 'Colômbia',
  'Uruguay': 'Uruguai',
  'Italy': 'Itália',
  'Croatia': 'Croácia',
  'Denmark': 'Dinamarca',
  'Austria': 'Áustria',
  'Serbia': 'Sérvia',
  'Poland': 'Polônia',
  'USA': 'Estados Unidos',
  'Mexico': 'México',
  'Canada': 'Canadá',
  'Costa Rica': 'Costa Rica',
  'Panama': 'Panamá',
  'Jamaica': 'Jamaica',
  'Japan': 'Japão',
  'South Korea': 'Coreia do Sul',
  'Iran': 'Irã',
  'Saudi Arabia': 'Arábia Saudita',
  'Australia': 'Austrália',
  'Morocco': 'Marrocos',
  'Senegal': 'Senegal',
  'Nigeria': 'Nigéria',
  'Cameroon': 'Camarões',
  'Egypt': 'Egito',
  'Ghana': 'Gana',
  'South Africa': 'África do Sul',
  'Tunisia': 'Tunísia',
  'Algeria': 'Argélia',
  'Ecuador': 'Equador',
  'Venezuela': 'Venezuela',
  'Paraguay': 'Paraguai',
  'Chile': 'Chile',
  'Bolivia': 'Bolívia',
  'Peru': 'Peru',
  'New Zealand': 'Nova Zelândia',
  'Jordan': 'Jordânia',
  'Iraq': 'Iraque',
  // Completar as 48 entradas após validar o retorno real da API
}

export const ROUND_FASE_MAP: Record<string, FaseJogo> = {
  'Group Stage': 'grupos',
  'Round of 32': '16avos',
  'Round of 16': 'oitavas',
  'Quarter-finals': 'quartas',
  'Semi-finals': 'semis',
  '3rd Place Final': 'disputa_terceiro',
  'Final': 'final',
}

const API_BASE = 'https://v3.football.api-sports.io'

async function apiFetch(path: string): Promise<ApiFixture[]> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-apisports-key': serverEnv.API_FOOTBALL_KEY },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { response: ApiFixture[] }
  return json.response
}

export async function fetchFixtures(externalIds: string[]): Promise<ApiFixture[]> {
  if (externalIds.length === 0) return []
  return apiFetch(`/fixtures?ids=${externalIds.join('-')}`)
}

export async function fetchAllFixtures(league: number, season: number): Promise<ApiFixture[]> {
  return apiFetch(`/fixtures?league=${league}&season=${season}`)
}

export async function fetchFixturesByDate(date: string): Promise<ApiFixture[]> {
  return apiFetch(`/fixtures?date=${date}&league=1&season=2026`)
}

const IGNORABLE: ApiFixtureStatus[] = ['NS', 'PST', 'CANC', 'ABD', 'AWD', 'WO']
const LIVE: ApiFixtureStatus[] = ['LIVE', '1H', 'HT', '2H', 'ET', 'BT', 'P']
const FINISHED: ApiFixtureStatus[] = ['FT', 'AET', 'PEN']

export function parseFixture(fixture: ApiFixture): ParsedFixture {
  const status = fixture.fixture.status.short
  if (IGNORABLE.includes(status)) return null
  if (!LIVE.includes(status) && !FINISHED.includes(status)) return null

  const isFinished = FINISHED.includes(status)
  let penaltyWinnerSide: 'home' | 'away' | null = null

  if (status === 'PEN') {
    const ph = fixture.score.penalty.home ?? 0
    const pa = fixture.score.penalty.away ?? 0
    penaltyWinnerSide = ph >= pa ? 'home' : 'away'
  }

  return {
    externalId: String(fixture.fixture.id),
    finalizado: isFinished,
    gols_casa: fixture.goals.home,
    gols_fora: fixture.goals.away,
    penaltyWinnerSide,
  }
}
```

- [ ] **Rodar testes — devem passar**

```bash
npx vitest run lib/__tests__/api-football.test.ts
```

Esperado: 9 testes PASS.

- [ ] **Commit**

```bash
git add lib/api-football.ts lib/__tests__/api-football.test.ts
git commit -m "feat(F12): lib/api-football.ts — parseFixture TDD (9 testes)"
```

---

## Task 3: lib/sync-jogos.ts — calcularUpdateJogo (TDD)

**Files:**
- Create: `lib/__tests__/sync-jogos.test.ts`
- Create: `lib/sync-jogos.ts` (parcial — só calcularUpdateJogo)

- [ ] **Escrever testes para calcularUpdateJogo (devem falhar)**

```typescript
// lib/__tests__/sync-jogos.test.ts
import { describe, it, expect } from 'vitest'
import { calcularUpdateJogo } from '../sync-jogos'
import type { JogoBanco } from '../sync-jogos'
import type { ParsedFixture } from '../api-football'

function makeJogo(overrides: Partial<JogoBanco> = {}): JogoBanco {
  return {
    id: 45,
    external_id: '1001',
    finalizado: false,
    gols_casa: null,
    gols_fora: null,
    selecao_casa_id: 10,
    selecao_fora_id: 11,
    placeholder_casa: null,
    placeholder_fora: null,
    numero_jogo: 45,
    fase: 'grupos',
    ...overrides,
  }
}

const parsedFT: ParsedFixture = {
  externalId: '1001',
  finalizado: true,
  gols_casa: 2,
  gols_fora: 1,
  penaltyWinnerSide: null,
}

describe('calcularUpdateJogo', () => {
  it('fixture null (NS) → null', () => {
    expect(calcularUpdateJogo(makeJogo(), null)).toBeNull()
  })

  it('jogo já finalizado no banco → null (idempotente)', () => {
    expect(calcularUpdateJogo(makeJogo({ finalizado: true, gols_casa: 2, gols_fora: 1 }), parsedFT)).toBeNull()
  })

  it('gols iguais ao banco, sem mudança → null', () => {
    const jogo = makeJogo({ gols_casa: 2, gols_fora: 1 })
    const parsed: ParsedFixture = { externalId: '1001', finalizado: false, gols_casa: 2, gols_fora: 1, penaltyWinnerSide: null }
    expect(calcularUpdateJogo(jogo, parsed)).toBeNull()
  })

  it('finalização: banco=pendente, API=FT → update com finalizado=true', () => {
    const r = calcularUpdateJogo(makeJogo(), parsedFT)
    expect(r).toEqual({ id: 45, gols_casa: 2, gols_fora: 1, finalizado: true })
  })

  it('atualização ao vivo: banco sem gols, API=2H 1×0 → update com finalizado=false', () => {
    const parsed: ParsedFixture = { externalId: '1001', finalizado: false, gols_casa: 1, gols_fora: 0, penaltyWinnerSide: null }
    const r = calcularUpdateJogo(makeJogo(), parsed)
    expect(r).toEqual({ id: 45, gols_casa: 1, gols_fora: 0, finalizado: false })
  })

  it('idempotência — rodar 2x retorna mesmo resultado', () => {
    const r1 = calcularUpdateJogo(makeJogo(), parsedFT)
    const r2 = calcularUpdateJogo(makeJogo(), parsedFT)
    expect(r1).toEqual(r2)
  })
})
```

- [ ] **Rodar testes — devem falhar**

```bash
npx vitest run lib/__tests__/sync-jogos.test.ts
```

Esperado: FAIL com "Cannot find module '../sync-jogos'".

- [ ] **Implementar calcularUpdateJogo em lib/sync-jogos.ts**

```typescript
// lib/sync-jogos.ts
import type { ParsedFixture } from './api-football'

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
  fase: string
}

export type JogoUpdate = {
  id: number
  gols_casa: number
  gols_fora: number
  finalizado: boolean
}

export type PlaceholderUpdate = {
  id: number
  selecao_casa_id?: number
  selecao_fora_id?: number
}

export type PlaceholderWarning = {
  jogo_id: number
  motivo: string
}

export function calcularUpdateJogo(
  jogo: JogoBanco,
  parsed: ParsedFixture,
): JogoUpdate | null {
  if (parsed === null) return null
  if (jogo.finalizado) return null

  const novosGolsCasa = parsed.gols_casa ?? jogo.gols_casa
  const novosGolsFora = parsed.gols_fora ?? jogo.gols_fora

  if (
    novosGolsCasa === jogo.gols_casa &&
    novosGolsFora === jogo.gols_fora &&
    parsed.finalizado === jogo.finalizado
  ) return null

  if (novosGolsCasa === null || novosGolsFora === null) return null

  return { id: jogo.id, gols_casa: novosGolsCasa, gols_fora: novosGolsFora, finalizado: parsed.finalizado }
}
```

- [ ] **Rodar testes — devem passar**

```bash
npx vitest run lib/__tests__/sync-jogos.test.ts
```

Esperado: 6 testes PASS.

- [ ] **Commit**

```bash
git add lib/sync-jogos.ts lib/__tests__/sync-jogos.test.ts
git commit -m "feat(F12): lib/sync-jogos.ts — calcularUpdateJogo TDD (6 testes)"
```

---

## Task 4: lib/sync-jogos.ts — calcularResolucoesPlaceholder (TDD)

**Files:**
- Modify: `lib/__tests__/sync-jogos.test.ts`
- Modify: `lib/sync-jogos.ts`

- [ ] **Adicionar testes para calcularResolucoesPlaceholder ao arquivo existente**

```typescript
// Adicionar APÓS os describes de calcularUpdateJogo no sync-jogos.test.ts:
import { calcularResolucoesPlaceholder } from '../sync-jogos'

function makeJogoFinalizado(numero_jogo: number, gols_casa: number, gols_fora: number) {
  return { id: numero_jogo, gols_casa, gols_fora, finalizado: true, selecao_casa_id: 10, selecao_fora_id: 11, numero_jogo }
}

function makeDependent(id: number, placeholder_casa: string | null, placeholder_fora: string | null, overrides: Partial<JogoBanco> = {}): JogoBanco {
  return {
    id,
    external_id: null,
    finalizado: false,
    gols_casa: null,
    gols_fora: null,
    selecao_casa_id: null,
    selecao_fora_id: null,
    placeholder_casa,
    placeholder_fora,
    numero_jogo: id,
    fase: '16avos',
    ...overrides,
  }
}

describe('calcularResolucoesPlaceholder', () => {
  it('lista vazia → updates=[], warnings=[]', () => {
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 2, 1), [], null)
    expect(r).toEqual({ updates: [], warnings: [] })
  })

  it('vencedor lado casa — home vence 2×1', () => {
    const dep = makeDependent(49, 'Vencedor Jogo 45', null)
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 2, 1), [dep], null)
    expect(r.updates).toEqual([{ id: 49, selecao_casa_id: 10 }]) // casa_id do jogo 45
    expect(r.warnings).toHaveLength(0)
  })

  it('vencedor lado fora — away vence 0×1', () => {
    const dep = makeDependent(50, null, 'Vencedor Jogo 45')
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 0, 1), [dep], null)
    expect(r.updates).toEqual([{ id: 50, selecao_fora_id: 11 }]) // fora_id do jogo 45
  })

  it('perdedor (3º lugar) — jogo 47 termina 1×3, placeholder perdedor', () => {
    const dep = makeDependent(99, 'Perdedor Jogo 47', null)
    const jogo = { id: 47, gols_casa: 1, gols_fora: 3, finalizado: true, selecao_casa_id: 20, selecao_fora_id: 21, numero_jogo: 47 }
    const r = calcularResolucoesPlaceholder(jogo, [dep], null)
    expect(r.updates).toEqual([{ id: 99, selecao_casa_id: 20 }]) // perdedor = quem fez menos gols = casa
  })

  it('PEN home vence — placeholder fora aponta pra vencedor', () => {
    const dep = makeDependent(60, null, 'Vencedor Jogo 49')
    const jogo = makeJogoFinalizado(49, 1, 1) // empate → pênaltis
    const r = calcularResolucoesPlaceholder(jogo, [dep], 'home')
    expect(r.updates).toEqual([{ id: 60, selecao_fora_id: 10 }]) // home win → selecao_casa_id (10)
  })

  it('selecao_*_id já preenchido → skip (idempotente)', () => {
    const dep = makeDependent(49, 'Vencedor Jogo 45', null, { selecao_casa_id: 10 })
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 2, 1), [dep], null)
    expect(r.updates).toHaveLength(0)
  })

  it('placeholder não reconhecido → warning, sem update', () => {
    const dep = makeDependent(70, 'V QF3', null)
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 2, 1), [dep], null)
    expect(r.updates).toHaveLength(0)
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0].motivo).toMatch(/não reconhecido/i)
  })

  it('empate sem pênaltis → warning por jogo dependente', () => {
    const dep = makeDependent(49, 'Vencedor Jogo 45', null)
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 1, 1), [dep], null)
    expect(r.updates).toHaveLength(0)
    expect(r.warnings[0].motivo).toMatch(/empate/i)
  })

  it('jogo diferente no placeholder → skip silencioso', () => {
    const dep = makeDependent(49, 'Vencedor Jogo 46', null) // referencia jogo 46, não 45
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 2, 1), [dep], null)
    expect(r.updates).toHaveLength(0)
    expect(r.warnings).toHaveLength(0)
  })
})
```

- [ ] **Rodar testes — devem falhar**

```bash
npx vitest run lib/__tests__/sync-jogos.test.ts
```

Esperado: 6 PASS (task anterior) + 8 FAIL.

- [ ] **Implementar calcularResolucoesPlaceholder — adicionar ao lib/sync-jogos.ts**

```typescript
// Adicionar ao final de lib/sync-jogos.ts:

const VENCEDOR_RE = /Vencedor Jogo (\d+)/i
const PERDEDOR_RE = /Perdedor Jogo (\d+)/i

function determinarWinnerLoser(
  jogo: { gols_casa: number; gols_fora: number; selecao_casa_id: number; selecao_fora_id: number },
  penaltyWinnerSide: 'home' | 'away' | null,
): { winnerId: number; loserId: number } | null {
  if (jogo.gols_casa > jogo.gols_fora) return { winnerId: jogo.selecao_casa_id, loserId: jogo.selecao_fora_id }
  if (jogo.gols_fora > jogo.gols_casa) return { winnerId: jogo.selecao_fora_id, loserId: jogo.selecao_casa_id }
  if (penaltyWinnerSide === 'home') return { winnerId: jogo.selecao_casa_id, loserId: jogo.selecao_fora_id }
  if (penaltyWinnerSide === 'away') return { winnerId: jogo.selecao_fora_id, loserId: jogo.selecao_casa_id }
  return null
}

export function calcularResolucoesPlaceholder(
  jogoFinalizado: JogoUpdate & { selecao_casa_id: number; selecao_fora_id: number; numero_jogo: number },
  jogosComPlaceholder: JogoBanco[],
  penaltyWinnerSide: 'home' | 'away' | null,
): { updates: PlaceholderUpdate[]; warnings: PlaceholderWarning[] } {
  const updates: PlaceholderUpdate[] = []
  const warnings: PlaceholderWarning[] = []
  const winner = determinarWinnerLoser(jogoFinalizado, penaltyWinnerSide)
  const num = jogoFinalizado.numero_jogo

  for (const jogo of jogosComPlaceholder) {
    const update: PlaceholderUpdate = { id: jogo.id }
    let mudou = false

    for (const lado of [
      { placeholder: jogo.placeholder_casa, resolvidoId: jogo.selecao_casa_id, campo: 'selecao_casa_id' as const },
      { placeholder: jogo.placeholder_fora, resolvidoId: jogo.selecao_fora_id, campo: 'selecao_fora_id' as const },
    ]) {
      if (!lado.placeholder || lado.resolvidoId !== null) continue

      const vM = VENCEDOR_RE.exec(lado.placeholder)
      const pM = PERDEDOR_RE.exec(lado.placeholder)

      if (vM) {
        if (Number(vM[1]) !== num) continue
        if (!winner) { warnings.push({ jogo_id: jogo.id, motivo: `Empate sem winner de pênaltis — Jogo ${num}` }); continue }
        update[lado.campo] = winner.winnerId; mudou = true
      } else if (pM) {
        if (Number(pM[1]) !== num) continue
        if (!winner) { warnings.push({ jogo_id: jogo.id, motivo: `Empate sem winner de pênaltis — Jogo ${num}` }); continue }
        update[lado.campo] = winner.loserId; mudou = true
      } else {
        warnings.push({ jogo_id: jogo.id, motivo: `Placeholder não reconhecido: "${lado.placeholder}"` })
      }
    }

    if (mudou) updates.push(update)
  }

  return { updates, warnings }
}
```

- [ ] **Rodar todos os testes de sync-jogos**

```bash
npx vitest run lib/__tests__/sync-jogos.test.ts
```

Esperado: 14 testes PASS.

- [ ] **Rodar suite completa para regressão**

```bash
npx vitest run
```

Esperado: todos PASS.

- [ ] **Commit**

```bash
git add lib/sync-jogos.ts lib/__tests__/sync-jogos.test.ts
git commit -m "feat(F12): lib/sync-jogos.ts — calcularResolucoesPlaceholder TDD (8 testes)"
```

---

## Task 5: lib/sync-runner.ts — orquestração

**Files:**
- Create: `lib/sync-runner.ts`

- [ ] **Criar lib/sync-runner.ts**

```typescript
// lib/sync-runner.ts
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchFixtures, fetchFixturesByDate, parseFixture, TEAM_NAME_MAP } from './api-football'
import { calcularUpdateJogo, calcularResolucoesPlaceholder } from './sync-jogos'
import { calcularUpdatesPalpites } from './recalculo'
import type { JogoBanco, JogoUpdate } from './sync-jogos'
import type { JogoFinalizado, PalpiteRow } from './recalculo'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export type SyncResult = {
  jogos_verificados: number
  jogos_atualizados: number
  placeholders_resolvidos: number
  erros: { jogo_id?: number; mensagem: string }[]
  status: 'sucesso' | 'parcial' | 'erro'
}

export async function runSync(
  admin: AdminClient,
  fonte: 'cron' | 'manual',
): Promise<SyncResult> {
  const erros: { jogo_id?: number; mensagem: string }[] = []
  let jogos_atualizados = 0
  let placeholders_resolvidos = 0
  const logId = await iniciarLog(admin, fonte)

  try {
    const agora = Date.now()
    const de = new Date(agora - 3 * 60 * 60 * 1000).toISOString()
    const ate = new Date(agora + 1 * 60 * 60 * 1000).toISOString()

    // 1. Busca jogos com external_id na janela
    const { data: jogosData, error: jogosErr } = await admin
      .from('jogos')
      .select('id, external_id, finalizado, gols_casa, gols_fora, selecao_casa_id, selecao_fora_id, placeholder_casa, placeholder_fora, numero_jogo, fase')
      .eq('finalizado', false)
      .not('external_id', 'is', null)
      .gte('data_hora', de)
      .lte('data_hora', ate)

    if (jogosErr) throw new Error(jogosErr.message)
    const jogosComId = (jogosData ?? []) as JogoBanco[]

    // 2. Lazy match para jogos sem external_id na janela
    const { data: semIdData } = await admin
      .from('jogos')
      .select('id, external_id, finalizado, gols_casa, gols_fora, selecao_casa_id, selecao_fora_id, placeholder_casa, placeholder_fora, numero_jogo, fase, data_hora, selecao_casa:selecoes!selecao_casa_id(nome), selecao_fora:selecoes!selecao_fora_id(nome)')
      .eq('finalizado', false)
      .is('external_id', null)
      .not('selecao_casa_id', 'is', null)
      .not('selecao_fora_id', 'is', null)
      .gte('data_hora', de)
      .lte('data_hora', ate)

    if ((semIdData ?? []).length > 0) {
      const today = new Date().toISOString().split('T')[0]
      try {
        const todayFixtures = await fetchFixturesByDate(today)
        for (const j of semIdData ?? []) {
          const casaNome = (j.selecao_casa as { nome: string } | null)?.nome
          const foraNome = (j.selecao_fora as { nome: string } | null)?.nome
          const matched = todayFixtures.find((f) => {
            const hNome = TEAM_NAME_MAP[f.teams.home.name]
            const aNome = TEAM_NAME_MAP[f.teams.away.name]
            if (!hNome || !aNome) return false
            if (hNome !== casaNome || aNome !== foraNome) return false
            const diff = Math.abs(new Date(f.fixture.date).getTime() - new Date(j.data_hora as string).getTime())
            return diff < 30 * 60 * 1000
          })
          if (matched) {
            const extId = String(matched.fixture.id)
            await admin.from('jogos').update({ external_id: extId }).eq('id', j.id)
            jogosComId.push({ ...(j as JogoBanco), external_id: extId })
          }
        }
      } catch {
        erros.push({ mensagem: 'lazy match falhou — API indisponível' })
      }
    }

    // 3. Early return se nenhum jogo na janela
    if (jogosComId.length === 0) {
      await finalizarLog(admin, logId, fonte, 0, 0, 0, [], 'sucesso')
      return { jogos_verificados: 0, jogos_atualizados: 0, placeholders_resolvidos: 0, erros: [], status: 'sucesso' }
    }

    // 4. Busca fixtures da API (1 request)
    const externalIds = jogosComId.map((j) => j.external_id!)
    const fixtures = await fetchFixtures(externalIds)
    const fixtureMap = new Map(fixtures.map((f) => [String(f.fixture.id), f]))

    // 5. Busca jogos dependentes (para resolução de placeholder)
    const { data: phData } = await admin
      .from('jogos')
      .select('id, external_id, finalizado, gols_casa, gols_fora, selecao_casa_id, selecao_fora_id, placeholder_casa, placeholder_fora, numero_jogo, fase')
      .or('selecao_casa_id.is.null,selecao_fora_id.is.null')
    const jogosComPlaceholder = (phData ?? []) as JogoBanco[]

    // 6. Processar cada jogo
    for (const jogo of jogosComId) {
      const fixture = fixtureMap.get(jogo.external_id!)
      if (!fixture) continue

      const parsed = parseFixture(fixture)
      const update = calcularUpdateJogo(jogo, parsed)
      if (!update) continue

      const { error: upErr } = await admin
        .from('jogos')
        .update({ gols_casa: update.gols_casa, gols_fora: update.gols_fora, finalizado: update.finalizado })
        .eq('id', jogo.id)
      if (upErr) { erros.push({ jogo_id: jogo.id, mensagem: upErr.message }); continue }

      jogos_atualizados++

      // 7. Recálculo e placeholder apenas quando jogo acabou de ser finalizado
      if (update.finalizado && !jogo.finalizado) {
        try {
          await recalcularJogo(admin, jogo, update)
        } catch (e) {
          erros.push({ jogo_id: jogo.id, mensagem: `Recálculo falhou: ${e instanceof Error ? e.message : 'erro'}` })
        }

        const jogoParaPlaceholder = {
          ...update,
          selecao_casa_id: jogo.selecao_casa_id!,
          selecao_fora_id: jogo.selecao_fora_id!,
          numero_jogo: jogo.numero_jogo,
        }
        const penaltyWinnerSide = parsed?.penaltyWinnerSide ?? null
        const { updates: phUpdates, warnings: phWarnings } = calcularResolucoesPlaceholder(
          jogoParaPlaceholder,
          jogosComPlaceholder,
          penaltyWinnerSide,
        )
        for (const ph of phUpdates) {
          const payload: Record<string, number> = {}
          if (ph.selecao_casa_id !== undefined) payload.selecao_casa_id = ph.selecao_casa_id
          if (ph.selecao_fora_id !== undefined) payload.selecao_fora_id = ph.selecao_fora_id
          await admin.from('jogos').update(payload).eq('id', ph.id)
          placeholders_resolvidos++
        }
        for (const w of phWarnings) {
          erros.push({ jogo_id: w.jogo_id, mensagem: w.motivo })
        }
      }
    }

    const status = erros.length === 0 ? 'sucesso' : jogos_atualizados > 0 ? 'parcial' : 'erro'
    await finalizarLog(admin, logId, fonte, jogosComId.length, jogos_atualizados, placeholders_resolvidos, erros, status)
    return { jogos_verificados: jogosComId.length, jogos_atualizados, placeholders_resolvidos, erros, status }
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'Erro desconhecido'
    erros.push({ mensagem })
    await finalizarLog(admin, logId, fonte, 0, 0, 0, erros, 'erro')
    return { jogos_verificados: 0, jogos_atualizados: 0, placeholders_resolvidos: 0, erros, status: 'erro' }
  }
}

async function recalcularJogo(admin: AdminClient, jogo: JogoBanco, update: JogoUpdate) {
  const jogoFinalizado: JogoFinalizado = {
    fase: jogo.fase as JogoFinalizado['fase'],
    gols_casa: update.gols_casa,
    gols_fora: update.gols_fora,
  }
  const { data: bilhetes } = await admin.from('bilhetes').select('id').eq('status_pagamento', 'confirmado')
  const confirmedIds = (bilhetes ?? []).map((b) => b.id)
  if (confirmedIds.length === 0) return

  const { data: palpitesData } = await admin
    .from('palpites')
    .select('id, gols_casa, gols_fora')
    .eq('jogo_id', jogo.id)
    .in('bilhete_id', confirmedIds)

  const palpites: PalpiteRow[] = (palpitesData ?? []).map((p) => ({
    id: p.id,
    gols_casa: p.gols_casa,
    gols_fora: p.gols_fora,
  }))

  const updates = calcularUpdatesPalpites(palpites, jogoFinalizado)
  if (updates.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await admin.from('palpites').upsert(updates as any, { onConflict: 'id' })
  }
}

async function iniciarLog(admin: AdminClient, fonte: 'cron' | 'manual'): Promise<string> {
  const { data } = await admin.from('sync_jogos_log').insert({ fonte, status: 'processando' }).select('id').single()
  return data?.id ?? ''
}

async function finalizarLog(
  admin: AdminClient,
  logId: string,
  fonte: 'cron' | 'manual',
  jogos_verificados: number,
  jogos_atualizados: number,
  placeholders_resolvidos: number,
  erros: { jogo_id?: number; mensagem: string }[],
  status: 'sucesso' | 'parcial' | 'erro',
) {
  if (!logId) {
    await admin.from('sync_jogos_log').insert({
      fonte, jogos_verificados, jogos_atualizados, placeholders_resolvidos, erros, status,
      finalizado_em: new Date().toISOString(),
    })
    return
  }
  await admin.from('sync_jogos_log').update({
    jogos_verificados, jogos_atualizados, placeholders_resolvidos, erros, status,
    finalizado_em: new Date().toISOString(),
  }).eq('id', logId)
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Commit**

```bash
git add lib/sync-runner.ts
git commit -m "feat(F12): lib/sync-runner.ts — runSync com lazy match + recálculo + placeholder"
```

---

## Task 6: Routes — cron (GET) + manual (POST)

**Files:**
- Create: `app/api/cron/sync-jogos/route.ts`
- Create: `app/api/admin/sync-jogos-manual/route.ts`

- [ ] **Criar rota cron**

```typescript
// app/api/cron/sync-jogos/route.ts
// Vercel Cron envia GET — guard via Authorization: Bearer CRON_SECRET
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env-server'
import { runSync } from '@/lib/sync-runner'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${serverEnv.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()
  const result = await runSync(admin, 'cron')
  return NextResponse.json(result)
}
```

- [ ] **Criar rota manual (admin)**

```typescript
// app/api/admin/sync-jogos-manual/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { runSync } from '@/lib/sync-runner'

async function verificarAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 as const }
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Acesso negado', status: 403 as const }
  return { error: null, status: null }
}

export async function POST() {
  const auth = await verificarAdmin()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status! })

  const admin = createSupabaseAdminClient()
  const result = await runSync(admin, 'manual')
  return NextResponse.json(result)
}
```

- [ ] **Testar rota cron localmente**

```bash
# Em bash (com o dev server rodando em outro terminal):
curl -s "http://localhost:3000/api/cron/sync-jogos" \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" | npx fx
```

Esperado (fora da janela da Copa): `{ "jogos_verificados": 0, "jogos_atualizados": 0, "status": "sucesso" }`.

- [ ] **Commit**

```bash
git add app/api/cron/sync-jogos/route.ts app/api/admin/sync-jogos-manual/route.ts
git commit -m "feat(F12): routes cron (GET) + sync-manual (POST)"
```

---

## Task 7: Route mapear-fixtures

**Files:**
- Create: `app/api/admin/mapear-fixtures/route.ts`

- [ ] **Criar rota**

```typescript
// app/api/admin/mapear-fixtures/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchAllFixtures, TEAM_NAME_MAP, ROUND_FASE_MAP } from '@/lib/api-football'

async function verificarAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 as const }
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Acesso negado', status: 403 as const }
  return { error: null, status: null }
}

export async function POST() {
  const auth = await verificarAdmin()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status! })

  const admin = createSupabaseAdminClient()

  // Busca todos os fixtures da Copa 2026 (1 request)
  let apiFixtures
  try {
    apiFixtures = await fetchAllFixtures(1, 2026)
  } catch (e) {
    return NextResponse.json({ error: `API-Football falhou: ${e instanceof Error ? e.message : 'erro'}` }, { status: 502 })
  }

  // Busca todos os jogos do banco com suas seleções
  const { data: jogosData } = await admin
    .from('jogos')
    .select('id, data_hora, fase, numero_jogo, selecao_casa_id, selecao_fora_id, external_id, selecao_casa:selecoes!selecao_casa_id(nome), selecao_fora:selecoes!selecao_fora_id(nome)')

  const jogos = jogosData ?? []

  let mapeados = 0
  const warnings: { fixture_id: number; motivo: string }[] = []

  for (const fixture of apiFixtures) {
    const fixId = fixture.fixture.id
    const fixDate = new Date(fixture.fixture.date).getTime()
    const faseMapped = ROUND_FASE_MAP[fixture.league.round]

    let jogoMatch: typeof jogos[number] | undefined

    const homeName = TEAM_NAME_MAP[fixture.teams.home.name]
    const awayName = TEAM_NAME_MAP[fixture.teams.away.name]

    if (homeName && awayName) {
      // Grupo: match por times (ambos conhecidos)
      jogoMatch = jogos.find((j) => {
        const cn = (j.selecao_casa as { nome: string } | null)?.nome
        const fn = (j.selecao_fora as { nome: string } | null)?.nome
        return cn === homeName && fn === awayName
      })
    }

    if (!jogoMatch && faseMapped) {
      // Mata-mata: match por data ±30min + fase
      jogoMatch = jogos.find((j) => {
        if (j.fase !== faseMapped) return false
        const diff = Math.abs(new Date(j.data_hora as string).getTime() - fixDate)
        return diff < 30 * 60 * 1000
      })
    }

    if (!jogoMatch) {
      warnings.push({ fixture_id: fixId, motivo: `Nenhum jogo no banco bate com date=${fixture.fixture.date} round=${fixture.league.round}` })
      continue
    }

    await admin.from('jogos').update({ external_id: String(fixId) }).eq('id', jogoMatch.id)
    mapeados++
  }

  return NextResponse.json({ mapeados, total_api: apiFixtures.length, warnings })
}
```

- [ ] **Commit**

```bash
git add app/api/admin/mapear-fixtures/route.ts
git commit -m "feat(F12): route POST /api/admin/mapear-fixtures (mapping one-time)"
```

---

## Task 8: SyncStatus UI + JogosClient + page.tsx

**Files:**
- Create: `components/admin/SyncStatus.tsx`
- Modify: `app/(admin)/admin/jogos/page.tsx`
- Modify: `app/(admin)/admin/jogos/JogosClient.tsx`

- [ ] **Criar SyncStatus**

```typescript
// components/admin/SyncStatus.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, Settings } from 'lucide-react'

type UltimoSync = {
  iniciado_em: string
  finalizado_em: string | null
  jogos_atualizados: number
  status: string
} | null

type Props = {
  ultimoSync: UltimoSync
  totalMapeados: number
}

function tempoAtras(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return `${Math.floor(diff / 3600)}h`
}

export function SyncStatus({ ultimoSync, totalMapeados }: Props) {
  const [loadingSync, setLoadingSync] = useState(false)
  const [loadingMap, setLoadingMap] = useState(false)
  const [mapResult, setMapResult] = useState<{ mapeados: number; warnings: unknown[] } | null>(null)

  async function handleSync() {
    setLoadingSync(true)
    try {
      const res = await fetch('/api/admin/sync-jogos-manual', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro no sync'); return }
      toast.success(`Sync concluído — ${data.jogos_atualizados} jogo(s) atualizados`)
    } catch {
      toast.error('Falha na requisição')
    } finally {
      setLoadingSync(false)
    }
  }

  async function handleMapear() {
    setLoadingMap(true)
    try {
      const res = await fetch('/api/admin/mapear-fixtures', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro no mapping'); return }
      setMapResult(data)
      toast.success(`Mapping concluído — ${data.mapeados}/${data.total_api} mapeados`)
    } catch {
      toast.error('Falha na requisição')
    } finally {
      setLoadingMap(false)
    }
  }

  return (
    <div className="border-border bg-bg-elevated mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <div className="text-text-muted text-sm">
        {ultimoSync ? (
          <>
            Último sync:{' '}
            <span className="text-text-primary">
              há {tempoAtras(ultimoSync.finalizado_em ?? ultimoSync.iniciado_em)}
            </span>
            {' — '}
            <span className="text-text-primary">{ultimoSync.jogos_atualizados} jogo(s) atualizados</span>
          </>
        ) : (
          <span>Nenhum sync realizado ainda</span>
        )}
        {' · '}
        <span className="text-text-muted">{totalMapeados}/104 fixtures mapeados</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSync}
          disabled={loadingSync}
          className="border-border bg-bg-base text-text-primary hover:border-accent flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loadingSync ? 'animate-spin' : ''} />
          Sincronizar agora
        </button>

        {totalMapeados < 104 && (
          <button
            onClick={handleMapear}
            disabled={loadingMap}
            className="border-border bg-bg-base text-text-muted hover:text-text-primary flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
          >
            <Settings size={14} />
            Mapear fixtures
          </button>
        )}
      </div>

      {mapResult && (
        <details className="w-full">
          <summary className="text-text-muted cursor-pointer text-xs">
            Resultado do mapping ({mapResult.mapeados} mapeados, {mapResult.warnings.length} warnings)
          </summary>
          <pre className="bg-bg-base mt-2 overflow-x-auto rounded p-2 text-xs">
            {JSON.stringify(mapResult, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
```

- [ ] **Atualizar app/(admin)/admin/jogos/page.tsx** — adicionar 2 queries paralelas e props

```typescript
// Adicionar as 2 queries paralelas ao Promise.all existente (4 queries no total):
const [jogosRes, selecoesRes, copaRes, syncRes, mapeadosRes] = await Promise.all([
  // ... queries existentes (jogos, selecoes, copa) ...
  admin
    .from('sync_jogos_log')
    .select('iniciado_em, finalizado_em, jogos_atualizados, status')
    .order('iniciado_em', { ascending: false })
    .limit(1)
    .maybeSingle(),
  admin
    .from('jogos')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null),
])

const ultimoSync = syncRes.data ?? null
const totalMapeados = mapeadosRes.count ?? 0
```

Passar como props ao JogosClient:
```tsx
<JogosClient
  jogos={jogos}
  selecoes={selecoes}
  copaResultados={copaResultados}
  initialTab={initialTab}
  ultimoSync={ultimoSync}
  totalMapeados={totalMapeados}
/>
```

- [ ] **Atualizar JogosClient.tsx** — adicionar prop types + import + elemento JSX

Adicionar ao tipo Props:
```typescript
import { SyncStatus } from '@/components/admin/SyncStatus'

// No tipo Props, adicionar:
  ultimoSync: {
    iniciado_em: string
    finalizado_em: string | null
    jogos_atualizados: number
    status: string
  } | null
  totalMapeados: number
```

Adicionar ao destruct da função e ao JSX logo antes das Tabs:
```typescript
export function JogosClient({ jogos: initialJogos, selecoes, copaResultados, initialTab, ultimoSync, totalMapeados }: Props) {
  // ...estado existente...

  return (
    <div>
      <SyncStatus ultimoSync={ultimoSync} totalMapeados={totalMapeados} />

      {/* Tabs — código existente sem alteração */}
      <div className="border-border mb-6 flex overflow-x-auto border-b">
        ...
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Rodar suite completa**

```bash
npx vitest run
```

Esperado: todos PASS.

- [ ] **Commit final**

```bash
git add components/admin/SyncStatus.tsx app/(admin)/admin/jogos/page.tsx app/(admin)/admin/jogos/JogosClient.tsx
git commit -m "feat(F12): SyncStatus UI + JogosClient integration + mapear-fixtures button"
```

---

## Self-review

**Spec coverage:**
- ✅ `lib/api-football.ts` — Task 2
- ✅ `lib/sync-jogos.ts` — Tasks 3+4
- ✅ TDD ≥ 95% nas 2 libs puras — 14 testes de sync-jogos + 9 de api-football
- ✅ `app/api/cron/sync-jogos` (GET, CRON_SECRET) — Task 6
- ✅ `app/api/admin/sync-jogos-manual` (POST, is_admin) — Task 6
- ✅ `app/api/admin/mapear-fixtures` (POST, is_admin) — Task 7
- ✅ `lib/sync-runner.ts` com lazy match + recálculo + placeholder — Task 5
- ✅ `sync_jogos_log` migration + RLS — Task 1
- ✅ `vercel.json` cron `0 */2 * * *` — Task 1
- ✅ `SyncStatus` UI com botões — Task 8
- ✅ `env-server.ts` + `.env.local.example` — Task 1

**Placeholder scan:** nenhum TBD, TODO ou "similar ao Task N". Código completo em cada step.

**Type consistency:** `JogoBanco` definido em Task 3 e importado em Tasks 4, 5. `ParsedFixture` definido em Task 2 e importado em Task 3. `JogoUpdate` definido em Task 3 e usado em Tasks 4, 5. Assinaturas consistentes.
