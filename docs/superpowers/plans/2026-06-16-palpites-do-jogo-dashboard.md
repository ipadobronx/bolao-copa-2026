# Painel "Palpites do jogo" na dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na dashboard (estado em-andamento), um painel com 2 cards — Jogo atual (em cima) e Próximo jogo — mostrando tendência (% mandante/empate/visitante), 3 placares mais palpitados e, no jogo travado, o palpite de cada apostador (tabela do ranking).

**Architecture:** Função pura `resumoPalpites` agrega tendência+placares. Builder server-only `montarPalpitesDoJogo` (service_role) acha atual+próximo, agrega sobre o melhor bilhete de cada pessoa e monta a lista individual SÓ pro jogo travado (privacidade). Cards client renderizam; a dashboard injeta o painel.

**Tech Stack:** Next.js 14 App Router, TS strict (`exactOptionalPropertyTypes`), Supabase (service_role server-only; RLS irrelevante pois admin), Vitest + RTL, Tailwind v4, `BandeiraImg`, `avatar-color`, `formatDiasHoras`.

**Spec:** `docs/superpowers/specs/2026-06-16-palpites-do-jogo-dashboard-design.md`

---

## File structure
- Create `lib/dashboard/resumo-jogo.ts` — tipos + `resumoPalpites` (pura).
- Create `lib/dashboard/resumo-jogo.test.ts`.
- Create `lib/dashboard/palpites-do-jogo.ts` — `montarPalpitesDoJogo()` (server-only).
- Create `components/dashboard/JogoResumoCard.tsx` (client).
- Create `components/dashboard/PalpitesDoJogoPanel.tsx`.
- Create `components/dashboard/__tests__/JogoResumoCard.test.tsx`.
- Modify `app/(dashboard)/dashboard/page.tsx` — buscar + renderizar no estado em-andamento.

---

## Task 1: `resumo-jogo.ts` — tipos + agregação pura (TDD)

**Files:**
- Create: `lib/dashboard/resumo-jogo.ts`
- Test: `lib/dashboard/resumo-jogo.test.ts`

- [ ] **Step 1: Escrever o teste**

Crie `lib/dashboard/resumo-jogo.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { resumoPalpites } from './resumo-jogo'

describe('resumoPalpites', () => {
  it('conta tendência casa/empate/fora e top 3 placares', () => {
    const r = resumoPalpites([
      { gols_casa: 1, gols_fora: 0 },
      { gols_casa: 1, gols_fora: 0 },
      { gols_casa: 2, gols_fora: 0 },
      { gols_casa: 1, gols_fora: 1 },
      { gols_casa: 0, gols_fora: 2 },
    ])
    expect(r.total).toBe(5)
    expect(r.tendencia).toEqual({ casa: 3, empate: 1, fora: 1 })
    expect(r.topPlacares[0]).toEqual({ gc: 1, gf: 0, count: 2 })
    expect(r.topPlacares.length).toBe(3)
  })

  it('desempate determinístico: count desc, depois gc desc, gf desc', () => {
    const r = resumoPalpites([
      { gols_casa: 0, gols_fora: 0 },
      { gols_casa: 2, gols_fora: 1 },
    ])
    expect(r.topPlacares.map((p) => `${p.gc}x${p.gf}`)).toEqual(['2x1', '0x0'])
  })

  it('lista vazia', () => {
    expect(resumoPalpites([])).toEqual({
      total: 0,
      tendencia: { casa: 0, empate: 0, fora: 0 },
      topPlacares: [],
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/dashboard/resumo-jogo.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

Crie `lib/dashboard/resumo-jogo.ts`:
```ts
export type Tendencia = { casa: number; empate: number; fora: number }
export type Placar = { gc: number; gf: number; count: number }
export type ResumoPalpites = { total: number; tendencia: Tendencia; topPlacares: Placar[] }

export type PalpitePessoa = {
  userId: string
  nome: string
  gc: number
  gf: number
  pts: number | null
  isLider: boolean
}

export type JogoResumo = {
  numeroJogo: number
  dataHora: string
  casa: string
  fora: string
  bandeiraCasa: string | null
  bandeiraFora: string | null
  finalizado: boolean
  realCasa: number | null
  realFora: number | null
  total: number
  tendencia: Tendencia
  topPlacares: Placar[]
  palpites: PalpitePessoa[] | null // null = jogo não travado (privado)
}

