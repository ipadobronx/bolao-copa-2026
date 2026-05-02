# F9 — Painel Admin (Overview) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o painel admin funcional — guard de `is_admin`, sidebar completa, 4 KPIs, tabela de últimos pagamentos, gráfico de vendas por dia (Recharts) e botão de snapshot do ranking.

**Architecture:** Server Component puro em `page.tsx` busca todos os dados via 3 RPC calls ao Supabase (funções SQL SECURITY DEFINER que bypassam RLS). Recharts chart e botão de snapshot são Client Components isolados. `layout.tsx` aplica guard de `is_admin` server-side antes de renderizar qualquer filho.

**Tech Stack:** Next.js 14 App Router, Supabase (admin client + `.rpc()`), Recharts 2, Tailwind CSS v4 (CSS variables), Lucide Icons, Sonner

---

## File Map

**Criar:**
- `supabase/migrations/20260502000000_admin_overview_functions.sql` — 3 SQL functions para KPIs, pagamentos e vendas
- `lib/format/brl.ts` — formatador BRL compartilhado
- `lib/format/tempo-atras.ts` — formatador "tempo atrás" para timestamps
- `lib/__tests__/tempo-atras.test.ts` — testes unitários
- `components/admin/AdminSidebar.tsx` — sidebar Client Component com active state
- `components/admin/KpiCard.tsx` — card reutilizável de métrica
- `components/admin/UltimosPagamentos.tsx` — tabela de últimos pagamentos
- `components/admin/VendasChart.tsx` — Recharts BarChart (Client Component)
- `components/admin/SnapshotRanking.tsx` — select + botão + toast (Client Component)

**Modificar:**
- `app/(admin)/layout.tsx` — adicionar guard `is_admin` + shell com sidebar
- `app/(admin)/admin/page.tsx` — substituir placeholder por dados reais

---

## Task 1: Worktree + instalação do Recharts

**Files:**
- `package.json` (modificado via npm)

- [ ] **Step 1: Criar worktree para F9**

```bash
git worktree add .worktrees/feat-f9-admin-overview -b feat-f9-admin-overview
```

- [ ] **Step 2: Entrar no worktree e instalar recharts**

```bash
cd .worktrees/feat-f9-admin-overview
npm install recharts
```

Expected: `recharts` aparece em `package.json` em `dependencies`.

- [ ] **Step 3: Verificar instalação**

```bash
node -e "require('recharts'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(F9): install recharts"
```

---

## Task 2: Utilitários de formatação

**Files:**
- Create: `lib/format/brl.ts`
- Create: `lib/format/tempo-atras.ts`
- Create: `lib/__tests__/tempo-atras.test.ts`

### 2a — `lib/format/brl.ts`

- [ ] **Step 1: Criar arquivo**

```ts
// lib/format/brl.ts
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
```

### 2b — `lib/format/tempo-atras.ts` (TDD)

- [ ] **Step 2: Escrever o teste antes da implementação**

```ts
// lib/__tests__/tempo-atras.test.ts
import { describe, it, expect } from 'vitest'
import { tempoAtras } from '../format/tempo-atras'

function t(segundosAtras: number) {
  const agora = new Date('2026-06-01T12:00:00Z')
  const data = new Date(agora.getTime() - segundosAtras * 1000)
  return tempoAtras(data, agora)
}

describe('tempoAtras', () => {
  it('retorna "agora" para menos de 60s', () => {
    expect(t(30)).toBe('agora')
    expect(t(59)).toBe('agora')
  })

  it('retorna minutos para 1-59 minutos', () => {
    expect(t(60)).toBe('1 min')
    expect(t(120)).toBe('2 min')
    expect(t(59 * 60)).toBe('59 min')
  })

  it('retorna horas para 1-23h', () => {
    expect(t(3600)).toBe('1h')
    expect(t(3 * 3600)).toBe('3h')
    expect(t(23 * 3600)).toBe('23h')
  })

  it('retorna "1 dia" para exatamente 24h', () => {
    expect(t(24 * 3600)).toBe('1 dia')
  })

  it('retorna dias plural para > 1 dia', () => {
    expect(t(48 * 3600)).toBe('2 dias')
    expect(t(7 * 24 * 3600)).toBe('7 dias')
  })

  it('aceita string de data', () => {
    const agora = new Date('2026-06-01T12:00:00Z')
    expect(tempoAtras('2026-06-01T11:58:00Z', agora)).toBe('2 min')
  })
})
```

