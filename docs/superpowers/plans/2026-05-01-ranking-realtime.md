# F8 Ranking Realtime — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela `/ranking` com pódio + tabela por usuário, tab Rodada, tendência de posições via snapshots e atualização em tempo real via Supabase Realtime.

**Architecture:** Server Component carrega dados iniciais (SSR); `RankingShell` (Client) exibe e assina `ranking_signals` via Supabase Realtime — debounce `3000 + rand(0–1500)ms` → re-fetch. Três novos objetos de banco: view `ranking_usuarios` (melhor bilhete por usuário), tabela `ranking_snapshots` (histórico para tendência), tabela `ranking_signals` (sinal para Realtime via trigger `FOR EACH STATEMENT` em `palpites`).

**Tech Stack:** Next.js 14 App Router, Supabase (postgres_changes Realtime), Tailwind v4, Vitest + @testing-library/react, Zod.

---

## File Map

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/migrations/20260501000000_ranking_f8.sql` |
| Modificar | `lib/supabase/types.ts` (adicionar tipos manualmente) |
| Criar | `lib/format/avatar-color.ts` |
| Criar | `lib/format/__tests__/avatar-color.test.ts` |
| Criar | `lib/ranking.ts` (`determinarPeriodoAtual`) |
| Criar | `lib/__tests__/ranking.test.ts` |
| Criar | `app/api/admin/ranking-snapshot/route.ts` |
| Criar | `components/ranking/RankingRow.tsx` |
| Criar | `components/ranking/__tests__/RankingRow.test.tsx` |
| Criar | `components/ranking/PodioCard.tsx` |
| Criar | `components/ranking/PodioSection.tsx` |
| Criar | `components/ranking/__tests__/PodioSection.test.tsx` |
| Criar | `components/ranking/RankingTable.tsx` |
| Criar | `components/ranking/RankingTabGeral.tsx` |
| Criar | `components/ranking/__tests__/RankingTabGeral.test.tsx` |
| Criar | `components/ranking/RankingTabRodada.tsx` |
| Criar | `components/ranking/__tests__/RankingTabRodada.test.tsx` |
| Criar | `components/ranking/RankingShell.tsx` |
| Criar | `components/ranking/__tests__/RankingShell.test.tsx` |
| Criar | `components/ranking/PerfilPublico.tsx` |
| Criar | `app/(dashboard)/ranking/page.tsx` |
| Criar | `app/(dashboard)/ranking/[bilheteId]/page.tsx` |
| Criar | `app/(dashboard)/ranking/[bilheteId]/not-found.tsx` |
| Modificar | `components/dashboard/DashboardNav.tsx` |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260501000000_ranking_f8.sql`

- [ ] **Criar arquivo de migration**

```sql
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
```

- [ ] **Aplicar migration no Supabase**

```bash
npx supabase db push
```

Se der erro de auth, rode: `npx supabase login` primeiro.

Expected: `Applying migration 20260501000000_ranking_f8.sql... done`

- [ ] **Commit**

```bash
git add supabase/migrations/20260501000000_ranking_f8.sql
git commit -m "feat(db): add ranking_usuarios view, ranking_snapshots, ranking_signals + trigger (F8)"
```

---

## Task 2: Atualizar tipos TypeScript

**Files:**
- Modify: `lib/supabase/types.ts`

- [ ] **Adicionar tipos das novas tabelas/views no `lib/supabase/types.ts`**

Adicionar dentro de `Tables` (após `selecoes`):

```ts
      ranking_snapshots: {
        Row: {
          id: string
          user_id: string
          posicao: number
          pontos_totais: number
          periodo: string
          snapshot_at: string
        }
        Insert: {
          id?: string
          user_id: string
          posicao: number
          pontos_totais: number
          periodo: string
          snapshot_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          posicao?: number
          pontos_totais?: number
          periodo?: string
          snapshot_at?: string
        }
        Relationships: []
      }
      ranking_signals: {
        Row: { id: number; updated_at: string }
        Insert: { id?: number; updated_at?: string }
        Update: { id?: number; updated_at?: string }
        Relationships: []
      }
```

Adicionar dentro de `Views` (após `ranking`):

```ts
      ranking_usuarios: {
        Row: {
          user_id: string | null
          nome: string | null
          melhor_bilhete_id: string | null
          melhor_numero_bilhete: number | null
          pontos_totais: number | null
          acertos_exatos: number | null
          acertos_parciais: number | null
          pontos_mata_mata: number | null
          acertou_campeao: boolean | null
          total_bilhetes: number | null
          posicao: number | null
        }
        Relationships: []
      }
```

- [ ] **Verificar que o TypeScript não quebra**

```bash
npx tsc --noEmit
```

Expected: zero erros

- [ ] **Commit**

```bash
git add lib/supabase/types.ts
git commit -m "chore(types): add ranking_snapshots, ranking_signals, ranking_usuarios types (F8)"
```

---

## Task 3: Utility `avatarColor` + `avatarInitials`

**Files:**
- Create: `lib/format/avatar-color.ts`
- Create: `lib/format/__tests__/avatar-color.test.ts`

- [ ] **Escrever o teste que falha**

```ts
// lib/format/__tests__/avatar-color.test.ts
import { describe, expect, it } from 'vitest'
import { avatarColor, avatarInitials } from '../avatar-color'

describe('avatarColor', () => {
  it('retorna uma string não-vazia', () => {
    expect(avatarColor('abc-123')).toBeTruthy()
  })

  it('é determinístico — mesmo userId → mesmo resultado', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(avatarColor(id)).toBe(avatarColor(id))
  })

  it('userIds diferentes podem retornar valores diferentes', () => {
    const results = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(avatarColor)
    )
    expect(results.size).toBeGreaterThan(1)
  })
})

describe('avatarInitials', () => {
  it('extrai até 2 iniciais de um nome completo', () => {
    expect(avatarInitials('Marco Cardoso')).toBe('MC')
  })

  it('nome com uma palavra → 1 inicial', () => {
    expect(avatarInitials('Jonatas')).toBe('J')
  })

  it('string vazia → string vazia', () => {
    expect(avatarInitials('')).toBe('')
  })

  it('espaços extras não geram iniciais fantasma', () => {
    expect(avatarInitials('  Ana  Beatriz  ')).toBe('AB')
  })
})
```

- [ ] **Rodar e confirmar falha**

```bash
npx vitest run lib/format/__tests__/avatar-color.test.ts
```

Expected: FAIL (módulo não encontrado)

- [ ] **Implementar**

```ts
// lib/format/avatar-color.ts
const GRADIENTS = [
  'linear-gradient(135deg,#22d3ee,#0ea5e9)',
  'linear-gradient(135deg,#f472b6,#ec4899)',
  'linear-gradient(135deg,#a78bfa,#8b5cf6)',
  'linear-gradient(135deg,#34d399,#10b981)',
  'linear-gradient(135deg,#60a5fa,#3b82f6)',
  'linear-gradient(135deg,#fb923c,#f97316)',
  'linear-gradient(135deg,#facc15,#f59e0b)',
  'linear-gradient(135deg,#f87171,#ef4444)',
] as const

export function avatarColor(userId: string): string {
  const hash = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return GRADIENTS[hash % GRADIENTS.length]
}

export function avatarInitials(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}
```

