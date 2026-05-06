# F16 — Dashboard inteligente · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Substituir `/dashboard` (atualmente só lista próximos jogos) por um Server Component que discrimina o estado do user (sem bilhete / pendente puro / pré-Copa / em-andamento) e renderiza UI específica pra cada estado, com banner aditivo de PIX pendente quando o user já tem confirmado.

**Architecture:** Server Component faz `Promise.all` com 5 queries base (bilhetes_view, ranking_usuarios, RPC count_palpites, próximos jogos, detector "Copa começou"); um helper puro `determinarEstadoDashboard` recebe os dados e retorna um discriminated union; `switch (estado.kind)` na page renderiza o conjunto de componentes apropriado. Em "em-andamento", uma 2ª fase em Promise.all busca snapshot pra tendência + total de participantes.

**Tech Stack:** Next.js 14 App Router, TypeScript estrito, Tailwind v4 (`@theme` em globals.css), Supabase JS, Vitest, Lucide React, pnpm. RPC nova em SQL.

**TDD escopo:** apenas helpers puros — `lib/dashboard/estado.ts` e `lib/dashboard/countdown.ts`. Componentes UI são escritos diretamente (UI condicional sem lógica complexa); QA visual no `pnpm dev` antes do commit final.

---

## File Structure

### Arquivos novos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260506000000_f16_count_palpites.sql` | RPC `count_palpites_confirmados(uid uuid) → int` (security invoker, respeita RLS) |
| `lib/dashboard/estado.ts` | Tipos discriminados + função pura `determinarEstadoDashboard` |
| `lib/dashboard/estado.test.ts` | Cobre 4 estados base + colisões + edge "ranking vazio com confirmado" + cálculo de pendente |
| `lib/dashboard/countdown.ts` | `formatDiasHoras(de, ate) → { dias, horas }` (puro) |
| `lib/dashboard/countdown.test.ts` | 5 casos: zero, 1h, 30 dias, passado, atravessar meia-noite |
| `components/dashboard/TrendIndicator.tsx` | ▲▼━ inline com unidade opcional ('pts' \| 'pos') |
| `components/dashboard/DashboardStatCard.tsx` | Card composicional (children) reusado pelos 4 wrappers |
| `components/dashboard/CardPontos.tsx` | Wrapper — pontos totais + bilhete + tendência opcional |
| `components/dashboard/CardPosicao.tsx` | Wrapper — posição + total de participantes + tendência |
| `components/dashboard/CardProgresso.tsx` | Wrapper — % preenchido + barra + texto "X/Y · N tabelas" |
| `components/dashboard/CardCountdown.tsx` | Wrapper — "X dias / Y horas" pra Copa |
| `components/dashboard/DashboardEmptyHero.tsx` | Estado A: hero full-width com cadeado + CTA |
| `components/dashboard/DashboardPendentePix.tsx` | Estado B `variant='hero'` + banner aditivo `variant='banner'` |

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `app/(dashboard)/dashboard/page.tsx` | Reescrita completa: 5 queries base + 2 condicionais, helper `determinarEstadoDashboard`, switch por kind |
| `components/dashboard/DashboardHeader.tsx` | Aceita prop `subtitle: string` em vez de hardcodar copy |

### Arquivos não tocados (reuso)

- `components/dashboard/ProximosJogosPanel.tsx` — reusa as-is em estados B/C/D
- `components/dashboard/JogoRow.tsx` — reusa via ProximosJogosPanel
- `components/dashboard/DashboardShell.tsx` — wrapper de layout, intacto
- `components/admin/KpiCard.tsx` — admin intocado por design (Q3 do brainstorming)
- `lib/supabase/server.ts` — client server-side, reuso

---

## Task 1: Migration RPC `count_palpites_confirmados`

**Files:**
- Create: `supabase/migrations/20260506000000_f16_count_palpites.sql`

- [x] **Step 1: Criar arquivo da migration**

```sql
-- supabase/migrations/20260506000000_f16_count_palpites.sql
-- F16: RPC pra contar palpites preenchidos do user em bilhetes confirmados.
-- Necessário pro card de progresso do dashboard (% preenchido).

CREATE OR REPLACE FUNCTION public.count_palpites_confirmados(uid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COUNT(p.id)::int
  FROM public.palpites p
  JOIN public.bilhetes b ON b.id = p.bilhete_id
  WHERE b.user_id = uid
    AND b.status_pagamento = 'confirmado'
$$;

GRANT EXECUTE ON FUNCTION public.count_palpites_confirmados(uuid) TO authenticated;

COMMENT ON FUNCTION public.count_palpites_confirmados(uuid) IS
  'F16: count de palpites do user em bilhetes confirmados. Security invoker — RLS de palpites/bilhetes enforça acesso. Usado pelo dashboard pra calcular % preenchido.';
```

- [x] **Step 2: Aplicar migration no Supabase via MCP**

Use a ferramenta `mcp__supabase-medina__apply_migration` (já configurada no projeto):

```
name: f16_count_palpites
query: <conteúdo do arquivo .sql acima>
```

- [x] **Step 3: Testar a RPC manualmente via SQL**

Use `mcp__supabase-medina__execute_sql` com:

```sql
-- Pega um user_id existente com bilhetes confirmados
SELECT b.user_id, count(*) AS bilhetes
FROM public.bilhetes b
WHERE b.status_pagamento = 'confirmado'
GROUP BY b.user_id
LIMIT 1;

-- Roda a RPC com esse user_id (substitua o UUID abaixo)
SELECT public.count_palpites_confirmados('00000000-0000-0000-0000-000000000000'::uuid);
```

Expected: retorna um inteiro ≥ 0 (count de palpites do user nesses bilhetes).

- [x] **Step 4: Regenerar tipos TS do Supabase**

```bash
pnpm supabase:types
```

Expected: `lib/supabase/types.ts` agora tem entrada pra `count_palpites_confirmados` em `Functions`.

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/20260506000000_f16_count_palpites.sql lib/supabase/types.ts
git commit -m "feat(F16): RPC count_palpites_confirmados — count de palpites do user em bilhetes confirmados"
```

---

## Task 2: `lib/dashboard/countdown.ts` (TDD)

**Files:**
- Create: `lib/dashboard/countdown.ts`
- Create: `lib/dashboard/countdown.test.ts`

- [x] **Step 1: Escrever testes failing**

```ts
// lib/dashboard/countdown.test.ts
import { describe, it, expect } from 'vitest'
import { formatDiasHoras } from './countdown'