- [ ] **Step 3: Rodar teste para confirmar falha**

```bash
npx vitest run lib/__tests__/tempo-atras.test.ts
```

Expected: FAIL — "Cannot find module '../format/tempo-atras'"

- [ ] **Step 4: Implementar `lib/format/tempo-atras.ts`**

```ts
// lib/format/tempo-atras.ts
export function tempoAtras(data: Date | string, agora: Date = new Date()): string {
  const ms = agora.getTime() - new Date(data).getTime()
  if (ms < 0) return 'agora'
  const s = Math.floor(ms / 1000)
  if (s < 60) return 'agora'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d} ${d === 1 ? 'dia' : 'dias'}`
}
```

- [ ] **Step 5: Rodar teste e confirmar aprovação**

```bash
npx vitest run lib/__tests__/tempo-atras.test.ts
```

Expected: PASS — 6 suites, todos verdes

- [ ] **Step 6: Commit**

```bash
git add lib/format/brl.ts lib/format/tempo-atras.ts lib/__tests__/tempo-atras.test.ts
git commit -m "feat(F9): add formatBRL and tempoAtras utilities with tests"
```

---

## Task 3: Migração Supabase — funções SQL admin

**Files:**
- Create: `supabase/migrations/20260502000000_admin_overview_functions.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/20260502000000_admin_overview_functions.sql
-- ============================================================================
-- F9 Admin Overview — funções SQL para KPIs, pagamentos e vendas
-- Spec: docs/superpowers/specs/2026-05-02-admin-overview-design.md
-- Todas SECURITY DEFINER — acessíveis apenas via service_role (admin client)
-- ============================================================================