- [ ] **Rodar e confirmar passa**

```bash
npx vitest run lib/format/__tests__/avatar-color.test.ts
```

Expected: PASS (7 testes)

- [ ] **Commit**

```bash
git add lib/format/avatar-color.ts lib/format/__tests__/avatar-color.test.ts
git commit -m "feat(lib): add avatarColor + avatarInitials utilities (F8)"
```

---

## Task 4: Utility `determinarPeriodoAtual`

**Files:**
- Create: `lib/ranking.ts`
- Create: `lib/__tests__/ranking.test.ts`

- [ ] **Escrever o teste que falha**

```ts
// lib/__tests__/ranking.test.ts
import { describe, expect, it } from 'vitest'
import { determinarPeriodoAtual, type JogoParaPeriodo } from '../ranking'

function jogo(overrides: Partial<JogoParaPeriodo> & { id: number }): JogoParaPeriodo {
  return {
    fase: 'grupos',
    data_hora: new Date().toISOString(),
    finalizado: false,
    ...overrides,
  }
}

describe('determinarPeriodoAtual', () => {
  it('retorna null quando lista vazia', () => {
    expect(determinarPeriodoAtual([])).toBeNull()
  })

  it('fase grupos, nenhum jogo finalizado → periodoKey grupos_r1', () => {
    const jogos: JogoParaPeriodo[] = [
      jogo({ id: 1, fase: 'grupos', data_hora: '2026-06-11T19:00:00Z', finalizado: false }),
      jogo({ id: 2, fase: 'grupos', data_hora: '2026-06-12T19:00:00Z', finalizado: false }),
    ]
    const result = determinarPeriodoAtual(jogos)
    expect(result?.periodoKey).toBe('grupos_r1')
  })

  it('fase grupos, 1/3 das rodadas finalizadas → periodoKey grupos_r1', () => {
    // Rodada 1 finalizada (jobs < 1/3 do total), ainda mostra r1
    const jogos: JogoParaPeriodo[] = [
      jogo({ id: 1, fase: 'grupos', data_hora: '2026-06-11T19:00:00Z', finalizado: true }),
      jogo({ id: 2, fase: 'grupos', data_hora: '2026-06-14T19:00:00Z', finalizado: false }),
      jogo({ id: 3, fase: 'grupos', data_hora: '2026-06-18T19:00:00Z', finalizado: false }),
    ]
    const result = determinarPeriodoAtual(jogos)
    expect(result?.periodoKey).toBe('grupos_r1')
  })

  it('fase oitavas → periodoKey oitavas, label "Oitavas de final"', () => {
    const jogos: JogoParaPeriodo[] = [
      jogo({ id: 1, fase: 'grupos', data_hora: '2026-06-11T19:00:00Z', finalizado: true }),
      jogo({ id: 2, fase: 'oitavas', data_hora: '2026-07-01T19:00:00Z', finalizado: false }),
    ]
    const result = determinarPeriodoAtual(jogos)
    expect(result?.periodoKey).toBe('oitavas')
    expect(result?.label).toBe('Oitavas de final')
  })

  it('final → periodoKey final, label "Final"', () => {
    const jogos: JogoParaPeriodo[] = [
      jogo({ id: 1, fase: 'final', data_hora: '2026-07-19T16:00:00Z', finalizado: false }),
    ]
    const result = determinarPeriodoAtual(jogos)
    expect(result?.periodoKey).toBe('final')
    expect(result?.label).toBe('Final')
  })

  it('retorna jogoIds corretos para a fase/rodada ativa', () => {
    const jogos: JogoParaPeriodo[] = [
      jogo({ id: 10, fase: 'oitavas', data_hora: '2026-07-01T19:00:00Z', finalizado: false }),
      jogo({ id: 11, fase: 'oitavas', data_hora: '2026-07-02T19:00:00Z', finalizado: false }),
      jogo({ id: 5, fase: 'grupos', data_hora: '2026-06-20T19:00:00Z', finalizado: true }),
    ]
    const result = determinarPeriodoAtual(jogos)
    expect(result?.jogoIds).toContain(10)
    expect(result?.jogoIds).toContain(11)
    expect(result?.jogoIds).not.toContain(5)
  })
})
```

- [ ] **Rodar e confirmar falha**

```bash
npx vitest run lib/__tests__/ranking.test.ts
```

Expected: FAIL

- [ ] **Implementar**

```ts
// lib/ranking.ts
import type { FaseJogo } from './pontuacao'

export type JogoParaPeriodo = {
  id: number
  fase: FaseJogo
  data_hora: string
  finalizado: boolean
}

export type PeriodoAtual = {
  label: string
  periodoKey: string
  jogoIds: number[]
}

const LABEL_FASE: Record<FaseJogo, string> = {
  grupos: 'Fase de Grupos',
  '16avos': '16avos de final',
  oitavas: 'Oitavas de final',
  quartas: 'Quartas de final',
  semis: 'Semifinais',
  disputa_terceiro: 'Disputa de 3° lugar',
  final: 'Final',
}

const FASE_ORDER: FaseJogo[] = [
  'grupos', '16avos', 'oitavas', 'quartas', 'semis', 'disputa_terceiro', 'final',
]

export function determinarPeriodoAtual(jogos: JogoParaPeriodo[]): PeriodoAtual | null {
  if (jogos.length === 0) return null

  // Fase ativa = fase com jogo finalizado mais recente; ou fase do próximo jogo
  const finalizados = jogos
    .filter((j) => j.finalizado)
    .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())

  const proximos = jogos
    .filter((j) => !j.finalizado)
    .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())

  const faseAtiva: FaseJogo =
    (proximos[0]?.fase ?? finalizados[0]?.fase ?? 'grupos') as FaseJogo

  if (faseAtiva !== 'grupos') {
    const jogosDaFase = jogos.filter((j) => j.fase === faseAtiva)
    return {
      label: LABEL_FASE[faseAtiva],
      periodoKey: faseAtiva,
      jogoIds: jogosDaFase.map((j) => j.id),
    }
  }

  // Grupos: dividir em 3 rodadas pelo índice cronológico
  // Rodada 1 = primeiros 24 jogos de grupos (índices 0–23)
  // Rodada 2 = próximos 24 (índices 24–47)
  // Rodada 3 = últimos 24 (índices 48–71)
  const jogosGrupos = jogos
    .filter((j) => j.fase === 'grupos')
    .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())

  const total = jogosGrupos.length
  const rodadaSize = Math.ceil(total / 3)

  // Rodada ativa = a que contém o último jogo finalizado, ou r1 se nenhum
  const ultimoFinalizado = jogosGrupos.filter((j) => j.finalizado).at(-1)
  const idxUltimo = ultimoFinalizado
    ? jogosGrupos.findIndex((j) => j.id === ultimoFinalizado.id)
    : -1

  const rodadaIdx = idxUltimo < 0 ? 0 : Math.min(Math.floor(idxUltimo / rodadaSize), 2)
  const rodadaNum = rodadaIdx + 1
  const slice = jogosGrupos.slice(rodadaIdx * rodadaSize, (rodadaIdx + 1) * rodadaSize)

  return {
    label: `Grupos — Rodada ${rodadaNum}`,
    periodoKey: `grupos_r${rodadaNum}`,
    jogoIds: slice.map((j) => j.id),
  }
}
```

