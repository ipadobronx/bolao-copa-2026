# Card modal de perfil no ranking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicar no avatar (iniciais) de uma linha do ranking abre um modal com selo de desempenho, form/pontos e os palpites de bônus (campeão/artilheiro).

**Architecture:** Modal único (Radix Dialog) controlado pelo `RankingShell` (client). As linhas chamam um callback `onAbrirPerfil(rowData)` passado por props até o `RankingRow`, onde **só o avatar** (botão) dispara. O selo sai de uma função pura `tituloDesempenho(posicao, total)`. Os bônus são buscados ao abrir via `GET /api/perfil/[bilheteId]` (server, service_role). Reusa `FormaDots`.

**Tech Stack:** Next.js 14 App Router, TS strict (`exactOptionalPropertyTypes`), `@radix-ui/react-dialog` (já é dep), Supabase, Vitest + RTL, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-12-perfil-card-modal-design.md`

---

## File structure

- Create `lib/ranking/titulo.ts` — `tituloDesempenho(posicao, total)` puro.
- Create `lib/ranking/__tests__/titulo.test.ts`.
- Create `app/api/perfil/[bilheteId]/route.ts` — bônus do bilhete.
- Create `components/ranking/PerfilModal.tsx` — Radix Dialog.
- Modify `components/ranking/RankingRow.tsx` — `RankingRowData += melhorBilheteId`; avatar vira botão; prop `onAbrirPerfil`.
- Modify `components/ranking/RankingTable.tsx`, `RankingTabGeral.tsx`, `RankingTabRodada.tsx` — repassar `onAbrirPerfil`.
- Modify `components/ranking/RankingShell.tsx` — estado do modal + render `<PerfilModal>` + passar `onAbrirPerfil`/`totalApostadores`.
- Modify `app/(dashboard)/ranking/page.tsx` e `app/api/ranking/route.ts` — anexar `melhorBilheteId`.

---

## Task 1: Função pura `tituloDesempenho` (TDD)

**Files:**
- Create: `lib/ranking/titulo.ts`
- Test: `lib/ranking/__tests__/titulo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { tituloDesempenho } from '../titulo'

