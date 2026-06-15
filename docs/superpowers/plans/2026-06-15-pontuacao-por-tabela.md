# Pontuação por tabela — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar os pontos (e a posição entre todas as tabelas) de cada tabela em Minhas Tabelas e no modal de perfil do ranking.

**Architecture:** Os dados já existem na view `public.ranking` (uma linha por bilhete confirmado, legível por qualquer autenticado). A rota `/api/perfil/[bilheteId]` passa a devolver a lista de tabelas do dono (lookup do `user_id` pela própria view, sem esbarrar em RLS de `bilhetes`). `PerfilModal` lista as tabelas quando há 2+. `minhas-tabelas` lê a view pros bilhetes do próprio usuário e o `TabelaCard` exibe pontos+posição. Sem migration.

**Tech Stack:** Next.js 14 App Router, TS strict (`exactOptionalPropertyTypes`), Supabase (view `ranking` já tipada em `lib/database.types.ts`), Vitest + React Testing Library, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-15-pontuacao-por-tabela-design.md`

---

## File structure

- Modify `app/api/perfil/[bilheteId]/route.ts` — retornar `tabelas` + `totalTabelas`.
- Modify `components/ranking/PerfilModal.tsx` — tipo `PerfilData`, seção "Pontuação por tabela".
- Modify `components/ranking/__tests__/PerfilModal.test.tsx` — atualizar mock + novo caso.
- Modify `components/minhas-tabelas/TabelaCard.tsx` — props `pontos`/`posicao`/`totalTabelas` + bloco.
- Create `components/minhas-tabelas/__tests__/TabelaCard.test.tsx` — render.
- Modify `app/(dashboard)/minhas-tabelas/page.tsx` — consultar `ranking`, passar props.

Referência — colunas da view `ranking` (de `lib/database.types.ts`): `bilhete_id`, `numero_bilhete`, `user_id`, `nome`, `pontos_totais`, `acertos_exatos`, `acertos_parciais`, `pontos_mata_mata`, `acertou_campeao`, `posicao` (todas nullable).

---

## Task 1: Rota `/api/perfil/[bilheteId]` devolve as tabelas do dono

**Files:**
- Modify: `app/api/perfil/[bilheteId]/route.ts`

- [ ] **Step 1: Reescrever a rota (mantém bônus, adiciona tabelas)**

Conteúdo COMPLETO do arquivo:
```ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type Tabela = { bilheteId: string; numero: number; pontos: number; posicao: number }