- [ ] **Rodar e confirmar passa**

```bash
npx vitest run lib/__tests__/ranking.test.ts
```

Expected: PASS

- [ ] **Commit**

```bash
git add lib/ranking.ts lib/__tests__/ranking.test.ts
git commit -m "feat(lib): add determinarPeriodoAtual utility (F8)"
```

---

## Task 5: Snapshot API Route

**Files:**
- Create: `app/api/admin/ranking-snapshot/route.ts`

- [ ] **Implementar a route**

```ts
// app/api/admin/ranking-snapshot/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  periodo: z.string().min(1),
  force: z.boolean().optional().default(false),
})

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const { periodo, force } = parsed.data
  const admin = createSupabaseAdminClient()

  if (!force) {
    const { data: existing } = await admin
      .from('ranking_snapshots')
      .select('id')
      .eq('periodo', periodo)
      .limit(1)
      .maybeSingle()
    if (existing) return NextResponse.json({ exists: true }, { status: 409 })
  }

  const { data: ranking } = await admin
    .from('ranking_usuarios')
    .select('user_id, posicao, pontos_totais')

  if (!ranking?.length) return NextResponse.json({ ok: true, count: 0 })

  const rows = ranking.map((r) => ({
    user_id: r.user_id!,
    posicao: r.posicao!,
    pontos_totais: r.pontos_totais!,
    periodo,
  }))

  const { error } = await admin
    .from('ranking_snapshots')
    .upsert(rows, { onConflict: 'user_id,periodo' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: rows.length })
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero erros

- [ ] **Commit**

```bash
git add app/api/admin/ranking-snapshot/route.ts
git commit -m "feat(api): add POST /api/admin/ranking-snapshot (F8)"
```

---

## Task 6: Componente `RankingRow`

**Files:**
- Create: `components/ranking/RankingRow.tsx`
- Create: `components/ranking/__tests__/RankingRow.test.tsx`

- [ ] **Escrever o teste que falha**

```tsx
// components/ranking/__tests__/RankingRow.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RankingRow, type RankingRowData } from '../RankingRow'

const base: RankingRowData = {
  userId: 'user-1',
  nome: 'Marco Cardoso',
  posicao: 4,
  pontosTotais: 287,
  acertosExatos: 8,
  acertosParciais: 20,
  totalBilhetes: 3,
  tendencia: null,
  isCurrentUser: false,
}