-- 1. KPIs gerais
CREATE OR REPLACE FUNCTION public.admin_overview_kpis()
RETURNS TABLE(
  tabelas_vendidas bigint,
  apostadores      bigint,
  arrecadado       numeric,
  pendentes        bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COUNT(*)              FILTER (WHERE status_pagamento = 'confirmado')::bigint AS tabelas_vendidas,
    COUNT(DISTINCT user_id) FILTER (WHERE status_pagamento = 'confirmado')::bigint AS apostadores,
    COALESCE(SUM(valor_pago) FILTER (WHERE status_pagamento = 'confirmado'), 0) AS arrecadado,
    COUNT(*)              FILTER (WHERE status_pagamento = 'pendente')::bigint AS pendentes
  FROM public.bilhetes
$$;

REVOKE EXECUTE ON FUNCTION public.admin_overview_kpis() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_overview_kpis() TO service_role;

-- 2. Últimos pagamentos (com join em profiles e selecoes)
CREATE OR REPLACE FUNCTION public.admin_ultimos_pagamentos(lim int DEFAULT 10)
RETURNS TABLE(
  id                    uuid,
  numero_bilhete        int,
  valor_pago            numeric,
  status_pagamento      text,
  pago_em               timestamptz,
  created_at            timestamptz,
  nome                  text,
  bandeira_emoji        text,
  selecao_nome          text,
  total_bilhetes_usuario bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    b.id,
    b.numero_bilhete,
    b.valor_pago,
    b.status_pagamento::text,
    b.pago_em,
    b.created_at,
    COALESCE(p.nome, 'Apostador') AS nome,
    s.bandeira_emoji,
    s.nome AS selecao_nome,
    (
      SELECT COUNT(*)
      FROM public.bilhetes b2
      WHERE b2.user_id = b.user_id
        AND b2.status_pagamento = 'confirmado'
    )::bigint AS total_bilhetes_usuario
  FROM public.bilhetes b
  JOIN public.profiles p ON p.id = b.user_id
  LEFT JOIN public.selecoes s ON s.id = b.selecao_cashback_id
  ORDER BY COALESCE(b.pago_em, b.created_at) DESC
  LIMIT lim
$$;

REVOKE EXECUTE ON FUNCTION public.admin_ultimos_pagamentos(int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_ultimos_pagamentos(int) TO service_role;

-- 3. Vendas por dia (últimos 7 dias, apenas confirmadas)
CREATE OR REPLACE FUNCTION public.admin_vendas_diarias()
RETURNS TABLE(
  date    text,
  tabelas int,
  receita numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    DATE(COALESCE(pago_em, created_at))::text AS date,
    COUNT(*)::int                              AS tabelas,
    COALESCE(SUM(valor_pago), 0)              AS receita
  FROM public.bilhetes
  WHERE status_pagamento = 'confirmado'
    AND COALESCE(pago_em, created_at) >= now() - interval '7 days'
  GROUP BY DATE(COALESCE(pago_em, created_at))
  ORDER BY date ASC
$$;

REVOKE EXECUTE ON FUNCTION public.admin_vendas_diarias() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_vendas_diarias() TO service_role;
```

- [ ] **Step 2: Aplicar migration no Supabase**

```bash
npx supabase db push
```

Expected: "Applying migration 20260502000000_admin_overview_functions.sql... Done"

Se o Supabase CLI não estiver instalado localmente, usar o MCP tool `mcp__claude_ai_Supabase__apply_migration` com o conteúdo do arquivo.

- [ ] **Step 3: Verificar as funções no Supabase Dashboard**

Acessar Supabase → Database → Functions e confirmar que `admin_overview_kpis`, `admin_ultimos_pagamentos` e `admin_vendas_diarias` aparecem com SECURITY DEFINER.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260502000000_admin_overview_functions.sql
git commit -m "feat(F9): add admin SQL functions for KPIs, payments, and sales"
```

---

## Task 4: `AdminSidebar` component

**Files:**
- Create: `components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// components/admin/AdminSidebar.tsx
'use client'

import { Award, BarChart2, CreditCard, Gift, LogOut, Swords, Users } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

type NavItem = {
  label: string
  icon: React.ElementType
  href?: string
  comingSoon?: boolean
}

const ITEMS: NavItem[] = [
  { label: 'Overview',           icon: BarChart2,   href: '/admin' },
  { label: 'Apostadores',        icon: Users,       comingSoon: true },
  { label: 'Pagamentos',         icon: CreditCard,  comingSoon: true },
  { label: 'Jogos & Resultados', icon: Swords,      comingSoon: true },
  { label: 'Cashbacks',          icon: Gift,        comingSoon: true },
]

export function AdminSidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signOut()
    if (error) { toast.error('Erro ao sair. Tenta de novo.'); return }
    router.push('/login')
    router.refresh()
  }

  return (
    <nav
      aria-label="Navegação admin"
      className={cn(
        'bg-bg-card border-border flex h-full flex-col border-r p-6',
        className,
      )}
    >
      {/* Logo */}
      <div className="font-display mb-8 flex items-center gap-2.5 px-2 text-2xl tracking-[2px]">
        <span
          aria-hidden="true"
          className="bg-danger text-bg-dark flex h-9 w-9 -rotate-[5deg] items-center justify-center rounded-lg text-xl font-black"
        >
          A
        </span>
        <span>
          ADMIN<span className="text-accent">26</span>
        </span>
      </div>

      {/* Nav items */}
      <div className="mb-6 space-y-1">
        <div className="text-text-muted mb-2 px-3 font-mono text-[10px] tracking-wider uppercase">
          Gestão
        </div>
        {ITEMS.map((item) => {
          const Icon = item.icon
          if (item.comingSoon) {
            return (
              <span
                key={item.label}
                className="sidebar-item sidebar-item-disabled flex items-center justify-between"
                title="Em breve"
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </span>
                <span className="text-text-muted rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] tracking-wide uppercase">
                  em breve
                </span>
              </span>
            )
          }
          const active = pathname === item.href
          return (
            <Link
              key={item.label}
              href={item.href as Route}
              className={cn('sidebar-item', active && 'sidebar-item-active')}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </div>

      {/* Sign out */}
      <button type="button" onClick={handleSignOut} className="sign-out-btn mt-auto">
        <LogOut className="size-4" aria-hidden="true" /> Sair
      </button>
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/AdminSidebar.tsx
git commit -m "feat(F9): add AdminSidebar component"
```

---

## Task 5: Admin layout com guard `is_admin`

**Files:**
- Modify: `app/(admin)/layout.tsx`

- [ ] **Step 1: Substituir conteúdo do layout**

```tsx
// app/(admin)/layout.tsx
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin')

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) redirect('/')

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      {/* Mobile header */}
      <header className="border-border bg-bg-elevated border-b px-5 py-4 md:hidden">
        <span className="font-display text-danger text-xl tracking-wide">
          ADMIN<span className="text-accent">26</span>
        </span>
      </header>

      {/* Desktop sidebar */}
      <AdminSidebar className="hidden md:flex md:flex-col" />

      {/* Main content */}
      <main className="flex-1 p-5 md:p-8">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que `/admin` redireciona não-admins para `/`**

Testar manualmente acessando `/admin` com um usuário sem `is_admin = true` — deve redirecionar para `/`.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/layout.tsx
git commit -m "feat(F9): admin layout — is_admin guard + sidebar shell"
```

---

## Task 6: `KpiCard` e `UltimosPagamentos`

**Files:**
- Create: `components/admin/KpiCard.tsx`
- Create: `components/admin/UltimosPagamentos.tsx`

### 6a — `KpiCard`

- [ ] **Step 1: Criar componente**

```tsx
// components/admin/KpiCard.tsx
import { cn } from '@/lib/utils'

type KpiCardProps = {
  label: string
  value: string
  icon: string
  colorClass: 'green' | 'yellow' | 'blue' | 'red'
}

const COLOR: Record<KpiCardProps['colorClass'], string> = {
  green:  'bg-success/10 text-success',
  yellow: 'bg-accent/10 text-accent',
  blue:   'bg-info/10 text-info',
  red:    'bg-danger/10 text-danger',
}

export function KpiCard({ label, value, icon, colorClass }: KpiCardProps) {
  return (
    <div className="panel flex items-center gap-4 p-5">
      <div
        aria-hidden="true"
        className={cn(
          'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-2xl',
          COLOR[colorClass],
        )}
      >
        {icon}
      </div>
      <div>
        <div className="text-text-muted text-xs font-medium uppercase tracking-wide">
          {label}
        </div>
        <div className="font-display text-text-primary mt-0.5 text-2xl tracking-wide">
          {value}
        </div>
      </div>
    </div>
  )
}
```

### 6b — `UltimosPagamentos`

- [ ] **Step 2: Criar tipo e componente**

```tsx
// components/admin/UltimosPagamentos.tsx
import { tempoAtras } from '@/lib/format/tempo-atras'

export type PagamentoRow = {
  id: string
  numero_bilhete: number
  valor_pago: number
  status_pagamento: string
  pago_em: string | null
  created_at: string
  nome: string
  bandeira_emoji: string | null
  selecao_nome: string | null
  total_bilhetes_usuario: number
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  confirmado: { label: 'Confirmado', className: 'bg-success/15 text-success' },
  pendente:   { label: 'Aguardando', className: 'bg-accent/15 text-accent' },
  expirado:   { label: 'Expirado',   className: 'bg-white/10 text-text-muted' },
  cancelado:  { label: 'Cancelado',  className: 'bg-danger/15 text-danger' },
}

export function UltimosPagamentos({ rows, agora }: { rows: PagamentoRow[]; agora: Date }) {
  if (rows.length === 0) {
    return (
      <p className="text-text-muted px-6 py-8 text-center text-sm">
        Nenhum pagamento registrado ainda.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border border-b text-left">
            <th className="text-text-muted px-6 py-3 font-mono text-xs font-medium uppercase tracking-wide">
              Apostador
            </th>
            <th className="text-text-muted px-4 py-3 font-mono text-xs font-medium uppercase tracking-wide">
              Valor
            </th>
            <th className="text-text-muted px-4 py-3 font-mono text-xs font-medium uppercase tracking-wide">
              Status
            </th>
            <th className="text-text-muted px-4 py-3 font-mono text-xs font-medium uppercase tracking-wide">
              Quando
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = STATUS_LABEL[row.status_pagamento] ?? STATUS_LABEL['pendente']
            const timestamp = row.pago_em ?? row.created_at
            const cashbackInfo = row.bandeira_emoji
              ? `${row.bandeira_emoji} ${row.selecao_nome}`
              : null

            return (
              <tr
                key={row.id}
                className="border-border hover:bg-bg-elevated/50 border-b last:border-0 transition-colors"
              >
                <td className="px-6 py-3">
                  <div className="font-medium">{row.nome}</div>
                  <div className="text-text-muted font-mono text-[11px]">
                    {row.total_bilhetes_usuario}{' '}
                    {row.total_bilhetes_usuario === 1 ? 'tabela' : 'tabelas'}
                    {cashbackInfo ? ` · cashback ${cashbackInfo}` : ''}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono font-semibold">
                  R$ {row.valor_pago.toFixed(2).replace('.', ',')}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${status.className}`}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="text-text-muted px-4 py-3 font-mono text-xs">
                  {tempoAtras(timestamp, agora)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/KpiCard.tsx components/admin/UltimosPagamentos.tsx
git commit -m "feat(F9): add KpiCard and UltimosPagamentos components"
```

---

## Task 7: `VendasChart` (Recharts Client Component)

**Files:**
- Create: `components/admin/VendasChart.tsx`

- [ ] **Step 1: Criar componente**

```tsx
// components/admin/VendasChart.tsx
'use client'

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
} from 'recharts'
import { formatBRL } from '@/lib/format/brl'

export type VendaDia = {
  date: string    // YYYY-MM-DD
  tabelas: number
  receita: number
  label: string   // SEG, TER, etc — pré-calculado no server
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const { date, tabelas, receita } = payload[0].payload as VendaDia
  return (
    <div className="bg-bg-elevated border-border rounded-lg border px-3 py-2 font-mono text-xs shadow-lg">
      <div className="text-text-muted mb-1">{date}</div>
      <div className="text-text-primary font-semibold">
        {tabelas} {tabelas === 1 ? 'tabela' : 'tabelas'}
      </div>
      <div className="text-accent">{formatBRL(receita)}</div>
    </div>
  )
}

export function VendasChart({ data }: { data: VendaDia[] }) {
  const hasData = data.some((d) => d.tabelas > 0)

  if (!hasData) {
    return (
      <div className="text-text-muted flex h-[200px] items-center justify-center text-sm">
        Nenhuma venda nos últimos 7 dias.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar
          dataKey="tabelas"
          fill="var(--color-accent)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/VendasChart.tsx
git commit -m "feat(F9): add VendasChart Recharts component"
```

---

## Task 8: `SnapshotRanking` component

**Files:**
- Create: `components/admin/SnapshotRanking.tsx`

- [ ] **Step 1: Criar componente**

```tsx
// components/admin/SnapshotRanking.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'

const PERIODOS = [
  { value: 'grupos_r1',       label: 'Grupos — Rodada 1' },
  { value: 'grupos_r2',       label: 'Grupos — Rodada 2' },
  { value: 'grupos_r3',       label: 'Grupos — Rodada 3' },
  { value: '16avos',          label: '16avos de final' },
  { value: 'oitavas',         label: 'Oitavas de final' },
  { value: 'quartas',         label: 'Quartas de final' },
  { value: 'semis',           label: 'Semifinais' },
  { value: 'disputa_terceiro', label: 'Disputa de 3° lugar' },
  { value: 'final',           label: 'Final' },
]

async function postSnapshot(periodo: string, force: boolean) {
  const res = await fetch('/api/admin/ranking-snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ periodo, force }),
  })
  return { status: res.status, data: await res.json() as unknown }
}

export function SnapshotRanking() {
  const [periodo, setPeriodo] = useState('grupos_r1')
  const [loading, setLoading] = useState(false)
  const [pendingOverwrite, setPendingOverwrite] = useState<string | null>(null)

  async function handleSnapshot(force = false) {
    setLoading(true)
    try {
      const { status, data } = await postSnapshot(periodo, force)
      if (status === 409) {
        setPendingOverwrite(periodo)
        return
      }
      if (status !== 200) {
        const msg = typeof data === 'object' && data !== null && 'error' in data
          ? String((data as { error: unknown }).error)
          : 'Erro desconhecido'
        toast.error(`Erro ao tirar snapshot: ${msg}`)
        return
      }
      const count = typeof data === 'object' && data !== null && 'count' in data
        ? (data as { count: number }).count
        : '?'
      toast.success(`Snapshot salvo — ${count} apostadores registrados`)
      setPendingOverwrite(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-text-primary text-sm font-semibold">Tirar snapshot do ranking</h3>
        <p className="text-text-muted mt-0.5 text-xs">
          Salva as posições atuais para calcular tendência (▲/▼) na próxima rodada.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={periodo}
          onChange={(e) => { setPeriodo(e.target.value); setPendingOverwrite(null) }}
          disabled={loading}
          className="border-border bg-bg-elevated text-text-primary rounded-lg border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          {PERIODOS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => handleSnapshot(false)}
          disabled={loading || !!pendingOverwrite}
          className="btn-sm"
        >
          {loading ? 'Salvando…' : 'Tirar snapshot'}
        </button>
      </div>

      {/* Dialog de confirmação de sobrescrita */}
      {pendingOverwrite && (
        <div className="border-border bg-bg-elevated mt-4 rounded-lg border p-4">
          <p className="text-text-primary mb-3 text-sm font-medium">
            Já existe um snapshot para <span className="text-accent font-mono">{pendingOverwrite}</span>.
            Sobrescrever?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSnapshot(true)}
              disabled={loading}
              className="bg-danger/10 text-danger hover:bg-danger/20 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            >
              {loading ? 'Sobrescrevendo…' : 'Sim, sobrescrever'}
            </button>
            <button
              type="button"
              onClick={() => setPendingOverwrite(null)}
              disabled={loading}
              className="btn-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/SnapshotRanking.tsx
git commit -m "feat(F9): add SnapshotRanking component"
```

---

## Task 9: `page.tsx` — admin overview completo

**Files:**
- Modify: `app/(admin)/admin/page.tsx`

- [ ] **Step 1: Helper para preencher dias sem vendas**

No topo de `page.tsx`, antes do componente, adicionar:

```ts
// Preenche os últimos 7 dias com zeros para dias sem vendas
function fillVendasDiarias(
  rows: { date: string; tabelas: number; receita: number }[],
): import('@/components/admin/VendasChart').VendaDia[] {
  const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
  const result = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const found = rows.find((r) => r.date === dateStr)
    result.push({
      date: dateStr,
      tabelas: found?.tabelas ?? 0,
      receita: Number(found?.receita ?? 0),
      label: DIAS[d.getDay()],
    })
  }
  return result
}
```

- [ ] **Step 2: Substituir `page.tsx` completo**

```tsx
// app/(admin)/admin/page.tsx
import { KpiCard } from '@/components/admin/KpiCard'
import { SnapshotRanking } from '@/components/admin/SnapshotRanking'
import { UltimosPagamentos, type PagamentoRow } from '@/components/admin/UltimosPagamentos'
import { VendasChart, type VendaDia } from '@/components/admin/VendasChart'
import { formatBRL } from '@/lib/format/brl'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// Preenche os últimos 7 dias com zeros para dias sem vendas
function fillVendasDiarias(
  rows: { date: string; tabelas: number; receita: number }[],
): VendaDia[] {
  const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
  const result: VendaDia[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const found = rows.find((r) => r.date === dateStr)
    result.push({
      date: dateStr,
      tabelas: found?.tabelas ?? 0,
      receita: Number(found?.receita ?? 0),
      label: DIAS[d.getDay()],
    })
  }
  return result
}

export default async function AdminPage() {
  const admin = createSupabaseAdminClient()

  const [kpisRes, pagamentosRes, vendasRes] = await Promise.all([
    admin.rpc('admin_overview_kpis'),
    admin.rpc('admin_ultimos_pagamentos', { lim: 10 }),
    admin.rpc('admin_vendas_diarias'),
  ])

  const kpis = kpisRes.data?.[0] ?? {
    tabelas_vendidas: 0,
    apostadores: 0,
    arrecadado: 0,
    pendentes: 0,
  }

  const pagamentos = (pagamentosRes.data ?? []) as PagamentoRow[]
  const vendas = fillVendasDiarias(vendasRes.data ?? [])
  const agora = new Date()

  return (
    <section>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-text-primary text-4xl tracking-wide">
          Painel <span className="text-danger">Admin</span>
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          Copa 2026 · Visão geral do sistema
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Arrecadado"
          value={formatBRL(Number(kpis.arrecadado))}
          icon="💰"
          colorClass="green"
        />
        <KpiCard
          label="Tabelas vendidas"
          value={String(kpis.tabelas_vendidas)}
          icon="🎫"
          colorClass="yellow"
        />
        <KpiCard
          label="Apostadores"
          value={String(kpis.apostadores)}
          icon="👥"
          colorClass="blue"
        />
        <KpiCard
          label="Pagamentos pendentes"
          value={String(kpis.pendentes)}
          icon="⏳"
          colorClass="red"
        />
      </div>

      {/* Grid: pagamentos + vendas */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Últimos pagamentos */}
        <div className="panel">
          <div className="panel-header">
            <span className="text-text-primary text-sm font-semibold">Últimos pagamentos</span>
          </div>
          <UltimosPagamentos rows={pagamentos} agora={agora} />
        </div>

        {/* Vendas por dia */}
        <div className="panel">
          <div className="panel-header">
            <span className="text-text-primary text-sm font-semibold">Vendas por dia</span>
            <span className="text-text-muted font-mono text-xs">Últimos 7 dias</span>
          </div>
          <div className="p-6">
            <VendasChart data={vendas} />
          </div>
        </div>
      </div>

      {/* Ações do sistema */}
      <div className="panel">
        <div className="panel-header">
          <span className="text-text-primary text-sm font-semibold">Ações do sistema</span>
        </div>
        <div className="p-6">
          <SnapshotRanking />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 erros

- [ ] **Step 4: Testar manualmente**

Iniciar o dev server e acessar `/admin` com um usuário admin:

```bash
npm run dev
```

Verificar:
- 4 KPI cards aparecem com dados corretos
- Tabela "Últimos pagamentos" lista os bilhetes
- Gráfico de barras aparece para os últimos 7 dias
- Seção "Ações do sistema" com select e botão visíveis

- [ ] **Step 5: Commit**

```bash
git add app/\(admin\)/admin/page.tsx
git commit -m "feat(F9): admin overview page — KPIs, pagamentos, vendas chart, snapshot"
```

---

## Task 10: PR para main

- [ ] **Step 1: Rodar todos os testes**

```bash
npx vitest run
```

Expected: todos passando, incluindo `tempo-atras.test.ts`

- [ ] **Step 2: Verificar TypeScript final**

```bash
npx tsc --noEmit
```

Expected: 0 erros

- [ ] **Step 3: Push da branch**

```bash
git push -u origin feat-f9-admin-overview
```

- [ ] **Step 4: Abrir PR**

```bash
gh pr create \
  --title "feat(F9): painel admin overview — KPIs, pagamentos, vendas, snapshot" \
  --body "$(cat <<'EOF'
## O que entrega

- Guard `is_admin` no `app/(admin)/layout.tsx` — redireciona usuários comuns para `/`
- `AdminSidebar` com 5 itens (Overview ativo; Apostadores/Pagamentos/Jogos/Cashbacks com badge "em breve")
- 4 KPI cards: Arrecadado, Tabelas vendidas, Apostadores, Pendentes
- Tabela "Últimos pagamentos" (10 mais recentes) com status pill e tempo relativo
- Gráfico "Vendas por dia" (últimos 7 dias) via Recharts BarChart
- Seção "Ações do sistema" com botão de snapshot do ranking (chama endpoint já criado na F8)
- Migration: 3 funções SQL SECURITY DEFINER (`admin_overview_kpis`, `admin_ultimos_pagamentos`, `admin_vendas_diarias`)
- `lib/format/brl.ts` + `lib/format/tempo-atras.ts` com testes unitários

## Como testar

1. Fazer login com usuário sem `is_admin = true` → acesso `/admin` → deve redirecionar para `/`
2. Definir `is_admin = true` no Supabase para o usuário de teste
3. Acessar `/admin` → ver KPIs, tabela, gráfico
4. Clicar "Tirar snapshot" → toast de confirmação
5. Clicar novamente → dialog de sobrescrita aparece

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

### Spec coverage

| Requisito (spec) | Task |
|-----------------|------|
| Guard `is_admin` no layout | Task 5 |
| Sidebar com 5 itens, "em breve" para futuros | Task 4 |
| 4 KPI cards (Arrecadado, Tabelas, Apostadores, Pendentes) | Task 6 + Task 9 |
| Tabela últimos pagamentos (10 registros) | Task 6 + Task 9 |
| Gráfico vendas por dia — Recharts | Task 7 + Task 9 |
| Seção "Ações do sistema" — snapshot do ranking | Task 8 + Task 9 |
| Migration com funções SQL SECURITY DEFINER | Task 3 |
| `supabaseAdmin` apenas server-side | Task 5, Task 9 |
| Recharts instalado | Task 1 |
| `lib/format/brl.ts` compartilhado | Task 2 |
| `lib/format/tempo-atras.ts` com testes | Task 2 |

Todos os requisitos cobertos. ✅

### Consistência de tipos

- `PagamentoRow` definido em `UltimosPagamentos.tsx` e importado em `page.tsx` ✅
- `VendaDia` definido em `VendasChart.tsx` e importado em `page.tsx` ✅
- `fillVendasDiarias` retorna `VendaDia[]` que bate com `VendasChart` props ✅
- `KpiCard` props: `label`, `value` (string), `icon`, `colorClass` — usados consistentemente ✅
- `tempoAtras` assinatura: `(data: Date | string, agora?: Date) => string` — usada corretamente em `UltimosPagamentos` ✅

### Sem placeholders

Todos os passos têm código concreto. ✅