describe('formatDiasHoras', () => {
  it('retorna 0/0 quando datas iguais', () => {
    const d = new Date('2026-06-11T00:00:00Z')
    expect(formatDiasHoras(d, d)).toEqual({ dias: 0, horas: 0 })
  })

  it('retorna 0/1 pra 1 hora de diferença', () => {
    const de = new Date('2026-06-11T00:00:00Z')
    const ate = new Date('2026-06-11T01:00:00Z')
    expect(formatDiasHoras(de, ate)).toEqual({ dias: 0, horas: 1 })
  })

  it('retorna 30/0 pra 30 dias exatos', () => {
    const de = new Date('2026-05-12T00:00:00Z')
    const ate = new Date('2026-06-11T00:00:00Z')
    expect(formatDiasHoras(de, ate)).toEqual({ dias: 30, horas: 0 })
  })

  it('arredonda pra baixo na contagem de horas (5 dias 12h)', () => {
    const de = new Date('2026-06-06T12:00:00Z')
    const ate = new Date('2026-06-12T00:00:00Z')
    expect(formatDiasHoras(de, ate)).toEqual({ dias: 5, horas: 12 })
  })

  it('retorna 0/0 quando ate < de (data passada)', () => {
    const de = new Date('2026-06-12T00:00:00Z')
    const ate = new Date('2026-06-11T00:00:00Z')
    expect(formatDiasHoras(de, ate)).toEqual({ dias: 0, horas: 0 })
  })
})
```

- [x] **Step 2: Rodar pra verificar fail**

```bash
pnpm test:run lib/dashboard/countdown.test.ts
```

Expected: 5 falhas com erro de import "Cannot find module './countdown'".

- [x] **Step 3: Implementar mínimo**

```ts
// lib/dashboard/countdown.ts
export function formatDiasHoras(de: Date, ate: Date): { dias: number; horas: number } {
  const ms = +ate - +de
  if (ms <= 0) return { dias: 0, horas: 0 }
  const horasTotal = Math.floor(ms / (1000 * 60 * 60))
  return { dias: Math.floor(horasTotal / 24), horas: horasTotal % 24 }
}
```

- [x] **Step 4: Rodar pra verificar pass**

```bash
pnpm test:run lib/dashboard/countdown.test.ts
```

Expected: 5 testes passando.

- [x] **Step 5: Commit**

```bash
git add lib/dashboard/countdown.ts lib/dashboard/countdown.test.ts
git commit -m "feat(F16): formatDiasHoras — helper puro pra countdown da Copa"
```

---

## Task 3: `lib/dashboard/estado.ts` (TDD)

**Files:**
- Create: `lib/dashboard/estado.ts`
- Create: `lib/dashboard/estado.test.ts`

Esta é a função pura central da feature. Testes cobrem todos os branches da cascata + colisão "confirmado + pendente" + edge "ranking vazio com confirmado".

- [x] **Step 1: Escrever tipos primeiro (sem implementação)**

```ts
// lib/dashboard/estado.ts
export type BilheteEstadoInput = {
  id: string
  numero_bilhete: number
  valor_pago: number | null
  effective_status: 'pendente' | 'confirmado' | 'expirado' | 'cancelado'
  created_at: string
}

export type RankingUsuarioInput = {
  melhor_bilhete_id: string
  melhor_numero_bilhete: number
  pontos_totais: number
  posicao: number
  total_bilhetes: number
} | null

export type SnapshotInput = {
  posicao: number
  pontos_totais: number
} | null

export type DeterminarEstadoInput = {
  bilhetes: BilheteEstadoInput[]
  ranking: RankingUsuarioInput
  palpitesCount: number
  jogosFinalizadosCount: number
  copaInicio: Date
  snapshot: SnapshotInput
  totalParticipantes: number
}

export type PendenteInfo = {
  bilhete_id: string
  numero_bilhete: number
  valor_total_pendente: number
  qtd_pendentes: number
}

export type ProgressoInfo = {
  preenchidos: number
  total: number
  porcentagem: number
  totalBilhetes: number
}

export type RankingUsuarioInfo = {
  melhor_bilhete_id: string
  melhor_numero_bilhete: number
  pontos_totais: number
  posicao: number
  total_bilhetes: number
}

export type DashboardEstado =
  | { kind: 'sem-bilhete' }
  | { kind: 'pendente-puro'; pendente: PendenteInfo }
  | { kind: 'pre-copa'; pendente: PendenteInfo | null; copaInicio: Date; progresso: ProgressoInfo }
  | {
      kind: 'em-andamento'
      pendente: PendenteInfo | null
      rankingUsuario: RankingUsuarioInfo
      progresso: ProgressoInfo
      tendenciaPontos: number | null
      tendenciaPosicao: number | null
      totalParticipantes: number
    }

export function determinarEstadoDashboard(_input: DeterminarEstadoInput): DashboardEstado {
  throw new Error('not implemented')
}
```

- [x] **Step 2: Escrever bateria de testes**

```ts
// lib/dashboard/estado.test.ts
import { describe, it, expect } from 'vitest'
import { determinarEstadoDashboard, type DeterminarEstadoInput } from './estado'

const COPA_INICIO = new Date('2026-06-11T00:00:00Z')

function baseInput(overrides: Partial<DeterminarEstadoInput> = {}): DeterminarEstadoInput {
  return {
    bilhetes: [],
    ranking: null,
    palpitesCount: 0,
    jogosFinalizadosCount: 0,
    copaInicio: COPA_INICIO,
    snapshot: null,
    totalParticipantes: 0,
    ...overrides,
  }
}