describe('<RankingRow />', () => {
  it('renderiza nome e pontos', () => {
    render(<table><tbody><RankingRow data={base} /></tbody></table>)
    expect(screen.getByText('Marco Cardoso')).toBeInTheDocument()
    expect(screen.getByText('287')).toBeInTheDocument()
  })

  it('exibe posição numérica', () => {
    render(<table><tbody><RankingRow data={base} /></tbody></table>)
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('exibe acertos exatos e parciais', () => {
    render(<table><tbody><RankingRow data={base} /></tbody></table>)
    expect(screen.getByText(/8/)).toBeInTheDocument()
    expect(screen.getByText(/20/)).toBeInTheDocument()
  })

  it('exibe badge "Você" quando isCurrentUser=true', () => {
    render(<table><tbody><RankingRow data={{ ...base, isCurrentUser: true }} /></tbody></table>)
    expect(screen.getByText(/você/i)).toBeInTheDocument()
  })

  it('não exibe badge "Você" quando isCurrentUser=false', () => {
    render(<table><tbody><RankingRow data={base} /></tbody></table>)
    expect(screen.queryByText(/você/i)).toBeNull()
  })

  it('tendência positiva exibe ▲', () => {
    render(<table><tbody><RankingRow data={{ ...base, tendencia: 2 }} /></tbody></table>)
    expect(screen.getByText(/▲/)).toBeInTheDocument()
  })

  it('tendência negativa exibe ▼', () => {
    render(<table><tbody><RankingRow data={{ ...base, tendencia: -1 }} /></tbody></table>)
    expect(screen.getByText(/▼/)).toBeInTheDocument()
  })

  it('tendência zero ou null exibe ━', () => {
    render(<table><tbody><RankingRow data={{ ...base, tendencia: 0 }} /></tbody></table>)
    expect(screen.getByText('━')).toBeInTheDocument()
  })
})
```

- [ ] **Rodar e confirmar falha**

```bash
npx vitest run components/ranking/__tests__/RankingRow.test.tsx
```

- [ ] **Implementar**

```tsx
// components/ranking/RankingRow.tsx
import { avatarColor, avatarInitials } from '@/lib/format/avatar-color'

export type RankingRowData = {
  userId: string
  nome: string
  posicao: number
  pontosTotais: number
  acertosExatos: number
  acertosParciais: number
  totalBilhetes: number
  tendencia: number | null  // positivo = subiu, negativo = caiu, 0 ou null = igual
  isCurrentUser: boolean
}

const POS_CLASS: Record<number, string> = {
  1: 'rank-pos-gold',
  2: 'rank-pos-silver',
  3: 'rank-pos-bronze',
}

export function RankingRow({ data }: { data: RankingRowData }) {
  const { userId, nome, posicao, pontosTotais, acertosExatos, acertosParciais,
          totalBilhetes, tendencia, isCurrentUser } = data

  const posClass = POS_CLASS[posicao] ?? 'rank-pos-normal'
  const trendSign = tendencia === null || tendencia === 0 ? 0 : tendencia > 0 ? 1 : -1
  const trendLabel = trendSign === 1 ? `▲ ${tendencia}` : trendSign === -1 ? `▼ ${Math.abs(tendencia!)}` : '━'
  const trendClass = trendSign === 1 ? 'trend-up' : trendSign === -1 ? 'trend-down' : 'trend-same'

  return (
    <tr className={isCurrentUser ? 'rank-row-me' : undefined}>
      <td>
        <div className={`rank-pos ${posClass}`}>{posicao}</div>
      </td>
      <td>
        <div className="rank-user">
          <div
            className="rank-avatar"
            style={{ background: avatarColor(userId) }}
            aria-hidden="true"
          >
            {avatarInitials(nome)}
          </div>
          <div>
            <div className="rank-name">
              {nome}
              {isCurrentUser && <span className="rank-you-badge">Você</span>}
            </div>
            <div className="rank-meta">
              {totalBilhetes === 1 ? '1 tabela' : `${totalBilhetes} tabelas`}
            </div>
          </div>
        </div>
      </td>
      <td className="rank-acertos">
        <strong>{acertosExatos}</strong> ex ·{' '}
        {/* acertos_parciais inclui vencedor+vencedor_saldo+parcial; fix semântico em F10 */}
        <strong>{acertosParciais}</strong> parc
      </td>
      <td>
        <span className={`rank-trend ${trendClass}`}>{trendLabel}</span>
      </td>
      <td className="rank-pts">{pontosTotais}</td>
    </tr>
  )
}
```

- [ ] **Rodar e confirmar passa**

```bash
npx vitest run components/ranking/__tests__/RankingRow.test.tsx
```

- [ ] **Commit**

```bash
git add components/ranking/RankingRow.tsx components/ranking/__tests__/RankingRow.test.tsx
git commit -m "feat(ranking): add RankingRow component (F8)"
```

---

## Task 7: Componentes `PodioCard` + `PodioSection`

**Files:**
- Create: `components/ranking/PodioCard.tsx`
- Create: `components/ranking/PodioSection.tsx`
- Create: `components/ranking/__tests__/PodioSection.test.tsx`

- [ ] **Escrever o teste que falha**

```tsx
// components/ranking/__tests__/PodioSection.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PodioSection, type PodioEntry } from '../PodioSection'

const top3: PodioEntry[] = [
  { userId: 'u1', nome: 'Marco Cardoso', posicao: 1, pontosTotais: 472, totalBilhetes: 5, isCurrentUser: false },
  { userId: 'u2', nome: 'Ana Beatriz',   posicao: 2, pontosTotais: 458, totalBilhetes: 2, isCurrentUser: false },
  { userId: 'u3', nome: 'Rafael Santos', posicao: 3, pontosTotais: 445, totalBilhetes: 8, isCurrentUser: true  },
]

describe('<PodioSection />', () => {
  it('renderiza os 3 nomes', () => {
    render(<PodioSection entries={top3} />)
    expect(screen.getByText('Marco Cardoso')).toBeInTheDocument()
    expect(screen.getByText('Ana Beatriz')).toBeInTheDocument()
    expect(screen.getByText('Rafael Santos')).toBeInTheDocument()
  })

  it('exibe pontuações', () => {
    render(<PodioSection entries={top3} />)
    expect(screen.getByText('472')).toBeInTheDocument()
  })

  it('exibe badge "Você" para o usuário logado', () => {
    render(<PodioSection entries={top3} />)
    expect(screen.getByText(/você/i)).toBeInTheDocument()
  })

  it('não renderiza nada quando entries vazio', () => {
    const { container } = render(<PodioSection entries={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Rodar e confirmar falha**

```bash
npx vitest run components/ranking/__tests__/PodioSection.test.tsx
```

- [ ] **Implementar `PodioCard`**

```tsx
// components/ranking/PodioCard.tsx
import { avatarColor, avatarInitials } from '@/lib/format/avatar-color'
import type { PodioEntry } from './PodioSection'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' } as const

export function PodioCard({ entry }: { entry: PodioEntry }) {
  const { userId, nome, posicao, pontosTotais, totalBilhetes, isCurrentUser } = entry
  return (
    <div className={`podio-card podio-pos-${posicao}`}>
      <div className="podio-medal" aria-hidden="true">{MEDAL[posicao as 1 | 2 | 3]}</div>
      <div
        className="podio-avatar"
        style={{ background: avatarColor(userId) }}
        aria-hidden="true"
      >
        {avatarInitials(nome)}
      </div>
      <div className="podio-nome">
        {nome}
        {isCurrentUser && <span className="rank-you-badge">Você</span>}
      </div>
      <div className="podio-meta">
        {totalBilhetes === 1 ? '1 tabela' : `${totalBilhetes} tabelas`}
      </div>
      <div className="podio-pts">{pontosTotais}</div>
      <div className="podio-pts-label">pontos</div>
    </div>
  )
}
```

- [ ] **Implementar `PodioSection`**

```tsx
// components/ranking/PodioSection.tsx
import { PodioCard } from './PodioCard'

export type PodioEntry = {
  userId: string
  nome: string
  posicao: number
  pontosTotais: number
  totalBilhetes: number
  isCurrentUser: boolean
}

export function PodioSection({ entries }: { entries: PodioEntry[] }) {
  if (entries.length === 0) return null
  // Ordem visual: 2° à esquerda, 1° ao centro, 3° à direita
  const ordered = [entries[1], entries[0], entries[2]].filter(Boolean)
  return (
    <div className="podio-section">
      {ordered.map((e) => (
        <PodioCard key={e.userId} entry={e} />
      ))}
    </div>
  )
}
```

- [ ] **Rodar e confirmar passa**

```bash
npx vitest run components/ranking/__tests__/PodioSection.test.tsx
```

- [ ] **Commit**

```bash
git add components/ranking/PodioCard.tsx components/ranking/PodioSection.tsx components/ranking/__tests__/PodioSection.test.tsx
git commit -m "feat(ranking): add PodioCard + PodioSection components (F8)"
```

---

## Task 8: `RankingTable` + `RankingTabGeral`

**Files:**
- Create: `components/ranking/RankingTable.tsx`
- Create: `components/ranking/RankingTabGeral.tsx`
- Create: `components/ranking/__tests__/RankingTabGeral.test.tsx`

- [ ] **Escrever o teste que falha**

```tsx
// components/ranking/__tests__/RankingTabGeral.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RankingTabGeral } from '../RankingTabGeral'
import type { RankingRowData } from '../RankingRow'

const rows: RankingRowData[] = [
  { userId: 'u1', nome: 'Marco', posicao: 1, pontosTotais: 472, acertosExatos: 18, acertosParciais: 34, totalBilhetes: 5, tendencia: null, isCurrentUser: false },
  { userId: 'u2', nome: 'Ana',   posicao: 2, pontosTotais: 458, acertosExatos: 15, acertosParciais: 38, totalBilhetes: 2, tendencia: 1,    isCurrentUser: false },
  { userId: 'u3', nome: 'Rafael',posicao: 3, pontosTotais: 445, acertosExatos: 16, acertosParciais: 31, totalBilhetes: 8, tendencia: -1,   isCurrentUser: true  },
]

describe('<RankingTabGeral />', () => {
  it('renderiza pódio e tabela quando há dados', () => {
    render(<RankingTabGeral rows={rows} />)
    expect(screen.getAllByText('Marco').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('estado vazio quando rows = []', () => {
    render(<RankingTabGeral rows={[]} />)
    expect(screen.getByText(/ranking ainda está vazio/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /comprar tabela/i })).toBeInTheDocument()
  })

  it('não renderiza pódio no estado vazio', () => {
    render(<RankingTabGeral rows={[]} />)
    expect(screen.queryByText(/🥇/)).toBeNull()
  })
})
```

- [ ] **Rodar e confirmar falha**

```bash
npx vitest run components/ranking/__tests__/RankingTabGeral.test.tsx
```

- [ ] **Implementar `RankingTable`**

```tsx
// components/ranking/RankingTable.tsx
import { RankingRow, type RankingRowData } from './RankingRow'

export function RankingTable({ rows }: { rows: RankingRowData[] }) {
  return (
    <div className="ranking-table-panel">
      <table className="ranking-table" role="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Apostador</th>
            <th>Acertos</th>
            <th>Tend.</th>
            <th>Pontos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RankingRow key={row.userId} data={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Implementar `RankingTabGeral`**

```tsx
// components/ranking/RankingTabGeral.tsx
import Link from 'next/link'
import { PodioSection } from './PodioSection'
import { RankingTable } from './RankingTable'
import type { RankingRowData } from './RankingRow'
import type { PodioEntry } from './PodioSection'

export function RankingTabGeral({ rows }: { rows: RankingRowData[] }) {
  if (rows.length === 0) {
    return (
      <div className="ranking-empty">
        <span aria-hidden="true" className="ranking-empty-icon">🏆</span>
        <p className="ranking-empty-title">O ranking ainda está vazio</p>
        <p className="ranking-empty-sub">
          Seja o primeiro a comprar sua tabela e garantir sua posição.
        </p>
        <Link href="/comprar" className="btn-primary">Comprar tabela →</Link>
      </div>
    )
  }

  const top3: PodioEntry[] = rows
    .filter((r) => r.posicao <= 3)
    .map((r) => ({
      userId: r.userId,
      nome: r.nome,
      posicao: r.posicao,
      pontosTotais: r.pontosTotais,
      totalBilhetes: r.totalBilhetes,
      isCurrentUser: r.isCurrentUser,
    }))

  return (
    <>
      <PodioSection entries={top3} />
      <RankingTable rows={rows} />
    </>
  )
}
```

- [ ] **Rodar e confirmar passa**

```bash
npx vitest run components/ranking/__tests__/RankingTabGeral.test.tsx
```

- [ ] **Commit**

```bash
git add components/ranking/RankingTable.tsx components/ranking/RankingTabGeral.tsx components/ranking/__tests__/RankingTabGeral.test.tsx
git commit -m "feat(ranking): add RankingTable + RankingTabGeral components (F8)"
```

---

## Task 9: `RankingTabRodada`

**Files:**
- Create: `components/ranking/RankingTabRodada.tsx`
- Create: `components/ranking/__tests__/RankingTabRodada.test.tsx`

- [ ] **Escrever o teste que falha**

```tsx
// components/ranking/__tests__/RankingTabRodada.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RankingTabRodada } from '../RankingTabRodada'
import type { RankingRowData } from '../RankingRow'

const rows: RankingRowData[] = [
  { userId: 'u1', nome: 'Ana', posicao: 1, pontosTotais: 20, acertosExatos: 2, acertosParciais: 0, totalBilhetes: 1, tendencia: null, isCurrentUser: false },
]

describe('<RankingTabRodada />', () => {
  it('exibe o label do período', () => {
    render(<RankingTabRodada label="Grupos — Rodada 1" rows={rows} />)
    expect(screen.getByText(/grupos — rodada 1/i)).toBeInTheDocument()
  })

  it('renderiza a tabela com dados', () => {
    render(<RankingTabRodada label="Oitavas de final" rows={rows} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  it('estado vazio quando rows = []', () => {
    render(<RankingTabRodada label="Grupos — Rodada 1" rows={[]} />)
    expect(screen.getByText(/nenhum ponto registrado/i)).toBeInTheDocument()
  })
})
```

- [ ] **Rodar e confirmar falha**

```bash
npx vitest run components/ranking/__tests__/RankingTabRodada.test.tsx
```

- [ ] **Implementar**

```tsx
// components/ranking/RankingTabRodada.tsx
import { RankingTable } from './RankingTable'
import type { RankingRowData } from './RankingRow'

export function RankingTabRodada({
  label,
  rows,
}: {
  label: string
  rows: RankingRowData[]
}) {
  return (
    <div>
      <div className="periodo-banner">
        <span className="periodo-banner-label">{label}</span>
      </div>
      {rows.length === 0 ? (
        <p className="ranking-empty-sub">
          Nenhum ponto registrado neste período ainda.
        </p>
      ) : (
        <RankingTable rows={rows} />
      )}
    </div>
  )
}
```

- [ ] **Rodar e confirmar passa**

```bash
npx vitest run components/ranking/__tests__/RankingTabRodada.test.tsx
```

- [ ] **Commit**

```bash
git add components/ranking/RankingTabRodada.tsx components/ranking/__tests__/RankingTabRodada.test.tsx
git commit -m "feat(ranking): add RankingTabRodada component (F8)"
```

---

## Task 10: `RankingShell` (Client Component + Realtime)

**Files:**
- Create: `components/ranking/RankingShell.tsx`
- Create: `components/ranking/__tests__/RankingShell.test.tsx`

- [ ] **Escrever o teste que falha**

```tsx
// components/ranking/__tests__/RankingShell.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: vi.fn(),
  }),
}))

import { RankingShell } from '../RankingShell'
import type { RankingShellProps } from '../RankingShell'

const props: RankingShellProps = {
  initialRows: [
    { userId: 'u1', nome: 'Marco', posicao: 1, pontosTotais: 472, acertosExatos: 18,
      acertosParciais: 34, totalBilhetes: 5, tendencia: null, isCurrentUser: false },
  ],
  periodoLabel: 'Grupos — Rodada 1',
  periodoRows: [],
  totalApostadores: 1,
}

describe('<RankingShell />', () => {
  it('renderiza tab Geral por padrão', () => {
    render(<RankingShell {...props} />)
    expect(screen.getByText('Marco')).toBeInTheDocument()
  })

  it('troca para tab Rodada ao clicar', () => {
    render(<RankingShell {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /rodada/i }))
    expect(screen.getByText(/grupos — rodada 1/i)).toBeInTheDocument()
  })

  it('exibe contagem de apostadores', () => {
    render(<RankingShell {...props} />)
    expect(screen.getByText(/1 apostador/i)).toBeInTheDocument()
  })
})
```

- [ ] **Rodar e confirmar falha**

```bash
npx vitest run components/ranking/__tests__/RankingShell.test.tsx
```

- [ ] **Implementar**

```tsx
// components/ranking/RankingShell.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { RankingTabGeral } from './RankingTabGeral'
import { RankingTabRodada } from './RankingTabRodada'
import type { RankingRowData } from './RankingRow'

export type RankingShellProps = {
  initialRows: RankingRowData[]
  periodoLabel: string
  periodoRows: RankingRowData[]
  totalApostadores: number
}

export function RankingShell({
  initialRows,
  periodoLabel,
  periodoRows: initialPeriodoRows,
  totalApostadores,
}: RankingShellProps) {
  const [tab, setTab] = useState<'geral' | 'rodada'>('geral')
  const [rows, setRows] = useState(initialRows)
  const [periodoRows, setPeriodoRows] = useState(initialPeriodoRows)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const fetchRanking = useCallback(async () => {
    const res = await fetch('/api/ranking')
    if (!res.ok) return
    const json = await res.json()
    setRows(json.geral ?? rows)
    setPeriodoRows(json.periodo ?? periodoRows)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel('ranking-signal')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ranking_signals' },
        () => {
          clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(fetchRanking, 3000 + Math.random() * 1500)
        },
      )
      .subscribe()
    return () => {
      clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [fetchRanking])

  const apostadorLabel =
    totalApostadores === 1 ? '1 apostador' : `${totalApostadores} apostadores`

  return (
    <div>
      <div className="ranking-shell-header">
        <div>
          <h1 className="dash-greeting">
            Ranking <span>geral</span>
          </h1>
          <p className="dash-subtitle">
            <span className="live-dot" aria-hidden="true" /> Atualizado em tempo real ·{' '}
            {apostadorLabel}
          </p>
        </div>
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'geral'}
            className={`tab ${tab === 'geral' ? 'tab-active' : ''}`}
            onClick={() => setTab('geral')}
          >
            Geral
          </button>
          <button
            role="tab"
            aria-selected={tab === 'rodada'}
            className={`tab ${tab === 'rodada' ? 'tab-active' : ''}`}
            onClick={() => setTab('rodada')}
          >
            Rodada
          </button>
        </div>
      </div>

      {tab === 'geral' ? (
        <RankingTabGeral rows={rows} />
      ) : (
        <RankingTabRodada label={periodoLabel} rows={periodoRows} />
      )}
    </div>
  )
}
```

- [ ] **Rodar e confirmar passa**

```bash
npx vitest run components/ranking/__tests__/RankingShell.test.tsx
```

- [ ] **Commit**

```bash
git add components/ranking/RankingShell.tsx components/ranking/__tests__/RankingShell.test.tsx
git commit -m "feat(ranking): add RankingShell client component with Realtime subscription (F8)"
```

---

## Task 11: API route interna `/api/ranking`

O `RankingShell` chama `/api/ranking` quando o Realtime dispara. Essa route serve os dados atualizados.

**Files:**
- Create: `app/api/ranking/route.ts`

- [ ] **Implementar**

```ts
// app/api/ranking/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { determinarPeriodoAtual } from '@/lib/ranking'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const [{ data: rankingData }, { data: jogosData }] = await Promise.all([
    supabase.from('ranking_usuarios').select('*').order('posicao', { ascending: true }),
    supabase.from('jogos').select('id, fase, data_hora, finalizado'),
  ])

  const periodo = determinarPeriodoAtual(jogosData ?? [])

  // Buscar último snapshot por usuário para calcular tendência
  const { data: snapshots } = await supabase
    .from('ranking_snapshots')
    .select('user_id, posicao, snapshot_at')
    .order('snapshot_at', { ascending: false })

  const lastSnap = new Map<string, number>()
  for (const s of snapshots ?? []) {
    if (s.user_id && !lastSnap.has(s.user_id)) lastSnap.set(s.user_id, s.posicao)
  }

  const geral = (rankingData ?? []).map((r) => {
    const snapPos = lastSnap.get(r.user_id ?? '') ?? null
    return {
      userId: r.user_id,
      nome: r.nome ?? '',
      posicao: r.posicao ?? 0,
      pontosTotais: r.pontos_totais ?? 0,
      acertosExatos: r.acertos_exatos ?? 0,
      acertosParciais: r.acertos_parciais ?? 0,
      totalBilhetes: r.total_bilhetes ?? 1,
      tendencia: snapPos !== null ? snapPos - (r.posicao ?? 0) : null,
      isCurrentUser: r.user_id === user.id,
    }
  })

  let periodoRows: typeof geral = []
  if (periodo) {
    const { data: palpitesData } = await supabase
      .from('palpites')
      .select('bilhete_id, pontos_calculados, bilhetes!inner(user_id, status_pagamento)')
      .in('jogo_id', periodo.jogoIds)
      .eq('bilhetes.status_pagamento', 'confirmado')

    // Agregar pontos por bilhete
    const pontosPorBilhete = new Map<string, number>()
    for (const p of palpitesData ?? []) {
      const prev = pontosPorBilhete.get(p.bilhete_id) ?? 0
      pontosPorBilhete.set(p.bilhete_id, prev + (p.pontos_calculados ?? 0))
    }

    // Melhor bilhete por usuário no período
    // Reusa geral rows com pontos substituídos
    const melhorPorUser = new Map<string, number>()
    for (const [bilheteId, pts] of pontosPorBilhete) {
      const row = geral.find((r) => {
        // Encontra via ranking_usuarios melhor_bilhete_id
        return rankingData?.find((rd) => rd.melhor_bilhete_id === bilheteId && rd.user_id === r.userId)
      })
      if (row) {
        const prev = melhorPorUser.get(row.userId) ?? -1
        if (pts > prev) melhorPorUser.set(row.userId, pts)
      }
    }

    periodoRows = geral
      .filter((r) => melhorPorUser.has(r.userId))
      .map((r) => ({ ...r, pontosTotais: melhorPorUser.get(r.userId)! }))
      .sort((a, b) => b.pontosTotais - a.pontosTotais)
      .map((r, i) => ({ ...r, posicao: i + 1 }))
  }

  return NextResponse.json({ geral, periodo: periodoRows })
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Commit**

```bash
git add app/api/ranking/route.ts
git commit -m "feat(api): add GET /api/ranking for Realtime re-fetch (F8)"
```

---

## Task 12: Pages

**Files:**
- Create: `app/(dashboard)/ranking/page.tsx`
- Create: `app/(dashboard)/ranking/[bilheteId]/page.tsx`
- Create: `app/(dashboard)/ranking/[bilheteId]/not-found.tsx`
- Create: `components/ranking/PerfilPublico.tsx`

- [ ] **Implementar `/ranking/page.tsx`**

```tsx
// app/(dashboard)/ranking/page.tsx
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { determinarPeriodoAtual } from '@/lib/ranking'
import { RankingShell } from '@/components/ranking/RankingShell'
import type { RankingRowData } from '@/components/ranking/RankingRow'

export const dynamic = 'force-dynamic'

export default async function RankingPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const [{ data: rankingData }, { data: jogosData }, { data: snapshots }] =
    await Promise.all([
      supabase.from('ranking_usuarios').select('*').order('posicao', { ascending: true }),
      supabase.from('jogos').select('id, fase, data_hora, finalizado'),
      supabase
        .from('ranking_snapshots')
        .select('user_id, posicao, snapshot_at')
        .order('snapshot_at', { ascending: false }),
    ])

  const lastSnap = new Map<string, number>()
  for (const s of snapshots ?? []) {
    if (s.user_id && !lastSnap.has(s.user_id)) lastSnap.set(s.user_id, s.posicao)
  }

  const geral: RankingRowData[] = (rankingData ?? []).map((r) => {
    const snapPos = lastSnap.get(r.user_id ?? '') ?? null
    return {
      userId: r.user_id ?? '',
      nome: r.nome ?? '',
      posicao: r.posicao ?? 0,
      pontosTotais: r.pontos_totais ?? 0,
      acertosExatos: r.acertos_exatos ?? 0,
      acertosParciais: r.acertos_parciais ?? 0,
      totalBilhetes: r.total_bilhetes ?? 1,
      tendencia: snapPos !== null ? snapPos - (r.posicao ?? 0) : null,
      isCurrentUser: r.user_id === user.id,
    }
  })

  const periodo = determinarPeriodoAtual(jogosData ?? [])

  // Período rows: pontos apenas dos jogos do período, melhor bilhete por user
  let periodoRows: RankingRowData[] = []
  if (periodo && periodo.jogoIds.length > 0) {
    const { data: palpitesData } = await supabase
      .from('palpites')
      .select('bilhete_id, pontos_calculados, bilhetes!inner(user_id, status_pagamento)')
      .in('jogo_id', periodo.jogoIds)
      .eq('bilhetes.status_pagamento', 'confirmado')

    const pontosPorUser = new Map<string, number>()
    for (const p of palpitesData ?? []) {
      const bilheteRow = Array.isArray((p as any).bilhetes)
        ? (p as any).bilhetes[0]
        : (p as any).bilhetes
      const uid: string = bilheteRow?.user_id ?? ''
      if (!uid) continue
      pontosPorUser.set(uid, (pontosPorUser.get(uid) ?? 0) + (p.pontos_calculados ?? 0))
    }

    periodoRows = geral
      .filter((r) => pontosPorUser.has(r.userId))
      .map((r) => ({ ...r, pontosTotais: pontosPorUser.get(r.userId)! }))
      .sort((a, b) => b.pontosTotais - a.pontosTotais)
      .map((r, i) => ({ ...r, posicao: i + 1, tendencia: null }))
  }

  return (
    <RankingShell
      initialRows={geral}
      periodoLabel={periodo?.label ?? 'Aguardando jogos'}
      periodoRows={periodoRows}
      totalApostadores={geral.length}
    />
  )
}
```

- [ ] **Implementar `PerfilPublico`**

```tsx
// components/ranking/PerfilPublico.tsx
import { avatarColor, avatarInitials } from '@/lib/format/avatar-color'

export type PerfilPublicoProps = {
  userId: string
  nome: string
  numeroBilhete: number
  totalBilhetes: number
  posicao: number
  pontosTotais: number
  acertosExatos: number
  selecaoCashback: { nome: string; bandeira: string } | null
  valorPago: number | null
}

export function PerfilPublico(props: PerfilPublicoProps) {
  const {
    userId, nome, numeroBilhete, totalBilhetes, posicao,
    pontosTotais, acertosExatos, selecaoCashback, valorPago,
  } = props

  return (
    <div className="perfil-publico">
      <div className="perfil-header">
        <div className="perfil-avatar" style={{ background: avatarColor(userId) }} aria-hidden="true">
          {avatarInitials(nome)}
        </div>
        <div>
          <h1 className="perfil-nome">{nome}</h1>
          <p className="perfil-meta">
            Tabela #{numeroBilhete} ·{' '}
            {totalBilhetes === 1 ? '1 tabela' : `${totalBilhetes} tabelas`}
          </p>
        </div>
      </div>

      <div className="perfil-kpis">
        <div className="kpi">
          <span className="kpi-value">{posicao}°</span>
          <span className="kpi-label">Posição</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{pontosTotais}</span>
          <span className="kpi-label">Pontos</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{acertosExatos}</span>
          <span className="kpi-label">Acertos exatos</span>
        </div>
      </div>

      {selecaoCashback && (
        <div className="perfil-cashback">
          <span aria-hidden="true">{selecaoCashback.bandeira}</span>{' '}
          <strong>{selecaoCashback.nome}</strong>
          {valorPago !== null && (
            <span className="perfil-cashback-valor">
              {' '}· apostou{' '}
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorPago)}{' '}
              em cashback
            </span>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Implementar `/ranking/[bilheteId]/page.tsx`**

```tsx
// app/(dashboard)/ranking/[bilheteId]/page.tsx
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PerfilPublico } from '@/components/ranking/PerfilPublico'

export default async function PerfilPublicoPage({
  params,
}: {
  params: { bilheteId: string }
}) {
  const supabase = await createSupabaseServerClient()

  const [{ data: rankingRow }, { data: bilhete }] = await Promise.all([
    supabase
      .from('ranking')
      .select('user_id, nome, posicao, pontos_totais, acertos_exatos')
      .eq('bilhete_id', params.bilheteId)
      .single(),
    supabase
      .from('bilhetes')
      .select('numero_bilhete, valor_pago, selecao_cashback_id, status_pagamento')
      .eq('id', params.bilheteId)
      .single(),
  ])

  if (!rankingRow || !bilhete || bilhete.status_pagamento !== 'confirmado') notFound()

  const { data: totalRow } = await supabase
    .from('ranking_usuarios')
    .select('total_bilhetes')
    .eq('user_id', rankingRow.user_id)
    .single()

  let selecaoCashback: { nome: string; bandeira: string } | null = null
  if (bilhete.selecao_cashback_id) {
    const { data: selecao } = await supabase
      .from('selecoes')
      .select('nome, bandeira_emoji')
      .eq('id', bilhete.selecao_cashback_id)
      .single()
    if (selecao) selecaoCashback = { nome: selecao.nome, bandeira: selecao.bandeira_emoji }
  }

  return (
    <PerfilPublico
      userId={rankingRow.user_id ?? ''}
      nome={rankingRow.nome ?? ''}
      numeroBilhete={bilhete.numero_bilhete}
      totalBilhetes={totalRow?.total_bilhetes ?? 1}
      posicao={rankingRow.posicao ?? 0}
      pontosTotais={rankingRow.pontos_totais ?? 0}
      acertosExatos={rankingRow.acertos_exatos ?? 0}
      selecaoCashback={selecaoCashback}
      valorPago={bilhete.valor_pago}
    />
  )
}
```

- [ ] **Implementar `not-found.tsx`**

```tsx
// app/(dashboard)/ranking/[bilheteId]/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="ranking-empty">
      <p className="ranking-empty-title">Bilhete não encontrado</p>
      <p className="ranking-empty-sub">Este bilhete não existe ou ainda não foi confirmado.</p>
      <Link href="/ranking" className="btn-primary">Ver ranking →</Link>
    </div>
  )
}
```

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero erros

- [ ] **Commit**

```bash
git add app/(dashboard)/ranking/ components/ranking/PerfilPublico.tsx
git commit -m "feat(ranking): add /ranking page, /ranking/[bilheteId] profile + PerfilPublico component (F8)"
```

---

## Task 13: CSS (globals.css)

As classes CSS usadas nos componentes de ranking precisam ser definidas no design system.

**Files:**
- Modify: `app/globals.css`

- [ ] **Adicionar classes de ranking no `app/globals.css`**

Localizar a seção de utilities do dashboard e adicionar após ela:

```css
/* ============================================================
   Ranking (F8)
   ============================================================ */