describe('tituloDesempenho', () => {
  it('top 10% = Bruxo', () => {
    expect(tituloDesempenho(1, 100)).toEqual({ emoji: '🧙', label: 'Bruxo' })
    expect(tituloDesempenho(10, 100)).toEqual({ emoji: '🧙', label: 'Bruxo' })
  })
  it('top 33% = Embalado', () => {
    expect(tituloDesempenho(20, 100)).toEqual({ emoji: '🔥', label: 'Embalado' })
  })
  it('meio = Na média', () => {
    expect(tituloDesempenho(50, 100)).toEqual({ emoji: '😎', label: 'Na média' })
  })
  it('fundo 33% = Pé-frio', () => {
    expect(tituloDesempenho(80, 100)).toEqual({ emoji: '🥶', label: 'Pé-frio' })
  })
  it('fundo 10% = Chutador', () => {
    expect(tituloDesempenho(95, 100)).toEqual({ emoji: '🤡', label: 'Chutador' })
  })
  it('total inválido = Na média', () => {
    expect(tituloDesempenho(1, 0)).toEqual({ emoji: '😎', label: 'Na média' })
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run lib/ranking/__tests__/titulo.test.ts` → FAIL (module não existe).

- [ ] **Step 3: Implement**

```ts
export type Selo = { emoji: string; label: string }

/**
 * Selo de desempenho por percentil no ranking (posicao 1 = topo).
 * top 10% Bruxo · top 33% Embalado · meio Na média · fundo 33% Pé-frio · fundo 10% Chutador.
 */
export function tituloDesempenho(posicao: number, total: number): Selo {
  if (total <= 0) return { emoji: '😎', label: 'Na média' }
  const pct = posicao / total // 0..1, menor = melhor
  if (pct <= 0.1) return { emoji: '🧙', label: 'Bruxo' }
  if (pct <= 0.33) return { emoji: '🔥', label: 'Embalado' }
  if (pct <= 0.66) return { emoji: '😎', label: 'Na média' }
  if (pct <= 0.9) return { emoji: '🥶', label: 'Pé-frio' }
  return { emoji: '🤡', label: 'Chutador' }
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run lib/ranking/__tests__/titulo.test.ts` → 6 passam.

- [ ] **Step 5: Commit**

```bash
git add lib/ranking/titulo.ts lib/ranking/__tests__/titulo.test.ts
git commit -m "feat(ranking): tituloDesempenho (selo por percentil) + testes"
```

---

## Task 2: Rota `/api/perfil/[bilheteId]` (bônus)

**Files:**
- Create: `app/api/perfil/[bilheteId]/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: Request,
  { params }: { params: { bilheteId: string } },
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: bonus } = await admin
    .from('palpites_bonus')
    .select('tipo, jogador_nome, selecao:selecoes!selecao_id(nome, bandeira_emoji)')
    .eq('bilhete_id', params.bilheteId)
    .in('tipo', ['campeao', 'artilheiro'])

  let campeao: { nome: string; bandeira: string } | null = null
  let artilheiro: string | null = null
  for (const b of bonus ?? []) {
    if (b.tipo === 'campeao') {
      const sel = Array.isArray(b.selecao) ? b.selecao[0] : b.selecao
      if (sel) campeao = { nome: sel.nome, bandeira: sel.bandeira_emoji }
    } else if (b.tipo === 'artilheiro') {
      artilheiro = b.jogador_nome ?? null
    }
  }
  return NextResponse.json({ campeao, artilheiro })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` → limpo. (Se o tipo gerado do join `selecao` reclamar, ajuste o cast: `const sel = (Array.isArray(b.selecao) ? b.selecao[0] : b.selecao) as { nome: string; bandeira_emoji: string } | null`.)

- [ ] **Step 3: Commit**

```bash
git add app/api/perfil/[bilheteId]/route.ts
git commit -m "feat(ranking): rota /api/perfil/[bilhete] (bônus campeão/artilheiro)"
```

---

## Task 3: Componente `PerfilModal`

**Files:**
- Create: `components/ranking/PerfilModal.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { avatarColor, avatarInitials } from '@/lib/format/avatar-color'
import { BandeiraImg } from '@/components/ui/BandeiraImg'
import { FormaDots } from '@/components/ranking/FormaDots'
import { tituloDesempenho } from '@/lib/ranking/titulo'
import type { RankingRowData } from './RankingRow'

type Bonus = {
  campeao: { nome: string; bandeira: string } | null
  artilheiro: string | null
}

export function PerfilModal({
  entry,
  total,
  onClose,
}: {
  entry: RankingRowData | null
  total: number
  onClose: () => void
}) {
  const [bonus, setBonus] = useState<Bonus | null>(null)
  const [loading, setLoading] = useState(false)
  const bilheteId = entry?.melhorBilheteId ?? null

  useEffect(() => {
    if (!bilheteId) {
      setBonus(null)
      return
    }
    let cancel = false
    setLoading(true)
    setBonus(null)
    fetch(`/api/perfil/${bilheteId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Bonus | null) => {
        if (!cancel) setBonus(data)
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [bilheteId])

  const selo = entry ? tituloDesempenho(entry.posicao, total) : null

  return (
    <Dialog.Root open={entry !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#1f1f23] bg-[#0c0c0e] p-5 text-text-primary outline-none">
          {entry && selo && (
            <>
              <Dialog.Title className="sr-only">Perfil de {entry.nome}</Dialog.Title>
              <Dialog.Description className="sr-only">Card do apostador no ranking</Dialog.Description>

              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-bg-dark"
                  style={{ background: avatarColor(entry.userId) }}
                  aria-hidden="true"
                >
                  {avatarInitials(entry.nome)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-lg font-bold">{entry.nome}</div>
                  <div className="font-mono text-xs text-text-muted">{entry.posicao}º no ranking</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#1f1f23] bg-[#111] px-3 py-2">
                <span className="text-2xl" aria-hidden="true">{selo.emoji}</span>
                <span className="font-display text-xl tracking-wide">{selo.label}</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-accent text-xl font-bold tabular-nums">{entry.pontosTotais}</div>
                  <div className="text-[10px] uppercase text-text-muted">Pontos</div>
                </div>
                <div>
                  <div className="text-xl font-bold tabular-nums">{entry.acertosExatos}</div>
                  <div className="text-[10px] uppercase text-text-muted">Exatos</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex h-7 items-center"><FormaDots forma={entry.forma} /></div>
                  <div className="text-[10px] uppercase text-text-muted">Últimos 5</div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Palpites de bônus</div>
                {loading ? (
                  <div className="text-sm text-text-muted">Carregando…</div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true">🏆</span>
                      {bonus?.campeao ? (
                        <>
                          <BandeiraImg emoji={bonus.campeao.bandeira} nome={bonus.campeao.nome} size={18} />
                          <strong>{bonus.campeao.nome}</strong>
                        </>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true">⚽</span>
                      {bonus?.artilheiro ? <strong>{bonus.artilheiro}</strong> : <span className="text-text-muted">—</span>}
                    </div>
                  </>
                )}
              </div>

              <Dialog.Close className="mt-5 w-full rounded-lg bg-bg-elevated py-2 text-sm font-semibold text-text-muted hover:text-text-primary">
                Fechar
              </Dialog.Close>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: Teste de render (RTL)**

Crie `components/ranking/__tests__/PerfilModal.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PerfilModal } from '../PerfilModal'
import type { RankingRowData } from '../RankingRow'

const entry: RankingRowData = {
  userId: 'u1', nome: 'Fulano da Silva', posicao: 1, pontosTotais: 30,
  acertosExatos: 2, acertosParciais: 0, totalBilhetes: 1, tendencia: null,
  isCurrentUser: false, melhorBilheteId: 'b1', forma: ['verde', 'cinza'],
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ campeao: null, artilheiro: null }) }),
  ) as unknown as typeof fetch)
})