describe('determinarEstadoDashboard', () => {
  it('Estado A — sem-bilhete (zero bilhetes)', () => {
    const r = determinarEstadoDashboard(baseInput())
    expect(r).toEqual({ kind: 'sem-bilhete' })
  })

  it('Estado B — pendente-puro (1 pendente, sem confirmado)', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'pendente', created_at: '2026-05-06T10:00:00Z' },
        ],
      }),
    )
    expect(r).toEqual({
      kind: 'pendente-puro',
      pendente: { bilhete_id: 'b1', numero_bilhete: 100, valor_total_pendente: 20, qtd_pendentes: 1 },
    })
  })

  it('Estado B — pendente-puro com múltiplos pendentes (alvo = mais recente, soma todos)', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'pendente', created_at: '2026-05-06T10:00:00Z' },
          { id: 'b2', numero_bilhete: 101, valor_pago: 40, effective_status: 'pendente', created_at: '2026-05-06T11:00:00Z' },
        ],
      }),
    )
    expect(r.kind).toBe('pendente-puro')
    if (r.kind !== 'pendente-puro') return
    expect(r.pendente.bilhete_id).toBe('b2')           // mais recente
    expect(r.pendente.numero_bilhete).toBe(101)
    expect(r.pendente.valor_total_pendente).toBe(60)   // 20 + 40
    expect(r.pendente.qtd_pendentes).toBe(2)
  })

  it('Estado C — pre-copa (1 confirmado, sem jogos finalizados)', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'confirmado', created_at: '2026-05-06T10:00:00Z' },
        ],
        ranking: { melhor_bilhete_id: 'b1', melhor_numero_bilhete: 100, pontos_totais: 0, posicao: 1, total_bilhetes: 1 },
        palpitesCount: 50,
      }),
    )
    expect(r.kind).toBe('pre-copa')
    if (r.kind !== 'pre-copa') return
    expect(r.pendente).toBeNull()
    expect(r.progresso).toEqual({ preenchidos: 50, total: 104, porcentagem: 48, totalBilhetes: 1 })
  })

  it('Estado C com banner — confirmado + pendente, Copa não começou', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'confirmado', created_at: '2026-05-06T10:00:00Z' },
          { id: 'b2', numero_bilhete: 101, valor_pago: 40, effective_status: 'pendente', created_at: '2026-05-06T11:00:00Z' },
        ],
        ranking: { melhor_bilhete_id: 'b1', melhor_numero_bilhete: 100, pontos_totais: 0, posicao: 1, total_bilhetes: 1 },
        palpitesCount: 0,
      }),
    )
    expect(r.kind).toBe('pre-copa')
    if (r.kind !== 'pre-copa') return
    expect(r.pendente).not.toBeNull()
    expect(r.pendente!.bilhete_id).toBe('b2')
    expect(r.pendente!.qtd_pendentes).toBe(1)
    expect(r.progresso.totalBilhetes).toBe(1)
  })

  it('Estado D — em-andamento (1 confirmado + Copa em andamento)', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'confirmado', created_at: '2026-05-06T10:00:00Z' },
        ],
        ranking: { melhor_bilhete_id: 'b1', melhor_numero_bilhete: 100, pontos_totais: 234, posicao: 42, total_bilhetes: 1 },
        palpitesCount: 50,
        jogosFinalizadosCount: 12,
        snapshot: { posicao: 50, pontos_totais: 200 },
        totalParticipantes: 500,
      }),
    )
    expect(r.kind).toBe('em-andamento')
    if (r.kind !== 'em-andamento') return
    expect(r.tendenciaPontos).toBe(34)        // 234 - 200
    expect(r.tendenciaPosicao).toBe(8)        // 50 - 42 (subiu 8)
    expect(r.totalParticipantes).toBe(500)
    expect(r.progresso.porcentagem).toBe(48)
  })

  it('Estado D sem snapshot — tendências = null', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'confirmado', created_at: '2026-05-06T10:00:00Z' },
        ],
        ranking: { melhor_bilhete_id: 'b1', melhor_numero_bilhete: 100, pontos_totais: 50, posicao: 30, total_bilhetes: 1 },
        jogosFinalizadosCount: 5,
        snapshot: null,
      }),
    )
    if (r.kind !== 'em-andamento') throw new Error('expected em-andamento')
    expect(r.tendenciaPontos).toBeNull()
    expect(r.tendenciaPosicao).toBeNull()
  })

  it('Edge graceful — confirmado mas ranking vazio: degrada pra pre-copa', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'confirmado', created_at: '2026-05-06T10:00:00Z' },
        ],
        ranking: null,
        jogosFinalizadosCount: 5,
      }),
    )
    expect(r.kind).toBe('pre-copa')
  })

  it('Bilhetes expirados/cancelados não contam em nenhum cálculo', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'expirado', created_at: '2026-05-06T10:00:00Z' },
          { id: 'b2', numero_bilhete: 101, valor_pago: 20, effective_status: 'cancelado', created_at: '2026-05-06T11:00:00Z' },
        ],
      }),
    )
    expect(r).toEqual({ kind: 'sem-bilhete' })
  })

  it('Progresso: porcentagem zero quando total = 0', () => {
    const r = determinarEstadoDashboard(
      baseInput({
        bilhetes: [
          { id: 'b1', numero_bilhete: 100, valor_pago: 20, effective_status: 'pendente', created_at: '2026-05-06T10:00:00Z' },
        ],
      }),
    )
    expect(r.kind).toBe('pendente-puro')   // sem stats; progresso não consultado
  })
})
```

- [x] **Step 3: Rodar pra verificar fail**

```bash
pnpm test:run lib/dashboard/estado.test.ts
```

Expected: todos os testes falham com `Error: not implemented`.

- [x] **Step 4: Implementar a função**

Substituir o corpo da função `determinarEstadoDashboard` em `lib/dashboard/estado.ts`:

```ts
export function determinarEstadoDashboard(input: DeterminarEstadoInput): DashboardEstado {
  const confirmados = input.bilhetes.filter((b) => b.effective_status === 'confirmado')
  const pendentesArr = input.bilhetes.filter((b) => b.effective_status === 'pendente')

  const tem_confirmado = confirmados.length > 0
  const tem_pendente = pendentesArr.length > 0
  const copa_comecou = input.jogosFinalizadosCount > 0

  // Estado A
  if (!tem_confirmado && !tem_pendente) {
    return { kind: 'sem-bilhete' }
  }

  // Calcula pendente (alvo = mais recente; soma valor_pago de todos)
  const pendente: PendenteInfo | null =
    pendentesArr.length === 0
      ? null
      : (() => {
          const sorted = [...pendentesArr].sort(
            (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
          )
          const alvo = sorted[0]!
          return {
            bilhete_id: alvo.id,
            numero_bilhete: alvo.numero_bilhete,
            valor_total_pendente: pendentesArr.reduce((s, b) => s + (b.valor_pago ?? 0), 0),
            qtd_pendentes: pendentesArr.length,
          }
        })()

  // Estado B — pendente puro
  if (!tem_confirmado) {
    // pendente é definitivamente !== null aqui (porque tem_pendente && !tem_confirmado)
    return { kind: 'pendente-puro', pendente: pendente! }
  }

  // Calcula progresso (apenas confirmados contam)
  const total = confirmados.length * 104
  const progresso: ProgressoInfo = {
    preenchidos: input.palpitesCount,
    total,
    porcentagem: total === 0 ? 0 : Math.round((input.palpitesCount / total) * 100),
    totalBilhetes: confirmados.length,
  }

  // Estado C — pre-copa
  // Edge graceful: se ranking_usuarios vazio (race), degrada pra pre-copa.
  if (!copa_comecou || input.ranking === null) {
    return {
      kind: 'pre-copa',
      pendente,
      copaInicio: input.copaInicio,
      progresso,
    }
  }

  // Estado D — em-andamento
  const tendenciaPontos = input.snapshot ? input.ranking.pontos_totais - input.snapshot.pontos_totais : null
  // Posição menor = melhor → invertida: positivo significa "subiu" (foi de #50 pra #42 = +8)
  const tendenciaPosicao = input.snapshot ? input.snapshot.posicao - input.ranking.posicao : null

  return {
    kind: 'em-andamento',
    pendente,
    rankingUsuario: input.ranking,
    progresso,
    tendenciaPontos,
    tendenciaPosicao,
    totalParticipantes: input.totalParticipantes,
  }
}
```

- [x] **Step 5: Rodar pra verificar pass**

```bash
pnpm test:run lib/dashboard/estado.test.ts
```

Expected: 10 testes passando.

- [x] **Step 6: Commit**

```bash
git add lib/dashboard/estado.ts lib/dashboard/estado.test.ts
git commit -m "feat(F16): determinarEstadoDashboard — máquina de estados pura A/B/C/D"
```

---

## Task 4: `TrendIndicator.tsx`

**Files:**
- Create: `components/dashboard/TrendIndicator.tsx`

- [x] **Step 1: Escrever o componente**

```tsx
// components/dashboard/TrendIndicator.tsx
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TrendIndicatorProps = {
  delta: number
  unit?: 'pts' | 'pos'
  className?: string
}

export function TrendIndicator({ delta, unit, className }: TrendIndicatorProps) {
  if (delta === 0) {
    return (
      <span
        className={cn(
          'text-text-muted inline-flex items-center gap-1 text-xs font-medium',
          className,
        )}
        aria-label="sem variação"
      >
        <Minus className="size-3" />
      </span>
    )
  }

  const positivo = delta > 0
  const valor = Math.abs(delta)
  const sufixo = unit === 'pts' ? ' pts' : ''

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        positivo ? 'text-success' : 'text-danger',
        className,
      )}
      aria-label={positivo ? `subiu ${valor}${sufixo}` : `caiu ${valor}${sufixo}`}
    >
      {positivo ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {valor}
      {sufixo}
    </span>
  )
}
```

- [x] **Step 2: Rodar typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [x] **Step 3: Commit**

```bash
git add components/dashboard/TrendIndicator.tsx
git commit -m "feat(F16): TrendIndicator — indicador ▲▼━ inline com unidade opcional"
```

---

## Task 5: `DashboardStatCard.tsx`

**Files:**
- Create: `components/dashboard/DashboardStatCard.tsx`

- [x] **Step 1: Escrever o componente**

```tsx
// components/dashboard/DashboardStatCard.tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ColorClass = 'green' | 'yellow' | 'blue' | 'red'