.ranking-table-panel {
  @apply bg-bg-card border-border rounded-xl border overflow-hidden;
}
.ranking-table {
  @apply w-full border-collapse;
}
.ranking-table thead tr {
  @apply bg-bg-dark border-border border-b;
}
.ranking-table th {
  @apply px-4 py-2.5 text-left text-[10px] text-text-muted uppercase tracking-wider font-semibold;
}
.ranking-table th:last-child { @apply text-right; }
.ranking-table td {
  @apply px-4 py-3 border-b border-[#1e1e1e] align-middle;
}
.ranking-table tr:last-child td { @apply border-b-0; }
.rank-row-me td { @apply bg-[rgba(250,204,21,0.04)]; }

.rank-pos {
  @apply w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[13px];
}
.rank-pos-gold   { @apply bg-[rgba(250,204,21,0.15)] text-accent; }
.rank-pos-silver { @apply bg-[rgba(156,163,175,0.15)] text-[#9ca3af]; }
.rank-pos-bronze { @apply bg-[rgba(205,124,46,0.15)] text-[#cd7c2e]; }
.rank-pos-normal { @apply bg-[#252525] text-text-muted; }

.rank-user  { @apply flex items-center gap-2.5; }
.rank-avatar {
  @apply w-[34px] h-[34px] rounded-full flex items-center justify-center
         font-bold text-xs text-bg-dark shrink-0;
}
.rank-name  { @apply font-semibold text-[13px]; }
.rank-meta  { @apply text-[11px] text-text-muted; }
.rank-you-badge {
  @apply ml-1.5 text-[10px] bg-[rgba(250,204,21,0.15)] text-accent
         px-1.5 py-0.5 rounded font-semibold;
}
.rank-acertos { @apply text-text-muted text-xs; }
.rank-acertos strong { @apply text-text-default; }
.rank-trend   { @apply text-xs font-semibold; }
.trend-up     { @apply text-green-400; }
.trend-down   { @apply text-red-400; }
.trend-same   { @apply text-text-muted; }
.rank-pts     { @apply text-base font-bold text-accent text-right tabular-nums; }

/* Pódio */
.podio-section {
  @apply flex gap-3 mb-6 items-end justify-center;
}
.podio-card {
  @apply bg-bg-card border-border rounded-xl p-4 text-center flex-1 max-w-[180px]
         relative border;
}
.podio-pos-1 {
  @apply border-accent bg-gradient-to-b from-[rgba(250,204,21,0.08)] to-bg-card -translate-y-2 pt-5;
}
.podio-pos-2 { @apply border-[#9ca3af]; }
.podio-pos-3 { @apply border-[#cd7c2e]; }
.podio-medal { @apply text-2xl mb-2; }
.podio-avatar {
  @apply w-11 h-11 rounded-full mx-auto mb-2 flex items-center justify-center
         font-bold text-base text-bg-dark;
}
.podio-nome  { @apply text-[13px] font-semibold mb-0.5 truncate; }
.podio-meta  { @apply text-[11px] text-text-muted mb-2; }
.podio-pts   { @apply text-xl font-bold text-accent tabular-nums; }
.podio-pts-label { @apply text-[10px] text-text-muted; }

/* Estado vazio */
.ranking-empty {
  @apply flex flex-col items-center justify-center py-16 gap-3 text-center;
}
.ranking-empty-icon  { @apply text-4xl; }
.ranking-empty-title { @apply text-lg font-semibold; }
.ranking-empty-sub   { @apply text-text-muted text-sm max-w-xs; }

/* Período banner (tab Rodada) */
.periodo-banner {
  @apply flex items-center gap-2.5 bg-[rgba(250,204,21,0.07)]
         border border-[rgba(250,204,21,0.15)] rounded-lg px-3.5 py-2.5 mb-4 text-[13px];
}
.periodo-banner-label { @apply text-accent font-semibold; }

/* Live dot */
.live-dot {
  @apply inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5
         animate-pulse align-middle;
}

/* Perfil público */
.perfil-publico { @apply max-w-lg mx-auto; }
.perfil-header  { @apply flex items-center gap-4 mb-6; }
.perfil-avatar  {
  @apply w-16 h-16 rounded-full flex items-center justify-center
         font-bold text-xl text-bg-dark shrink-0;
}
.perfil-nome    { @apply text-xl font-bold; }
.perfil-meta    { @apply text-text-muted text-sm; }
.perfil-kpis    { @apply grid grid-cols-3 gap-3 mb-6; }
.kpi            { @apply bg-bg-card border-border rounded-xl border p-4 text-center; }
.kpi-value      { @apply block text-2xl font-bold text-accent tabular-nums; }
.kpi-label      { @apply block text-[11px] text-text-muted mt-1 uppercase tracking-wide; }
.perfil-cashback {
  @apply bg-bg-card border-border rounded-xl border p-4 text-sm;
}
.perfil-cashback-valor { @apply text-text-muted; }
```

- [ ] **Verificar que o build não quebra**

```bash
npx next build 2>&1 | tail -20
```

Expected: `✓ Compiled` ou similar sem erros de CSS

- [ ] **Commit**

```bash
git add app/globals.css
git commit -m "feat(styles): add ranking CSS classes (F8)"
```

---

## Task 14: `DashboardNav` — habilitar link Ranking

**Files:**
- Modify: `components/dashboard/DashboardNav.tsx`
- Modify: `components/dashboard/DashboardNav.test.tsx`

- [ ] **Atualizar o array `PRINCIPAL` em `DashboardNav.tsx`**

```ts
// Linha atual:
{ label: 'Ranking', icon: Award, disabledHint: 'Em breve (F8)' },

// Substituir por:
{ label: 'Ranking', icon: Award, href: '/ranking' },
```

- [ ] **Atualizar o teste `DashboardNav.test.tsx`**

O teste atual lista 'Ranking' nos `disabledLabels`. Remover 'Ranking' de lá e adicionar assertiva de link:

```ts
// Remover 'Ranking' do array disabledLabels:
const disabledLabels = [
  'Meus Palpites',
  'Bônus',
  'Minhas Tabelas',
  'Cashback',
  'Configurações',
]

// Adicionar após o assert do link 'Comprar tabela':
expect(screen.getByRole('link', { name: /^ranking$/i })).toHaveAttribute('href', '/ranking')
```

- [ ] **Rodar os testes do DashboardNav**

```bash
npx vitest run components/dashboard/DashboardNav.test.tsx
```

Expected: PASS

- [ ] **Commit**

```bash
git add components/dashboard/DashboardNav.tsx components/dashboard/DashboardNav.test.tsx
git commit -m "feat(nav): enable Ranking link in DashboardNav (F8)"
```

---

## Task 15: Verificação final

- [ ] **Rodar toda a suíte de testes**

```bash
npx vitest run
```

Expected: todos os testes passando

- [ ] **Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero erros

- [ ] **Testar manualmente no browser**

1. `npx next dev` → abrir `http://localhost:3000`
2. Logar com magic link
3. Navegar para `/ranking` via sidebar
4. Verificar pódio (vazio = estado empty com CTA "Comprar tabela")
5. Verificar tab "Rodada" exibe label do período atual
6. Acessar `/ranking/[bilheteId]` de um bilhete confirmado — verificar KPIs + cashback
7. Acessar `/ranking/bilhete-inexistente` — verificar not-found

- [ ] **Commit final (se houver ajustes)**

```bash
git add -p
git commit -m "fix(ranking): address review items from manual testing (F8)"
```