describe('<PerfilModal />', () => {
  it('renderiza nome e selo quando aberto', () => {
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    expect(screen.getByText('Fulano da Silva')).toBeInTheDocument()
    expect(screen.getByText('Bruxo')).toBeInTheDocument() // posição 1/100 = top 1%
  })
  it('não renderiza conteúdo quando entry é null', () => {
    render(<PerfilModal entry={null} total={100} onClose={() => {}} />)
    expect(screen.queryByText('Bruxo')).toBeNull()
  })
})
```

- [ ] **Step 3: Typecheck + testes**

Run: `npx tsc --noEmit && npx vitest run components/ranking/__tests__/PerfilModal.test.tsx`
Expected: limpo; 2 testes passam. *(Depende do `melhorBilheteId` da Task 4 no tipo `RankingRowData` — faça a Task 4 antes de rodar isto, ou rode após ela.)*

- [ ] **Step 4: Commit**

```bash
git add components/ranking/PerfilModal.tsx components/ranking/__tests__/PerfilModal.test.tsx
git commit -m "feat(ranking): componente PerfilModal (card do apostador) + teste"
```

---

## Task 4: `RankingRowData += melhorBilheteId` + anexar no page/route

**Files:**
- Modify: `components/ranking/RankingRow.tsx`
- Modify: `app/(dashboard)/ranking/page.tsx`
- Modify: `app/api/ranking/route.ts`

- [ ] **Step 1: Adicionar campo ao tipo (RankingRow.tsx)**

No `type RankingRowData`, depois de `forma?: string[] | null`, adicione:
```ts
  melhorBilheteId?: string | null
```

- [ ] **Step 2: Anexar em `page.tsx`**

No objeto retornado pelo `.map` que constrói `geral` (junto de `emoji`/`clube`/`forma`), adicione:
```ts
      melhorBilheteId: r.melhor_bilhete_id ?? null,
```

- [ ] **Step 3: Anexar em `route.ts`**

No objeto retornado pelo `.map` do `geral` (junto de `emoji`/`clube`/`forma`), adicione:
```ts
        melhorBilheteId: r.melhor_bilhete_id ?? null,
```
*(Ambos: `periodoRows` herda via spread `{ ...r }`, sem trabalho extra.)*

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` → limpo.
```bash
git add components/ranking/RankingRow.tsx "app/(dashboard)/ranking/page.tsx" app/api/ranking/route.ts
git commit -m "feat(ranking): melhorBilheteId na linha do ranking"
```

---

## Task 5: Avatar clicável + repassar `onAbrirPerfil`

**Files:**
- Modify: `components/ranking/RankingRow.tsx`
- Modify: `components/ranking/RankingTable.tsx`
- Modify: `components/ranking/RankingTabGeral.tsx`
- Modify: `components/ranking/RankingTabRodada.tsx`

- [ ] **Step 1: `RankingRow.tsx` — prop + avatar vira botão**

Mude a assinatura da função para receber o callback (opcional, pra não quebrar testes):
```tsx
export function RankingRow({
  data,
  onAbrirPerfil,
}: {
  data: RankingRowData
  onAbrirPerfil?: (d: RankingRowData) => void
}) {
```
Troque o `div.rank-avatar` por um `<button>` que dispara o callback:
```tsx
          <button
            type="button"
            className="rank-avatar"
            style={{ background: avatarColor(userId) }}
            onClick={() => onAbrirPerfil?.(data)}
            aria-label={`Ver perfil de ${nome}`}
          >
            {avatarInitials(nome)}
          </button>
```
*(Era um `<div aria-hidden="true">`. Como agora é interativo, vira `<button>` com `aria-label`.)*

- [ ] **Step 2: `RankingTable.tsx` — repassar**