/** Agrega tendência (mandante/empate/visitante) e os 3 placares mais palpitados. */
export function resumoPalpites(
  palpites: { gols_casa: number; gols_fora: number }[],
): ResumoPalpites {
  const tendencia: Tendencia = { casa: 0, empate: 0, fora: 0 }
  const placarMap = new Map<string, Placar>()
  for (const p of palpites) {
    const d = p.gols_casa - p.gols_fora
    if (d > 0) tendencia.casa++
    else if (d < 0) tendencia.fora++
    else tendencia.empate++
    const key = `${p.gols_casa}x${p.gols_fora}`
    const cur = placarMap.get(key)
    if (cur) cur.count++
    else placarMap.set(key, { gc: p.gols_casa, gf: p.gols_fora, count: 1 })
  }
  const topPlacares = [...placarMap.values()]
    .sort((a, b) => b.count - a.count || b.gc - a.gc || b.gf - a.gf)
    .slice(0, 3)
  return { total: palpites.length, tendencia, topPlacares }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/dashboard/resumo-jogo.test.ts`
Expected: 3 testes passam.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/resumo-jogo.ts lib/dashboard/resumo-jogo.test.ts
git commit -m "feat(dashboard): resumoPalpites (tendência + top placares) + tipos"
```

---

## Task 2: `palpites-do-jogo.ts` — builder server-only

**Files:**
- Create: `lib/dashboard/palpites-do-jogo.ts`

- [ ] **Step 1: Implementar**

Crie `lib/dashboard/palpites-do-jogo.ts`:
```ts
import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { resumoPalpites, type JogoResumo, type PalpitePessoa } from './resumo-jogo'

type Admin = ReturnType<typeof createSupabaseAdminClient>

const JOGO_COLS =
  'id, numero_jogo, data_hora, finalizado, gols_casa, gols_fora, placeholder_casa, placeholder_fora, ' +
  'casa:selecoes!selecao_casa_id(nome, bandeira_emoji), ' +
  'fora:selecoes!selecao_fora_id(nome, bandeira_emoji)'

type Selecao = { nome: string; bandeira_emoji: string }
type JogoRow = {
  id: number
  numero_jogo: number | null
  data_hora: string
  finalizado: boolean | null
  gols_casa: number | null
  gols_fora: number | null
  placeholder_casa: string | null
  placeholder_fora: string | null
  casa: Selecao | Selecao[] | null
  fora: Selecao | Selecao[] | null
}

type Melhor = { bilheteId: string; nome: string; userId: string; posicao: number }

async function buildJogo(
  admin: Admin,
  j: JogoRow,
  melhores: Melhor[],
  incluirPalpites: boolean,
): Promise<JogoResumo> {
  const bilheteIds = melhores.map((m) => m.bilheteId)
  const { data: palps } = bilheteIds.length
    ? await admin
        .from('palpites')
        .select('bilhete_id, gols_casa, gols_fora, pontos_calculados')
        .eq('jogo_id', j.id)
        .in('bilhete_id', bilheteIds)
    : { data: [] }

  const lista = palps ?? []
  const resumo = resumoPalpites(lista.map((p) => ({ gols_casa: p.gols_casa, gols_fora: p.gols_fora })))

  const c = Array.isArray(j.casa) ? j.casa[0] : j.casa
  const f = Array.isArray(j.fora) ? j.fora[0] : j.fora

  let palpites: PalpitePessoa[] | null = null
  if (incluirPalpites) {
    const byBilhete = new Map(lista.map((p) => [p.bilhete_id, p]))
    palpites = melhores
      .filter((m) => byBilhete.has(m.bilheteId))
      .sort((a, b) => a.posicao - b.posicao)
      .map((m) => {
        const p = byBilhete.get(m.bilheteId)!
        return {
          userId: m.userId,
          nome: m.nome,
          gc: p.gols_casa,
          gf: p.gols_fora,
          pts: p.pontos_calculados,
          isLider: m.posicao === 1,
        }
      })
  }

  return {
    numeroJogo: j.numero_jogo ?? 0,
    dataHora: j.data_hora,
    casa: c?.nome ?? j.placeholder_casa ?? '?',
    fora: f?.nome ?? j.placeholder_fora ?? '?',
    bandeiraCasa: c?.bandeira_emoji ?? null,
    bandeiraFora: f?.bandeira_emoji ?? null,
    finalizado: j.finalizado ?? false,
    realCasa: j.gols_casa,
    realFora: j.gols_fora,
    total: resumo.total,
    tendencia: resumo.tendencia,
    topPlacares: resumo.topPlacares,
    palpites,
  }
}

/** Acha o jogo travado mais recente (atual) e o próximo; agrega sobre o melhor bilhete de cada pessoa. */
export async function montarPalpitesDoJogo(): Promise<{
  atual: JogoResumo | null
  proximo: JogoResumo | null
}> {
  const admin = createSupabaseAdminClient()
  const agora = new Date().toISOString()

  const [atualRes, proxRes, rankRes] = await Promise.all([
    admin.from('jogos').select(JOGO_COLS).lte('data_hora', agora).order('data_hora', { ascending: false }).limit(1).maybeSingle(),
    admin.from('jogos').select(JOGO_COLS).gt('data_hora', agora).order('data_hora', { ascending: true }).limit(1).maybeSingle(),
    admin.from('ranking_usuarios').select('user_id, nome, melhor_bilhete_id, posicao'),
  ])

  const melhores: Melhor[] = (rankRes.data ?? [])
    .filter((r): r is typeof r & { melhor_bilhete_id: string } => r.melhor_bilhete_id !== null)
    .map((r) => ({
      bilheteId: r.melhor_bilhete_id,
      nome: r.nome ?? '',
      userId: r.user_id ?? '',
      posicao: r.posicao ?? 0,
    }))

  const atualRow = atualRes.data as unknown as JogoRow | null
  const proxRow = proxRes.data as unknown as JogoRow | null

  const atual = atualRow ? await buildJogo(admin, atualRow, melhores, true) : null
  const proximo = proxRow ? await buildJogo(admin, proxRow, melhores, false) : null
  return { atual, proximo }
}
```
*(O `as unknown as JogoRow` é o mesmo workaround já usado no projeto pro tipo gerado do join aliasado do Supabase.)*

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo. Se `createSupabaseAdminClient` não exportar o tipo esperado, confirme o import (`@/lib/supabase/admin` exporta `createSupabaseAdminClient`).

- [ ] **Step 3: Commit**

```bash
git add lib/dashboard/palpites-do-jogo.ts
git commit -m "feat(dashboard): montarPalpitesDoJogo (atual+próximo, agregado por pessoa)"
```

---

## Task 3: Componentes `JogoResumoCard` + `PalpitesDoJogoPanel`

**Files:**
- Create: `components/dashboard/JogoResumoCard.tsx`
- Create: `components/dashboard/PalpitesDoJogoPanel.tsx`
- Test: `components/dashboard/__tests__/JogoResumoCard.test.tsx`

- [ ] **Step 1: `JogoResumoCard.tsx` (client)**

Crie `components/dashboard/JogoResumoCard.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { BandeiraImg } from '@/components/ui/BandeiraImg'
import { avatarColor, avatarInitials } from '@/lib/format/avatar-color'
import { formatDiasHoras } from '@/lib/dashboard/countdown'
import type { JogoResumo, Tendencia } from '@/lib/dashboard/resumo-jogo'

const VISIVEIS = 6

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

function Barra({ label, n, total, destaque }: { label: string; n: number; total: number; destaque: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 truncate text-text-secondary">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
        <span
          className={`block h-full rounded-full ${destaque ? 'bg-accent' : 'bg-slate-500'}`}
          style={{ width: `${pct(n, total)}%` }}
        />
      </span>
      <span className="w-16 shrink-0 text-right font-mono text-[11px] text-text-muted">
        {pct(n, total)}% ({n})
      </span>
    </div>
  )
}

export function JogoResumoCard({ jogo, proximo }: { jogo: JogoResumo; proximo: boolean }) {
  const [verTodos, setVerTodos] = useState(false)
  const t: Tendencia = jogo.tendencia
  const maior = Math.max(t.casa, t.empate, t.fora)

  let countdown = ''
  if (proximo) {
    const { dias, horas } = formatDiasHoras(new Date(), new Date(jogo.dataHora))
    countdown = dias > 0 ? `trava em ${dias}d ${horas}h` : `trava em ${horas}h`
  }

  const lista = jogo.palpites ?? []
  const visiveis = verTodos ? lista : lista.slice(0, VISIVEIS)

  return (
    <div className="bg-bg-card border-border rounded-2xl border p-4">
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
            proximo ? 'bg-accent/15 text-accent' : 'bg-green-500/15 text-green-400'
          }`}
        >
          {proximo ? 'Próximo' : 'Jogo atual'}
        </span>
        <span className="font-mono text-[10px] text-text-muted">
          {proximo ? countdown : `${jogo.total} palpites`}
        </span>
      </div>

      <div className="my-3 flex items-center justify-center gap-2 text-sm font-bold">
        <BandeiraImg emoji={jogo.bandeiraCasa} nome={jogo.casa} size={18} />
        <span className="truncate">{jogo.casa}</span>
        <span className="text-text-muted text-[11px] font-semibold">vs</span>
        <span className="truncate">{jogo.fora}</span>
        <BandeiraImg emoji={jogo.bandeiraFora} nome={jogo.fora} size={18} />
      </div>

      {jogo.finalizado && jogo.realCasa != null && jogo.realFora != null && (
        <div className="mb-2 text-center font-mono text-xs text-text-muted">
          Resultado: <strong className="text-text-primary">{jogo.realCasa}×{jogo.realFora}</strong>
        </div>
      )}

      <div className="text-[10px] uppercase tracking-wider text-text-muted">📈 Tendência</div>
      <div className="mt-1 space-y-1">
        <Barra label={jogo.casa} n={t.casa} total={jogo.total} destaque={t.casa === maior && maior > 0} />
        <Barra label="Empate" n={t.empate} total={jogo.total} destaque={t.empate === maior && maior > 0} />
        <Barra label={jogo.fora} n={t.fora} total={jogo.total} destaque={t.fora === maior && maior > 0} />
      </div>

      <div className="mt-3 text-[10px] uppercase tracking-wider text-text-muted">🎯 Placares mais palpitados</div>
      <div className="mt-1 flex flex-wrap gap-2">
        {jogo.topPlacares.length === 0 ? (
          <span className="text-xs text-text-muted">—</span>
        ) : (
          jogo.topPlacares.map((p) => (
            <span
              key={`${p.gc}x${p.gf}`}
              className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent"
            >
              {p.gc}×{p.gf} <span className="font-semibold text-text-muted">({p.count})</span>
            </span>
          ))
        )}
      </div>

      {proximo ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border bg-bg-elevated px-3 py-2.5 text-xs text-text-muted">
          🔒 O palpite de cada um aparece quando o jogo travar.
        </div>
      ) : (
        <>
          <div className="mt-3 text-[10px] uppercase tracking-wider text-text-muted">👥 Palpite de cada um</div>
          <div className="mt-1 space-y-1.5">
            {visiveis.map((p) => (
              <div key={p.userId} className="bg-bg-elevated border-border flex items-center gap-2 rounded-xl border px-2.5 py-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-bg-dark"
                  style={{ background: avatarColor(p.userId) }}
                  aria-hidden="true"
                >
                  {avatarInitials(p.nome)}
                </span>
                <span className="flex-1 truncate text-sm">{p.nome}</span>
                {p.isLider && (
                  <span className="rounded-full border border-accent/40 px-1.5 py-0.5 text-[8px] font-bold uppercase text-accent">
                    ★ ranking
                  </span>
                )}
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                  {p.gc}×{p.gf}
                  {jogo.finalizado && p.pts != null && (
                    <strong className="text-accent"> · +{p.pts}</strong>
                  )}
                </span>
              </div>
            ))}
          </div>
          {lista.length > VISIVEIS && (
            <button
              type="button"
              onClick={() => setVerTodos((v) => !v)}
              aria-expanded={verTodos}
              className="mt-2 w-full rounded-lg border border-white/10 py-1.5 text-xs font-semibold text-text-muted hover:text-text-primary"
            >
              {verTodos ? 'Ver menos' : `Ver todos os ${lista.length} palpites`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `PalpitesDoJogoPanel.tsx`**

Crie `components/dashboard/PalpitesDoJogoPanel.tsx`:
```tsx
import { JogoResumoCard } from './JogoResumoCard'
import type { JogoResumo } from '@/lib/dashboard/resumo-jogo'

export function PalpitesDoJogoPanel({
  atual,
  proximo,
}: {
  atual: JogoResumo | null
  proximo: JogoResumo | null
}) {
  if (!atual && !proximo) return null
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-text-muted">
        ⚽ Palpites do jogo
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {atual && <JogoResumoCard jogo={atual} proximo={false} />}
        {proximo && <JogoResumoCard jogo={proximo} proximo={true} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Teste do card**

Crie `components/dashboard/__tests__/JogoResumoCard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { JogoResumoCard } from '../JogoResumoCard'
import type { JogoResumo } from '@/lib/dashboard/resumo-jogo'

const base: JogoResumo = {
  numeroJogo: 16,
  dataHora: '2026-06-15T22:00:00Z',
  casa: 'Irã',
  fora: 'Nova Zelândia',
  bandeiraCasa: '🇮🇷',
  bandeiraFora: '🇳🇿',
  finalizado: false,
  realCasa: null,
  realFora: null,
  total: 3,
  tendencia: { casa: 2, empate: 1, fora: 0 },
  topPlacares: [
    { gc: 1, gf: 0, count: 2 },
    { gc: 1, gf: 1, count: 1 },
  ],
  palpites: [
    { userId: 'u1', nome: 'Dionísio', gc: 1, gf: 0, pts: null, isLider: true },
    { userId: 'u2', nome: 'Ana Luyza', gc: 1, gf: 1, pts: null, isLider: false },
  ],
}

describe('<JogoResumoCard />', () => {
  it('jogo atual: confronto, lista de nomes, sem lockbox', () => {
    render(<JogoResumoCard jogo={base} proximo={false} />)
    expect(screen.getByText('Irã')).toBeInTheDocument()
    expect(screen.getByText('Dionísio')).toBeInTheDocument()
    expect(screen.getByText('Ana Luyza')).toBeInTheDocument()
    expect(screen.queryByText(/aparece quando o jogo travar/i)).toBeNull()
  })

  it('próximo: lockbox e sem nomes', () => {
    render(<JogoResumoCard jogo={{ ...base, palpites: null }} proximo />)
    expect(screen.getByText(/aparece quando o jogo travar/i)).toBeInTheDocument()
    expect(screen.queryByText('Dionísio')).toBeNull()
  })
})
```

- [ ] **Step 4: Typecheck + testes**

Run: `npx tsc --noEmit && npx vitest run components/dashboard/__tests__/JogoResumoCard.test.tsx`
Expected: limpo; 2 testes passam.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/JogoResumoCard.tsx components/dashboard/PalpitesDoJogoPanel.tsx components/dashboard/__tests__/JogoResumoCard.test.tsx
git commit -m "feat(dashboard): JogoResumoCard + PalpitesDoJogoPanel"
```

---

## Task 4: Injetar o painel na dashboard (estado em-andamento)

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Import**

Após a linha `import { CardCountdown } from '@/components/dashboard/CardCountdown'` (junto dos outros imports de componente do dashboard), adicione:
```tsx
import { PalpitesDoJogoPanel } from '@/components/dashboard/PalpitesDoJogoPanel'
import { montarPalpitesDoJogo } from '@/lib/dashboard/palpites-do-jogo'
```

- [ ] **Step 2: Buscar os dados quando em-andamento**

Logo após o bloco que recalcula `estado` na Fase 2 (depois do `if (estadoBase.kind === 'em-andamento') { ... }`, antes do `const jogos: JogoRowData[] = ...`), adicione:
```tsx
  const palpitesJogo =
    estado.kind === 'em-andamento' ? await montarPalpitesDoJogo() : null
```

- [ ] **Step 3: Renderizar no bloco em-andamento**

No JSX do `estado.kind === 'em-andamento'`, logo APÓS o `</div>` que fecha o grid dos cards de stat (o `<div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3"> ... </div>`) e ANTES de `<ProximosJogosPanel jogos={jogos} errored={jogosErrored} />`, insira:
```tsx
          {palpitesJogo && (
            <PalpitesDoJogoPanel atual={palpitesJogo.atual} proximo={palpitesJogo.proximo} />
          )}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "app/(dashboard)/dashboard" components/dashboard lib/dashboard`
Expected: limpo.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(dashboard): painel Palpites do jogo no estado em-andamento"
```

---

## Task 5: Verificação final

- [ ] **Step 1: tsc + lint + testes + build**

Run:
```bash
npx tsc --noEmit && npx eslint lib/dashboard components/dashboard "app/(dashboard)/dashboard" && npx vitest run && npx next build
```
Expected: tudo limpo; suíte verde (inclui `resumo-jogo.test.ts` ×3 e `JogoResumoCard.test.tsx` ×2); `✓ Compiled successfully`.

- [ ] **Step 2: Checagem manual em `/dashboard` (estado em-andamento)**

- Aparece o painel "Palpites do jogo" com **Jogo atual em cima** (Irã x Nova Zelândia hoje) e **Próximo jogo** abaixo, **com bandeiras**.
- Jogo atual: tendência em barras (mandante destacado em amarelo), 3 placares em chips, e a lista de cada um (líder no topo com ★ ranking); "Ver todos os N" quando > 6; resultado+pontos se finalizado.
- Próximo jogo: tendência + placares (anônimo) + "🔒 … quando o jogo travar" + "trava em Xh". **Sem nomes.**
- Conferir no banco que nenhum nome do próximo jogo é exposto (a resposta do builder traz `palpites: null` no próximo).

---

## Fora de escopo
- Arquivo navegável de jogos antigos; realtime; superpoderes; mexer no /ranking ou /jogos.