export async function GET(
  _req: Request,
  { params }: { params: { bilheteId: string } },
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // bônus do bilhete (RLS: visível pós-início)
  const { data: bonus } = await supabase
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

  // tabelas do dono — user_id vem da própria view `ranking` (legível p/ autenticado,
  // evita o RLS de `bilhetes` que bloquearia ler bilhete de outro usuário)
  let tabelas: Tabela[] = []
  const { data: donoRow } = await supabase
    .from('ranking')
    .select('user_id')
    .eq('bilhete_id', params.bilheteId)
    .maybeSingle()
  if (donoRow?.user_id) {
    const { data: rows } = await supabase
      .from('ranking')
      .select('bilhete_id, numero_bilhete, pontos_totais, posicao')
      .eq('user_id', donoRow.user_id)
      .order('numero_bilhete', { ascending: true })
    tabelas = (rows ?? [])
      .filter((r): r is typeof r & { bilhete_id: string } => r.bilhete_id !== null)
      .map((r) => ({
        bilheteId: r.bilhete_id,
        numero: r.numero_bilhete ?? 0,
        pontos: r.pontos_totais ?? 0,
        posicao: r.posicao ?? 0,
      }))
  }

  const { count } = await supabase
    .from('ranking')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({ campeao, artilheiro, tabelas, totalTabelas: count ?? 0 })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 3: Commit**

```bash
git add "app/api/perfil/[bilheteId]/route.ts"
git commit -m "feat(ranking): rota /api/perfil retorna tabelas+pontos do dono"
```

---

## Task 2: `PerfilModal` — seção "Pontuação por tabela"

**Files:**
- Modify: `components/ranking/PerfilModal.tsx`
- Modify: `components/ranking/__tests__/PerfilModal.test.tsx`

- [ ] **Step 1: Atualizar tipos + estado + fetch**

No `PerfilModal.tsx`, substitua o bloco do tipo `Bonus` (linhas atuais 11-14):
```ts
type Bonus = {
  campeao: { nome: string; bandeira: string } | null
  artilheiro: string | null
}
```
por:
```ts
type Tabela = { bilheteId: string; numero: number; pontos: number; posicao: number }
type PerfilData = {
  campeao: { nome: string; bandeira: string } | null
  artilheiro: string | null
  tabelas: Tabela[]
  totalTabelas: number
}
```

Troque o estado e o fetch. De:
```ts
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
      .catch(() => {
        if (!cancel) setBonus(null)
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [bilheteId])
```
para:
```ts
  const [data, setData] = useState<PerfilData | null>(null)
  const [loading, setLoading] = useState(false)
  const bilheteId = entry?.melhorBilheteId ?? null

  useEffect(() => {
    if (!bilheteId) {
      setData(null)
      return
    }
    let cancel = false
    setLoading(true)
    setData(null)
    fetch(`/api/perfil/${bilheteId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PerfilData | null) => {
        if (!cancel) setData(d)
      })
      .catch(() => {
        if (!cancel) setData(null)
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [bilheteId])
```

- [ ] **Step 2: Atualizar as referências de bônus + adicionar a seção de tabelas**

No bloco de bônus, troque as duas referências `bonus?.campeao` → `data?.campeao` e `bonus?.artilheiro` → `data?.artilheiro` (linhas atuais ~107 e ~118). Trecho final do bloco de bônus deve ficar:
```tsx
                    <div className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true">🏆</span>
                      {data?.campeao ? (
                        <>
                          <BandeiraImg emoji={data.campeao.bandeira} nome={data.campeao.nome} size={18} />
                          <strong>{data.campeao.nome}</strong>
                        </>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true">⚽</span>
                      {data?.artilheiro ? <strong>{data.artilheiro}</strong> : <span className="text-text-muted">—</span>}
                    </div>
```

Logo APÓS o fechamento desse `<div className="mt-4 space-y-2">` do bloco de bônus (antes do `<Dialog.Close ...>`), adicione a seção de tabelas:
```tsx
              {data && data.tabelas.length > 1 && (
                <div className="mt-4 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">Pontuação por tabela</div>
                  {data.tabelas.map((t) => (
                    <div key={t.bilheteId} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <span>Tabela nº{t.numero}</span>
                        {t.bilheteId === entry.melhorBilheteId && (
                          <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent">
                            ★ ranking
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-text-muted">
                        <strong className="text-text-primary">{t.pontos}</strong> pts · {t.posicao}ª
                      </span>
                    </div>
                  ))}
                </div>
              )}
```

- [ ] **Step 3: Atualizar o teste**

Substitua o conteúdo de `components/ranking/__tests__/PerfilModal.test.tsx` por:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PerfilModal } from '../PerfilModal'
import type { RankingRowData } from '../RankingRow'

const entry: RankingRowData = {
  userId: 'u1', nome: 'Fulano da Silva', posicao: 1, pontosTotais: 30,
  acertosExatos: 2, acertosParciais: 0, totalBilhetes: 3, tendencia: null,
  isCurrentUser: false, melhorBilheteId: 'b1', forma: ['verde', 'cinza'],
}

function mockFetch(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(payload) }),
  ) as unknown as typeof fetch)
}

beforeEach(() => {
  mockFetch({ campeao: null, artilheiro: null, tabelas: [], totalTabelas: 0 })
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
  it('lista pontuação por tabela quando há 2+ tabelas', async () => {
    mockFetch({
      campeao: null, artilheiro: null, totalTabelas: 148,
      tabelas: [
        { bilheteId: 'b1', numero: 117, pontos: 50, posicao: 12 },
        { bilheteId: 'b2', numero: 130, pontos: 20, posicao: 80 },
      ],
    })
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    expect(await screen.findByText('Pontuação por tabela')).toBeInTheDocument()
    expect(screen.getByText('Tabela nº117')).toBeInTheDocument()
    expect(screen.getByText('Tabela nº130')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Typecheck + testes**

Run: `npx tsc --noEmit && npx vitest run components/ranking/__tests__/PerfilModal.test.tsx`
Expected: limpo; 3 testes passam.

- [ ] **Step 5: Commit**

```bash
git add components/ranking/PerfilModal.tsx components/ranking/__tests__/PerfilModal.test.tsx
git commit -m "feat(ranking): modal lista pontuação por tabela (2+ tabelas)"
```

---

## Task 3: `TabelaCard` — exibir pontos + posição

**Files:**
- Modify: `components/minhas-tabelas/TabelaCard.tsx`
- Create: `components/minhas-tabelas/__tests__/TabelaCard.test.tsx`

- [ ] **Step 1: Escrever o teste primeiro**

Crie `components/minhas-tabelas/__tests__/TabelaCard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TabelaCard } from '../TabelaCard'
import type { BilheteResumo } from '@/lib/palpites'

const base: BilheteResumo = {
  id: 'b1', numero_bilhete: 117, valor_pago: 20,
  status_pagamento: 'confirmado', selecao_cashback_id: null,
}

describe('<TabelaCard />', () => {
  it('mostra pontos e posição quando confirmado', () => {
    render(
      <TabelaCard bilhete={base} palpitesCount={10} selecaoCashback={null}
        pontos={50} posicao={12} totalTabelas={148} />,
    )
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText(/12ª de 148/)).toBeInTheDocument()
  })
  it('não mostra pontuação quando não confirmado', () => {
    render(
      <TabelaCard bilhete={{ ...base, status_pagamento: 'pendente' }} palpitesCount={0}
        selecaoCashback={null} pontos={null} posicao={null} totalTabelas={148} />,
    )
    expect(screen.queryByText(/de 148/)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run components/minhas-tabelas/__tests__/TabelaCard.test.tsx`
Expected: FAIL (props `pontos`/`posicao` ainda não existem; nada renderizado).

- [ ] **Step 3: Adicionar props + bloco de exibição**

Em `TabelaCard.tsx`, troque o `type Props` e a assinatura. De:
```tsx
type Props = {
  bilhete: BilheteResumo;
  palpitesCount: number;
  selecaoCashback: SelecaoBasica | null;
};

const TOTAL_JOGOS = 104;

export function TabelaCard({ bilhete, palpitesCount, selecaoCashback }: Props) {
```
para:
```tsx
type Props = {
  bilhete: BilheteResumo;
  palpitesCount: number;
  selecaoCashback: SelecaoBasica | null;
  pontos?: number | null;
  posicao?: number | null;
  totalTabelas?: number | null;
};

const TOTAL_JOGOS = 104;

export function TabelaCard({
  bilhete,
  palpitesCount,
  selecaoCashback,
  pontos = null,
  posicao = null,
  totalTabelas = null,
}: Props) {
```

Adicione o bloco de pontuação logo APÓS o `<div>` do cashback (o que tem `border-t mt-3 ... text-sm`) e ANTES do `<div className="mt-4">` do botão:
```tsx
      {confirmado && pontos != null && (
        <div className="border-border mt-3 flex items-baseline gap-2 border-t pt-3">
          <span className="text-accent text-lg font-bold tabular-nums">{pontos}</span>
          <span className="text-text-muted text-xs">
            pts{posicao != null && totalTabelas != null ? ` · ${posicao}ª de ${totalTabelas}` : ''}
          </span>
        </div>
      )}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run components/minhas-tabelas/__tests__/TabelaCard.test.tsx`
Expected: 2 testes passam.

- [ ] **Step 5: Commit**

```bash
git add components/minhas-tabelas/TabelaCard.tsx components/minhas-tabelas/__tests__/TabelaCard.test.tsx
git commit -m "feat(minhas-tabelas): TabelaCard mostra pontos + posição"
```

---

## Task 4: `minhas-tabelas` — buscar pontos da view e passar ao card

**Files:**
- Modify: `app/(dashboard)/minhas-tabelas/page.tsx`

- [ ] **Step 1: Consultar a view `ranking` + total**

Logo após o bloco que monta `countMap` (o `for (const p of palpitesAll ?? []) { ... }`), adicione:
```ts
  const { data: rankingRows } = bilheteIds.length
    ? await supabase
        .from('ranking')
        .select('bilhete_id, pontos_totais, posicao')
        .eq('user_id', user.id)
    : { data: [] };

  const pontosMap = new Map<string, { pontos: number; posicao: number }>();
  for (const r of rankingRows ?? []) {
    if (r.bilhete_id) {
      pontosMap.set(r.bilhete_id, { pontos: r.pontos_totais ?? 0, posicao: r.posicao ?? 0 });
    }
  }

  const { count: totalTabelas } = await supabase
    .from('ranking')
    .select('*', { count: 'exact', head: true });
```

- [ ] **Step 2: Passar as props no `.map`**

Troque o `bilhetesData.map(...)` que renderiza `<TabelaCard .../>` por:
```tsx
        {bilhetesData.map((b) => {
          const pts = pontosMap.get(b.id);
          return (
            <TabelaCard
              key={b.id}
              bilhete={b as BilheteResumo}
              palpitesCount={countMap.get(b.id) ?? 0}
              selecaoCashback={
                b.selecao_cashback_id ? (selecaoMap.get(b.selecao_cashback_id) ?? null) : null
              }
              pontos={pts?.pontos ?? null}
              posicao={pts?.posicao ?? null}
              totalTabelas={totalTabelas ?? null}
            />
          );
        })}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "app/(dashboard)/minhas-tabelas"`
Expected: limpo.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/minhas-tabelas/page.tsx"
git commit -m "feat(minhas-tabelas): pontos+posição por tabela vindos da view ranking"
```

---

## Task 5: Verificação final

- [ ] **Step 1: tsc + lint + testes + build**

Run:
```bash
npx tsc --noEmit && npx eslint components/ranking components/minhas-tabelas "app/(dashboard)/minhas-tabelas" app/api/perfil && npx vitest run && npx next build
```
Expected: tudo limpo; suíte verde (inclui `PerfilModal.test.tsx` com 3 testes e `TabelaCard.test.tsx` com 2); `✓ Compiled successfully`.

- [ ] **Step 2: Checagem manual**

- `/minhas-tabelas`: cada tabela **confirmada** mostra `<pontos> pts · <pos>ª de <total>`; pendente não mostra pontuação.
- `/ranking`: clicar no avatar de quem tem **2+ tabelas** abre o modal com a seção "Pontuação por tabela", uma linha por tabela (`Tabela nº117 — 50 pts · 12ª`), com selo "★ ranking" na melhor; quem tem 1 tabela não mostra a seção.

---

## Fora de escopo
- Mudar o `/ranking` (continua por pessoa).
- Página/aba de ranking por bilhete.
- Pontuação de tabelas não confirmadas (não existem na view `ranking`).