```tsx
import { RankingRow, type RankingRowData } from './RankingRow'

export function RankingTable({
  rows,
  onAbrirPerfil,
}: {
  rows: RankingRowData[]
  onAbrirPerfil?: (d: RankingRowData) => void
}) {
  return (
    <div className="ranking-table-panel">
      <table className="ranking-table" role="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Apostador</th>
            <th className="hidden sm:table-cell">Acertos</th>
            <th className="hidden sm:table-cell">Tend.</th>
            <th>Pontos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RankingRow key={row.userId} data={row} {...(onAbrirPerfil ? { onAbrirPerfil } : {})} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
```
*(O spread condicional `{...(onAbrirPerfil ? { onAbrirPerfil } : {})}` evita passar `undefined` sob `exactOptionalPropertyTypes`.)*

- [ ] **Step 3: `RankingTabGeral.tsx` — repassar à tabela**

Adicione `onAbrirPerfil` aos props e passe à `RankingTable`:
```tsx
export function RankingTabGeral({
  rows,
  onAbrirPerfil,
}: {
  rows: RankingRowData[]
  onAbrirPerfil?: (d: RankingRowData) => void
}) {
```
E na renderização: `<RankingTable rows={rows} {...(onAbrirPerfil ? { onAbrirPerfil } : {})} />`

- [ ] **Step 4: `RankingTabRodada.tsx` — repassar à tabela**

```tsx
import { RankingTable } from './RankingTable'
import type { RankingRowData } from './RankingRow'

export function RankingTabRodada({
  label,
  rows,
  onAbrirPerfil,
}: {
  label: string
  rows: RankingRowData[]
  onAbrirPerfil?: (d: RankingRowData) => void
}) {
  return (
    <div>
      <div className="periodo-banner">
        <span className="periodo-banner-label">{label}</span>
      </div>
      {rows.length === 0 ? (
        <p className="ranking-empty-sub">Nenhum ponto registrado neste período ainda.</p>
      ) : (
        <RankingTable rows={rows} {...(onAbrirPerfil ? { onAbrirPerfil } : {})} />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → limpo.
```bash
git add components/ranking/RankingRow.tsx components/ranking/RankingTable.tsx components/ranking/RankingTabGeral.tsx components/ranking/RankingTabRodada.tsx
git commit -m "feat(ranking): avatar abre perfil (callback onAbrirPerfil)"
```

---

## Task 6: Estado do modal no `RankingShell`

**Files:**
- Modify: `components/ranking/RankingShell.tsx`

- [ ] **Step 1: Importar + estado + render**

Adicione os imports:
```tsx
import { PerfilModal } from './PerfilModal'
import type { RankingRowData } from './RankingRow'
```
*(o import de `RankingRowData` provavelmente já existe — não duplique.)*

Dentro do componente, adicione o estado:
```tsx
  const [perfil, setPerfil] = useState<RankingRowData | null>(null)
```

Passe `onAbrirPerfil={setPerfil}` para ambas as abas:
```tsx
      {tab === 'geral' ? (
        <RankingTabGeral rows={rows} onAbrirPerfil={setPerfil} />
      ) : (
        <RankingTabRodada label={periodoLabel} rows={periodoRows} onAbrirPerfil={setPerfil} />
      )}
```

E renderize o modal logo antes de fechar o `</div>` raiz:
```tsx
      <PerfilModal entry={perfil} total={totalApostadores} onClose={() => setPerfil(null)} />
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → limpo.
```bash
git add components/ranking/RankingShell.tsx
git commit -m "feat(ranking): RankingShell monta o PerfilModal (abre pelo avatar)"
```

---

## Task 7: Verificação final

- [ ] **Step 1: tsc + lint + testes + build**

Run:
```bash
npx tsc --noEmit && npx eslint lib/ranking components/ranking "app/(dashboard)/ranking" app/api/perfil app/api/ranking && npx vitest run && npx next build
```
Expected: tudo limpo; suíte verde (inclui `titulo.test.ts`); `✓ Compiled successfully`.

- [ ] **Step 2: Checagem manual em `/ranking`**

- Clicar **no avatar** de uma linha abre o modal; clicar no nome/linha **não** abre (e rolar a lista não dispara nada).
- Modal mostra: selo (ex.: 🧙 Bruxo no topo, 🤡 Chutador no fundo), pontos/exatos/form, e 🏆 campeão (bandeira+nome) + ⚽ artilheiro após carregar.
- Fechar pelo botão "Fechar", pelo X do overlay (clique fora) e pelo Esc.

---

## Fora de escopo
- Abrir pelo pódio (só a tabela).
- "Maior cravada / pior vacilo".
- Tocar na página `/ranking/[bilhete]` existente.