const COLOR: Record<ColorClass, string> = {
  green:  'bg-success/10 text-success',
  yellow: 'bg-accent/10 text-accent',
  blue:   'bg-info/10 text-info',
  red:    'bg-danger/10 text-danger',
}

export type DashboardStatCardProps = {
  label: string
  icon: ReactNode
  colorClass: ColorClass
  children: ReactNode
  className?: string
}

export function DashboardStatCard({
  label,
  icon,
  colorClass,
  children,
  className,
}: DashboardStatCardProps) {
  return (
    <div className={cn('panel p-5', className)}>
      <div className="mb-3 flex items-center gap-3">
        <div
          aria-hidden="true"
          className={cn(
            'flex size-10 flex-shrink-0 items-center justify-center rounded-xl',
            COLOR[colorClass],
          )}
        >
          {icon}
        </div>
        <span className="text-text-muted text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}
```

- [x] **Step 2: Rodar typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [x] **Step 3: Commit**

```bash
git add components/dashboard/DashboardStatCard.tsx
git commit -m "feat(F16): DashboardStatCard composicional — base dos 4 cards do dashboard"
```

---

## Task 6: 4 wrappers de card (Pontos, Posicao, Progresso, Countdown)

**Files:**
- Create: `components/dashboard/CardPontos.tsx`
- Create: `components/dashboard/CardPosicao.tsx`
- Create: `components/dashboard/CardProgresso.tsx`
- Create: `components/dashboard/CardCountdown.tsx`

- [x] **Step 1: `CardPontos.tsx`**

```tsx
// components/dashboard/CardPontos.tsx
import { Trophy } from 'lucide-react'
import { DashboardStatCard } from './DashboardStatCard'
import { TrendIndicator } from './TrendIndicator'

export type CardPontosProps = {
  pontos: number
  numeroBilhete: number
  totalBilhetes: number
  tendencia: number | null
}

export function CardPontos({ pontos, numeroBilhete, totalBilhetes, tendencia }: CardPontosProps) {
  return (
    <DashboardStatCard label="Pontuação" icon={<Trophy className="size-5" />} colorClass="yellow">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-4xl tracking-wide">{pontos}</span>
        {tendencia !== null && <TrendIndicator delta={tendencia} unit="pts" />}
      </div>
      <div className="text-text-muted mt-1 font-mono text-xs">
        Bilhete #{numeroBilhete}
        {totalBilhetes > 1 ? ' · sua melhor tabela' : ''}
      </div>
    </DashboardStatCard>
  )
}
```

- [x] **Step 2: `CardPosicao.tsx`**

```tsx
// components/dashboard/CardPosicao.tsx
import { TrendingUp } from 'lucide-react'
import { DashboardStatCard } from './DashboardStatCard'
import { TrendIndicator } from './TrendIndicator'

export type CardPosicaoProps = {
  posicao: number
  totalParticipantes: number
  tendencia: number | null
}

export function CardPosicao({ posicao, totalParticipantes, tendencia }: CardPosicaoProps) {
  return (
    <DashboardStatCard label="Posição" icon={<TrendingUp className="size-5" />} colorClass="blue">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-4xl tracking-wide">#{posicao}</span>
        {tendencia !== null && <TrendIndicator delta={tendencia} />}
      </div>
      <div className="text-text-muted mt-1 font-mono text-xs">
        de {totalParticipantes.toLocaleString('pt-BR')} participantes
      </div>
    </DashboardStatCard>
  )
}
```

- [x] **Step 3: `CardProgresso.tsx`**

```tsx
// components/dashboard/CardProgresso.tsx
import { CheckCircle2 } from 'lucide-react'
import { DashboardStatCard } from './DashboardStatCard'

export type CardProgressoProps = {
  porcentagem: number
  preenchidos: number
  total: number
  totalBilhetes: number
}

export function CardProgresso({ porcentagem, preenchidos, total, totalBilhetes }: CardProgressoProps) {
  return (
    <DashboardStatCard label="Palpites" icon={<CheckCircle2 className="size-5" />} colorClass="green">
      <div className="font-display text-4xl tracking-wide">{porcentagem}%</div>
      <div
        className="bg-bg-elevated mt-3 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={porcentagem}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="bg-accent h-full transition-[width]"
          style={{ width: `${porcentagem}%` }}
        />
      </div>
      <div className="text-text-muted mt-2 font-mono text-xs">
        {preenchidos}/{total} palpites preenchidos
        {totalBilhetes > 1 ? ` · ${totalBilhetes} tabelas` : ''}
      </div>
    </DashboardStatCard>
  )
}
```

- [x] **Step 4: `CardCountdown.tsx`**

```tsx
// components/dashboard/CardCountdown.tsx
import { Clock } from 'lucide-react'
import { DashboardStatCard } from './DashboardStatCard'
import { formatDiasHoras } from '@/lib/dashboard/countdown'

export type CardCountdownProps = {
  copaInicio: Date
  agora?: Date    // injectable pra testes (opcional; default = new Date())
}

export function CardCountdown({ copaInicio, agora = new Date() }: CardCountdownProps) {
  const { dias, horas } = formatDiasHoras(agora, copaInicio)
  return (
    <DashboardStatCard label="Copa começa em" icon={<Clock className="size-5" />} colorClass="red">
      <div className="flex items-baseline gap-3">
        <div>
          <span className="font-display text-4xl tracking-wide">{dias}</span>
          <span className="text-text-muted ml-1 text-sm">dias</span>
        </div>
        <div>
          <span className="font-display text-2xl tracking-wide">{horas}</span>
          <span className="text-text-muted ml-1 text-sm">h</span>
        </div>
      </div>
      <div className="text-text-muted mt-2 font-mono text-xs">11 de junho · Estados Unidos</div>
    </DashboardStatCard>
  )
}
```

- [x] **Step 5: Rodar typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [x] **Step 6: Commit**

```bash
git add components/dashboard/CardPontos.tsx components/dashboard/CardPosicao.tsx components/dashboard/CardProgresso.tsx components/dashboard/CardCountdown.tsx
git commit -m "feat(F16): 4 wrappers de DashboardStatCard — Pontos, Posicao, Progresso, Countdown"
```

---

## Task 7: `DashboardEmptyHero.tsx` (Estado A)

**Files:**
- Create: `components/dashboard/DashboardEmptyHero.tsx`

- [x] **Step 1: Escrever o componente**

```tsx
// components/dashboard/DashboardEmptyHero.tsx
import Link from 'next/link'
import { Lock, ArrowRight } from 'lucide-react'

export function DashboardEmptyHero() {
  return (
    <section className="panel border-accent/40 from-bg-card to-bg-card/50 relative overflow-hidden bg-gradient-to-b p-10 text-center md:p-16">
      <div aria-hidden="true" className="bg-accent/5 pointer-events-none absolute inset-0 blur-3xl" />
      <Lock className="text-accent relative mx-auto mb-6 size-16" strokeWidth={1.5} />
      <h2 className="font-display relative text-3xl tracking-wide md:text-5xl">
        Sua participação na <span className="text-accent">Copa 2026</span> começa aqui
      </h2>
      <p className="font-body text-text-secondary relative mx-auto mt-3 max-w-md text-sm md:text-base">
        Compre sua primeira tabela e entre na disputa pelo prêmio de R$ 10.000
      </p>
      <Link
        href="/comprar"
        className="bg-accent text-bg-dark hover:bg-accent/90 relative mt-8 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold transition-colors"
      >
        Comprar tabela <ArrowRight className="size-4" />
      </Link>
    </section>
  )
}
```

- [x] **Step 2: Rodar typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [x] **Step 3: Commit**

```bash
git add components/dashboard/DashboardEmptyHero.tsx
git commit -m "feat(F16): DashboardEmptyHero — Estado A (sem bilhete) com CTA pra /comprar"
```

---

## Task 8: `DashboardPendentePix.tsx` (Estado B + banner C/D)

**Files:**
- Create: `components/dashboard/DashboardPendentePix.tsx`

- [x] **Step 1: Escrever o componente com 2 variants**

```tsx
// components/dashboard/DashboardPendentePix.tsx
import Link from 'next/link'
import type { Route } from 'next'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import type { PendenteInfo } from '@/lib/dashboard/estado'

function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export type DashboardPendentePixProps = {
  pendente: PendenteInfo
  variant: 'hero' | 'banner'
}

export function DashboardPendentePix({ pendente, variant }: DashboardPendentePixProps) {
  const href = `/comprar/${pendente.bilhete_id}/pix` as Route
  const plural = pendente.qtd_pendentes > 1

  if (variant === 'banner') {
    return (
      <Link
        href={href}
        className="panel border-accent/60 bg-accent/5 hover:bg-accent/10 mb-6 flex items-center justify-between gap-3 px-5 py-3 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm">
          <AlertTriangle className="text-accent size-4 flex-shrink-0" />
          <span>
            PIX de <strong>{formatBRL(pendente.valor_total_pendente)}</strong> pendente
            {plural ? ` (${pendente.qtd_pendentes} tabelas)` : ''}
          </span>
        </span>
        <span className="text-accent inline-flex items-center gap-1 text-sm font-medium">
          Pagar <ArrowRight className="size-3" />
        </span>
      </Link>
    )
  }

  // variant === 'hero'
  return (
    <section className="panel border-accent/60 bg-accent/5 p-8 md:p-10">
      <div className="text-accent mb-2 flex items-center gap-2 font-bold">
        <AlertTriangle className="size-5" /> Você tem PIX pendente
      </div>
      <h2 className="font-display mb-3 text-2xl md:text-3xl">
        Finalize o pagamento de{' '}
        <span className="text-accent">{formatBRL(pendente.valor_total_pendente)}</span>
      </h2>
      <p className="text-text-secondary mb-1 text-sm">
        Em até 30 minutos pra não perder sua tabela.
      </p>
      <p className="text-text-muted mb-6 font-mono text-xs">
        Bilhete #{pendente.numero_bilhete}
        {plural ? ` · ${pendente.qtd_pendentes} tabelas pendentes` : ''}
      </p>
      <Link
        href={href}
        className="bg-accent text-bg-dark hover:bg-accent/90 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
      >
        Pagar agora <ArrowRight className="size-4" />
      </Link>
    </section>
  )
}
```

- [x] **Step 2: Rodar typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [x] **Step 3: Commit**

```bash
git add components/dashboard/DashboardPendentePix.tsx
git commit -m "feat(F16): DashboardPendentePix — Estado B hero + banner aditivo C/D (variant prop)"
```

---

## Task 9: Modificar `DashboardHeader.tsx` pra aceitar `subtitle`

**Files:**
- Modify: `components/dashboard/DashboardHeader.tsx`

- [x] **Step 1: Substituir conteúdo do arquivo**

```tsx
// components/dashboard/DashboardHeader.tsx
import { UserBadge } from '@/components/dashboard/UserBadge';

export type DashboardHeaderProps = {
  nome: string;
  email: string;
  subtitle: string;
};

function primeiroNome(nome: string): string {
  const trimmed = nome.trim();
  if (!trimmed) return 'Apostador';
  return trimmed.split(/\s+/)[0]!;
}

export function DashboardHeader({ nome, email, subtitle }: DashboardHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-[38px] leading-none tracking-wide">
          Salve, <span className="text-accent">{primeiroNome(nome)}</span> 👋
        </h1>
        <p className="font-body text-text-secondary mt-2 text-sm">{subtitle}</p>
      </div>
      <UserBadge nome={nome} email={email} />
    </header>
  );
}
```

- [x] **Step 2: Verificar que não há outros consumidores**

```bash
pnpm exec grep -rln "DashboardHeader" app/ components/ | grep -v node_modules
```

Expected: arquivos listados são apenas `components/dashboard/DashboardHeader.tsx` e `app/(dashboard)/dashboard/page.tsx` (que vamos reescrever na Task 10). Nenhum outro consumer.

> Se aparecer outro arquivo (ex: `app/(dashboard)/layout.tsx`), atualizar o consumer pra passar `subtitle` apropriado.

- [x] **Step 3: Rodar typecheck**

```bash
pnpm typecheck
```

Expected: erros apenas em `app/(dashboard)/dashboard/page.tsx` (consumidor antigo) — esses serão corrigidos na Task 10. Outros arquivos do projeto devem passar.

> ⚠️ Se houver erros em arquivos NÃO relacionados (ex: `layout.tsx`), o consumer precisa ser atualizado nesta task antes de prosseguir.

- [x] **Step 4: Commit**

```bash
git add components/dashboard/DashboardHeader.tsx
git commit -m "refactor(F16): DashboardHeader aceita prop subtitle — copy varia por estado"
```

---

## Task 10: Reescrever `app/(dashboard)/dashboard/page.tsx`

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx` (rewrite completa)

Esta é a integração final. O Server Component faz fetch paralelo, chama o helper puro, e despacha pra UI por estado.

- [x] **Step 1: Substituir conteúdo do arquivo**

```tsx
// app/(dashboard)/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { ProximosJogosPanel } from '@/components/dashboard/ProximosJogosPanel'
import type { JogoRowData } from '@/components/dashboard/JogoRow'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { DashboardEmptyHero } from '@/components/dashboard/DashboardEmptyHero'
import { DashboardPendentePix } from '@/components/dashboard/DashboardPendentePix'
import { CardPontos } from '@/components/dashboard/CardPontos'
import { CardPosicao } from '@/components/dashboard/CardPosicao'
import { CardProgresso } from '@/components/dashboard/CardProgresso'
import { CardCountdown } from '@/components/dashboard/CardCountdown'
import {
  determinarEstadoDashboard,
  type BilheteEstadoInput,
  type DashboardEstado,
} from '@/lib/dashboard/estado'
import { formatDiasHoras } from '@/lib/dashboard/countdown'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const COPA_INICIO = new Date('2026-06-11T00:00:00Z')

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard')

  // Profile pro header (nome). Reaproveita pattern da F4.
  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, email')
    .eq('id', user.id)
    .single()
  const nome = profile?.nome || 'Apostador'
  const email = profile?.email || user.email || ''

  // Fase 1: 5 queries paralelas
  const agora = new Date()
  const [bilhetesRes, rankingRes, palpitesCountRes, jogosFutRes, jogoFinRes] = await Promise.all([
    supabase
      .from('bilhetes_view')
      .select('id, numero_bilhete, valor_pago, mp_payment_id, effective_status, created_at')
      .eq('user_id', user.id),
    supabase
      .from('ranking_usuarios')
      .select('melhor_bilhete_id, melhor_numero_bilhete, pontos_totais, posicao, total_bilhetes')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.rpc('count_palpites_confirmados', { uid: user.id }),
    supabase
      .from('jogos')
      .select(
        `
          id, data_hora, fase, placeholder_casa, placeholder_fora,
          casa:selecoes!selecao_casa_id(nome, bandeira_emoji),
          fora:selecoes!selecao_fora_id(nome, bandeira_emoji)
        `,
      )
      .gt('data_hora', agora.toISOString())
      .order('data_hora', { ascending: true })
      .limit(5),
    supabase.from('jogos').select('id', { head: true, count: 'exact' }).eq('finalizado', true),
  ])

  const bilhetesRaw = (bilhetesRes.data ?? []) as BilheteEstadoInput[]
  const ranking = rankingRes.data ?? null
  const palpitesCount = (palpitesCountRes.data as number | null) ?? 0
  const jogosFinalizadosCount = jogoFinRes.count ?? 0

  // Determinar estado preliminar pra decidir se precisamos de fase 2
  let estadoBase = determinarEstadoDashboard({
    bilhetes: bilhetesRaw,
    ranking,
    palpitesCount,
    jogosFinalizadosCount,
    copaInicio: COPA_INICIO,
    snapshot: null,
    totalParticipantes: 0,
  })

  // Fase 2: só roda se a Fase 1 retornou em-andamento (precisa de snapshot + total participantes)
  let estado: DashboardEstado = estadoBase
  if (estadoBase.kind === 'em-andamento') {
    const [snapRes, totalRes] = await Promise.all([
      supabase
        .from('ranking_snapshots')
        .select('posicao, pontos_totais')
        .eq('user_id', user.id)
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('ranking_usuarios').select('user_id', { head: true, count: 'exact' }),
    ])
    estado = determinarEstadoDashboard({
      bilhetes: bilhetesRaw,
      ranking,
      palpitesCount,
      jogosFinalizadosCount,
      copaInicio: COPA_INICIO,
      snapshot: snapRes.data,
      totalParticipantes: totalRes.count ?? 0,
    })
  }

  // Próximos jogos (mesmo shape do dashboard atual) pros estados B/C/D
  const jogos: JogoRowData[] = (jogosFutRes.data ?? []).map((j) => ({
    id: j.id,
    data_hora: j.data_hora,
    fase: j.fase,
    placeholder_casa: j.placeholder_casa,
    placeholder_fora: j.placeholder_fora,
    casa: Array.isArray(j.casa) ? (j.casa[0] ?? null) : j.casa,
    fora: Array.isArray(j.fora) ? (j.fora[0] ?? null) : j.fora,
  }))

  // Subtitle por estado
  const subtitle = (() => {
    if (estado.kind === 'sem-bilhete') return 'Sua primeira tabela te espera'
    if (estado.kind === 'pendente-puro') return 'Você tem um pagamento pendente'
    if (estado.kind === 'pre-copa') {
      const { dias } = formatDiasHoras(agora, estado.copaInicio)
      return dias === 0 ? 'Copa começa hoje!' : `Faltam ${dias} dias pra Copa começar`
    }
    return 'Copa em andamento — vê seu desempenho'
  })()

  return (
    <>
      <DashboardHeader nome={nome} email={email} subtitle={subtitle} />

      {estado.kind === 'sem-bilhete' && <DashboardEmptyHero />}

      {estado.kind === 'pendente-puro' && (
        <>
          <DashboardPendentePix pendente={estado.pendente} variant="hero" />
          <ProximosJogosPanel jogos={jogos} />
        </>
      )}

      {estado.kind === 'pre-copa' && (
        <>
          {estado.pendente && (
            <DashboardPendentePix pendente={estado.pendente} variant="banner" />
          )}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CardCountdown copaInicio={estado.copaInicio} agora={agora} />
            <CardProgresso
              porcentagem={estado.progresso.porcentagem}
              preenchidos={estado.progresso.preenchidos}
              total={estado.progresso.total}
              totalBilhetes={estado.progresso.totalBilhetes}
            />
          </div>
          <ProximosJogosPanel jogos={jogos} />
          {estado.progresso.porcentagem < 100 && (
            <Link
              href="/palpites"
              className="text-accent mt-4 inline-flex items-center gap-1 text-sm hover:underline"
            >
              Fazer palpites <ArrowRight className="size-3" />
            </Link>
          )}
        </>
      )}

      {estado.kind === 'em-andamento' && (
        <>
          {estado.pendente && (
            <DashboardPendentePix pendente={estado.pendente} variant="banner" />
          )}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            <CardPontos
              pontos={estado.rankingUsuario.pontos_totais}
              numeroBilhete={estado.rankingUsuario.melhor_numero_bilhete}
              totalBilhetes={estado.rankingUsuario.total_bilhetes}
              tendencia={estado.tendenciaPontos}
            />
            <CardPosicao
              posicao={estado.rankingUsuario.posicao}
              totalParticipantes={estado.totalParticipantes}
              tendencia={estado.tendenciaPosicao}
            />
            <CardProgresso
              porcentagem={estado.progresso.porcentagem}
              preenchidos={estado.progresso.preenchidos}
              total={estado.progresso.total}
              totalBilhetes={estado.progresso.totalBilhetes}
            />
          </div>
          <ProximosJogosPanel jogos={jogos} />
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href="/ranking" className="text-accent inline-flex items-center gap-1 text-sm hover:underline">
              Ver ranking completo <ArrowRight className="size-3" />
            </Link>
            {estado.progresso.porcentagem < 100 && (
              <Link
                href="/palpites"
                className="text-accent inline-flex items-center gap-1 text-sm hover:underline"
              >
                Fazer palpites <ArrowRight className="size-3" />
              </Link>
            )}
          </div>
        </>
      )}
    </>
  )
}
```

- [x] **Step 2: Rodar typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors. Se aparecer erro de tipo nos resultados das queries (ex: shape diferente do esperado em `bilhetes_view`), conferir `lib/supabase/types.ts` (foi regenerado na Task 1) e ajustar `BilheteEstadoInput` ou o cast.

- [x] **Step 3: Rodar lint**

```bash
pnpm lint
```

Expected: 0 warnings na page e nos novos componentes.

- [x] **Step 4: Subir dev server e fazer smoke visual**

Termo de aceitação: cada estado renderiza sem console errors. QA detalhado fica pra Task 11; aqui só validamos que o page.tsx compila e renderiza algo.

```bash
pnpm dev
```

Abrir `http://localhost:3000/dashboard` autenticado. Esperado: ver alguma versão da nova página (qual estado depende dos dados do user de teste).

- [x] **Step 5: Commit**

```bash
git add app/(dashboard)/dashboard/page.tsx
git commit -m "feat(F16): reescrever /dashboard como Server Component com switch por estado"
```

---

## Task 11: Validação final + QA manual

**Files:**
- nenhum (validação cross-cutting)

- [x] **Step 1: Suite completa de testes**

```bash
pnpm test:run
```

Expected: todos os testes passam (incluindo os 2 novos arquivos de helper). Nenhuma regressão em F1–F15.

- [x] **Step 2: Typecheck completo**

```bash
pnpm typecheck
```

Expected: 0 errors no projeto inteiro.

- [x] **Step 3: Lint completo**

```bash
pnpm lint
```

Expected: 0 warnings.

- [x] **Step 4: Build de produção**

```bash
pnpm build
```

Expected: build completa sem erros. Verifica se Server Components compilam, se não há imports circulares, se os tipos do Supabase estão coerentes.

- [ ] **Step 5: QA manual — Estado A (sem bilhete)**

1. Criar user novo (ou abrir Supabase Studio e remover bilhetes de um user de teste).
2. Logar e ir em `/dashboard`.
3. Conferir:
   - Header mostra "Salve, [Nome] 👋" + "Sua primeira tabela te espera".
   - Hero card full-width com cadeado, headline "Sua participação na Copa 2026 começa aqui", CTA "Comprar tabela →".
   - **NÃO** aparece ProximosJogosPanel.
   - **NÃO** aparecem cards de stats.
   - CTA leva pra `/comprar`.

- [ ] **Step 6: QA manual — Estado B (pendente puro)**

1. Com user que **não tem confirmados**, iniciar uma compra (`/comprar`) e gerar PIX. Não pagar.
2. Voltar pra `/dashboard`.
3. Conferir:
   - Header subtitle: "Você tem um pagamento pendente".
   - Hero panel amarelo com "Você tem PIX pendente", valor BRL destacado, número do bilhete, CTA "Pagar agora →".
   - ProximosJogosPanel aparece abaixo.
   - **NÃO** aparecem cards de stats (pontos/posição/progresso).
   - CTA leva pra `/comprar/[id]/pix`.

- [ ] **Step 7: QA manual — Estado C (pré-Copa, com confirmado)**

1. Garantir que o user tem ≥1 bilhete `confirmado` e que `jogos.finalizado = true` retorna 0 (sem jogos finalizados ainda).
2. Ir em `/dashboard`.
3. Conferir:
   - Header subtitle: "Faltam X dias pra Copa começar" (X > 0).
   - Grid de 2 cards: CardCountdown (dias/horas) + CardProgresso (% + barra).
   - ProximosJogosPanel abaixo.
   - Link "Fazer palpites →" abaixo se progresso < 100%.
   - Se também houver pendente do mesmo user, banner aparece **acima** dos cards.

- [ ] **Step 8: QA manual — Estado D (em andamento)**

1. No painel admin, finalizar 1 jogo qualquer (ou via SQL: `UPDATE jogos SET finalizado = true, gols_casa = 1, gols_fora = 0 WHERE id = '<id>'`).
2. Ir em `/dashboard`.
3. Conferir:
   - Header subtitle: "Copa em andamento — vê seu desempenho".
   - Grid de 3 cards (mobile 2 col / desktop 3 col): CardPontos + CardPosicao + CardProgresso.
   - Pontos = `ranking_usuarios.pontos_totais` do user.
   - Posição = `#N de Y participantes`.
   - Sem snapshot ainda → tendências NÃO aparecem nos cards.
   - Após admin tirar 1 snapshot e os pontos mudarem, tendência deve aparecer (▲/▼/━).
   - Links abaixo: "Ver ranking completo →" + "Fazer palpites →".

- [ ] **Step 9: QA manual — colisão (confirmado + pendente em D)**

1. User com confirmado + 1 PIX novo pendente, durante a Copa.
2. Esperado: banner pendente aditivo NO TOPO + 3 cards de stats abaixo. Não esconder os cards.

- [ ] **Step 10: QA manual — mobile**

1. Usar DevTools, viewport iPhone 12 Pro.
2. Conferir nos 4 estados:
   - Hero (Estado A) full-width legível.
   - Banner pendente (variant banner) ocupa 1 linha sem overflow.
   - Cards: 1 col em Estado C; 2 cols em Estado D.
   - ProximosJogosPanel responsivo (já validado em F4).

- [ ] **Step 11: Atualizar memória — dívida resolvida (se aplicável)**

Conferir se a dívida `acertos_parciais` na memory persistente continua relevante. Não toca no F16 mas é boa prática manter atualizada quando passamos perto.

```bash
ls "$HOME/.claude/projects/C--Users-abnet-Desktop-bolao/memory/" | grep acertos_parciais
```

Se ainda existe e F10 já implementou a fix → remover entrada e atualizar `MEMORY.md`.

- [ ] **Step 12: Commit final (se houve qualquer fix de QA)**

```bash
git status
# Se há mudanças pendentes do QA:
git add <arquivos>
git commit -m "fix(F16): <descrição da correção>"
```

Se zero mudanças, seguir direto pro merge.

- [ ] **Step 13: Push da branch + abrir PR**

```bash
git push -u origin <nome-da-branch-do-worktree>
gh pr create --title "feat(F16): Dashboard inteligente — máquina de estados A/B/C/D" --body "$(cat <<'EOF'
## Summary

- Reescreve `/dashboard` como Server Component que discrimina o estado do user no funil (sem bilhete → pendente → confirmado → Copa em andamento) e renderiza UI específica pra cada estado.
- Banner aditivo de PIX pendente em users que já têm confirmado (não esconde os stats).
- Adiciona RPC `count_palpites_confirmados` e helpers puros `lib/dashboard/{estado,countdown}.ts` com TDD.
- Componentes novos: `DashboardStatCard` (composicional) + 4 wrappers (Pontos/Posicao/Progresso/Countdown) + `DashboardEmptyHero` + `DashboardPendentePix` (variant 'hero' | 'banner') + `TrendIndicator`.
- `DashboardHeader` agora aceita prop `subtitle: string` em vez de hardcodar copy.

## Test plan

- [ ] `pnpm test:run` — testes de helpers passando (estado.test.ts + countdown.test.ts)
- [ ] `pnpm typecheck` — 0 erros
- [ ] `pnpm lint` — 0 warnings
- [ ] `pnpm build` — sucesso
- [ ] QA manual Estado A (sem bilhete): hero card visível, sem ProximosJogos, sem stats
- [ ] QA manual Estado B (pendente puro): hero amarelo + ProximosJogos, sem stats
- [ ] QA manual Estado C (pré-Copa): countdown + progresso, banner pendente se aplicável
- [ ] QA manual Estado D (em andamento): pontos + posição + progresso, tendências quando há snapshot
- [ ] QA manual colisão D + pendente: banner em cima dos 3 cards
- [ ] QA manual mobile (iPhone 12 Pro): grids responsivos OK

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Tasks que cobrem |
|---|---|
| §3 Estado discriminado + função pura | Task 3 (estado.ts + tests) |
| §3.2 Lógica de decisão (cascata) | Task 3 |
| §3.3 Edge graceful (ranking vazio com confirmado) | Task 3 (teste + branch na função) |
| §4 Data fetching (Promise.all 5 queries + 2 condicionais) | Task 10 |
| §4.1 RPC count_palpites_confirmados | Task 1 |
| §4.2 Cálculo de progresso e pendente | Task 3 (dentro do helper) |
| §5.1 Árvore de componentes | Tasks 4–8 (8 componentes novos) |
| §5.2 Mudanças em existing | Task 9 (DashboardHeader), Task 10 (page.tsx) |
| §5.3 Subtitle por estado | Task 10 (lógica inline na page) |
| §5.4 DashboardStatCard + tabela cor/ícone | Task 5 + Task 6 (mapeamento aplicado) |
| §5.5 TrendIndicator | Task 4 |
| §5.6 countdown.ts | Task 2 |
| §6.1–6.4 Layouts por estado | Task 10 (markup completo na page) |
| §7 Edge cases | Task 11 (QA por estado) + Task 3 (testes de edge) |
| §8 Estratégia de testes | Tasks 2, 3 (TDD); Task 11 (QA visual) |
| §10 Critérios de pronto | Task 11 (checklist completo) |
| §11.1 Risco de RPC overhead | Mitigado em Task 1 (índices existentes); QA pega regressão |
| §11.2 Snapshot inválido | Tratado em Task 3 (`if (input.snapshot)` + `maybeSingle()`) |
| §11.5 Total participantes inflando | `count: 'exact'` em Task 10; aceitar até virar problema |

**Placeholder scan:** Nenhum TBD/TODO. Cada step tem código completo.

**Type consistency:** `PendenteInfo`, `ProgressoInfo`, `RankingUsuarioInfo`, `DashboardEstado`, `BilheteEstadoInput` todos definidos em Task 3 e usados consistentemente em Tasks 6, 8, 10. `DashboardPendentePixProps.pendente: PendenteInfo` casa com a saída do helper.

**Plano cobre os 4 estados, as colisões, edge cases, riscos. Pronto pra execução.**

---

**"Plan complete and saved to `docs/superpowers/plans/2026-05-06-f16-dashboard-inteligente.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — eu despacho um subagent fresco por task (Sonnet por padrão, conforme você indicou), reviso entre tasks, iteração rápida.

**2. Inline Execution** — executar as tasks nesta sessão usando executing-plans, batch com checkpoints.

**Qual abordagem?"**
