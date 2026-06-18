# Modal de perfil: 6 bônus + trocar de tabela — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No modal de perfil do ranking, mostrar os 6 bônus (campeão/vice/3º/4º/artilheiro/revelação) e, com 2+ tabelas, clicar numa tabela faz o card inteiro virar aquela tabela (com "← Voltar").

**Architecture:** A rota `/api/perfil/[bilheteId]` (já por-bilhete) passa a retornar os 6 bônus + os stats da tabela pedida (numero/pontos/posição/exatos/forma). O modal ganha estado `selBilheteId`, topo condicional (default vs tabela), os 6 bônus e a lista clicável.

**Tech Stack:** Next.js 14 App Router, TS strict (`exactOptionalPropertyTypes`), Supabase (RLS p/ bônus/palpites; admin só p/ forma de jogos finalizados), `@radix-ui/react-dialog`, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-18-perfil-modal-bonus-trocar-tabela-design.md`

---

## File structure
- Modify `app/api/perfil/[bilheteId]/route.ts` — 6 bônus + stats/forma da tabela pedida.
- Modify `components/ranking/PerfilModal.tsx` — estado de tabela + 6 bônus + lista clicável + Voltar.
- Modify `components/ranking/__tests__/PerfilModal.test.tsx` — mock novo shape + 2 casos.

---

## Task 1: Rota — 6 bônus + stats/forma por bilhete

**Files:**
- Modify: `app/api/perfil/[bilheteId]/route.ts`

- [ ] **Step 1: Substituir o arquivo inteiro**

Conteúdo COMPLETO de `app/api/perfil/[bilheteId]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { calcularForma } from '@/lib/ranking/badges'

type Tabela = { bilheteId: string; numero: number; pontos: number; posicao: number; exatos: number }
type BonusSel = { nome: string; bandeira: string } | null

export async function GET(
  _req: Request,
  { params }: { params: { bilheteId: string } },
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // bônus (6 tipos) — RLS já libera pós-início
  const { data: bonus } = await supabase
    .from('palpites_bonus')
    .select('tipo, jogador_nome, selecao:selecoes!selecao_id(nome, bandeira_emoji)')
    .eq('bilhete_id', params.bilheteId)
    .in('tipo', ['campeao', 'vice', 'terceiro', 'quarto', 'artilheiro', 'revelacao'])

  const selOf = (b: { selecao: unknown }): BonusSel => {
    const s = (Array.isArray(b.selecao) ? b.selecao[0] : b.selecao) as
      | { nome: string; bandeira_emoji: string }
      | null
      | undefined
    return s ? { nome: s.nome, bandeira: s.bandeira_emoji } : null
  }
  let campeao: BonusSel = null
  let vice: BonusSel = null
  let terceiro: BonusSel = null
  let quarto: BonusSel = null
  let revelacao: BonusSel = null
  let artilheiro: string | null = null
  for (const b of bonus ?? []) {
    if (b.tipo === 'campeao') campeao = selOf(b)
    else if (b.tipo === 'vice') vice = selOf(b)
    else if (b.tipo === 'terceiro') terceiro = selOf(b)
    else if (b.tipo === 'quarto') quarto = selOf(b)
    else if (b.tipo === 'revelacao') revelacao = selOf(b)
    else if (b.tipo === 'artilheiro') artilheiro = b.jogador_nome ?? null
  }

  // tabelas + stats — via view `ranking` (user_id do dono vem da própria view)
  let tabelas: Tabela[] = []
  let donoUserId: string | null = null
  const { data: donoRow } = await supabase
    .from('ranking')
    .select('user_id')
    .eq('bilhete_id', params.bilheteId)
    .maybeSingle()
  if (donoRow?.user_id) {
    donoUserId = donoRow.user_id
    const { data: rows } = await supabase
      .from('ranking')
      .select('bilhete_id, numero_bilhete, pontos_totais, posicao, acertos_exatos')
      .eq('user_id', donoRow.user_id)
      .order('numero_bilhete', { ascending: true })
    tabelas = (rows ?? [])
      .filter((r): r is typeof r & { bilhete_id: string } => r.bilhete_id !== null)
      .map((r) => ({
        bilheteId: r.bilhete_id,
        numero: r.numero_bilhete ?? 0,
        pontos: r.pontos_totais ?? 0,
        posicao: r.posicao ?? 0,
        exatos: r.acertos_exatos ?? 0,
      }))
  }
  const self = tabelas.find((t) => t.bilheteId === params.bilheteId) ?? null

  const { count } = await supabase.from('ranking').select('*', { count: 'exact', head: true })

  // forma (últimos 5) da tabela pedida — via admin (jogos finalizados, públicos)
  let forma: string[] = []
  if (donoUserId) {
    const admin = createSupabaseAdminClient()
    const formaMap = await calcularForma(admin, [
      { userId: donoUserId, melhorBilheteId: params.bilheteId },
    ])
    forma = formaMap.get(donoUserId) ?? []
  }

  // palpites por jogo TRAVADO (RLS já libera só os iniciados)
  const agoraIso = new Date().toISOString()
  const { data: jogosTravados } = await supabase
    .from('jogos')
    .select(
      'id, numero_jogo, data_hora, finalizado, gols_casa, gols_fora, placeholder_casa, placeholder_fora, ' +
        'selecao_casa:selecoes!selecao_casa_id(nome, bandeira_emoji), ' +
        'selecao_fora:selecoes!selecao_fora_id(nome, bandeira_emoji)',
    )
    .lte('data_hora', agoraIso)
    .order('data_hora', { ascending: false })

  const { data: meusPalps } = await supabase
    .from('palpites')
    .select('jogo_id, gols_casa, gols_fora, pontos_calculados')
    .eq('bilhete_id', params.bilheteId)
  const palpMap = new Map<number, { gc: number; gf: number; pts: number | null }>()
  for (const p of meusPalps ?? []) {
    palpMap.set(p.jogo_id, { gc: p.gols_casa, gf: p.gols_fora, pts: p.pontos_calculados })
  }

  type JogoTravado = {
    id: number
    numero_jogo: number | null
    data_hora: string
    finalizado: boolean | null
    gols_casa: number | null
    gols_fora: number | null
    placeholder_casa: string | null
    placeholder_fora: string | null
    selecao_casa: { nome: string; bandeira_emoji: string } | { nome: string; bandeira_emoji: string }[] | null
    selecao_fora: { nome: string; bandeira_emoji: string } | { nome: string; bandeira_emoji: string }[] | null
  }
  const palpites = ((jogosTravados as unknown as JogoTravado[]) ?? []).map((j) => {
    const c = Array.isArray(j.selecao_casa) ? j.selecao_casa[0] : j.selecao_casa
    const f = Array.isArray(j.selecao_fora) ? j.selecao_fora[0] : j.selecao_fora
    const meu = palpMap.get(j.id)
    return {
      numeroJogo: j.numero_jogo,
      dataHora: j.data_hora,
      casa: c?.nome ?? j.placeholder_casa ?? '?',
      fora: f?.nome ?? j.placeholder_fora ?? '?',
      bandeiraCasa: c?.bandeira_emoji ?? null,
      bandeiraFora: f?.bandeira_emoji ?? null,
      palpiteCasa: meu?.gc ?? null,
      palpiteFora: meu?.gf ?? null,
      realCasa: j.gols_casa,
      realFora: j.gols_fora,
      finalizado: j.finalizado,
      pontos: meu?.pts ?? null,
    }
  })

  return NextResponse.json({
    campeao,
    vice,
    terceiro,
    quarto,
    revelacao,
    artilheiro,
    numero: self?.numero ?? 0,
    pontos: self?.pontos ?? 0,
    posicao: self?.posicao ?? 0,
    exatos: self?.exatos ?? 0,
    forma,
    tabelas,
    totalTabelas: count ?? 0,
    palpites,
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo. (Se acusar o tipo do join `selecao` em `selOf`, o cast já está no helper. Confirme que `calcularForma` é exportado de `@/lib/ranking/badges` — é.)

- [ ] **Step 3: Commit**

```bash
git add "app/api/perfil/[bilheteId]/route.ts"
git commit -m "feat(ranking): rota /api/perfil retorna 6 bônus + stats/forma por tabela"
```

---

## Task 2: Modal — 6 bônus + trocar de tabela + Voltar

**Files:**
- Modify: `components/ranking/PerfilModal.tsx`
- Modify: `components/ranking/__tests__/PerfilModal.test.tsx`

- [ ] **Step 1: Substituir `PerfilModal.tsx` inteiro**

Conteúdo COMPLETO de `components/ranking/PerfilModal.tsx`:
```tsx
'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { avatarColor, avatarInitials } from '@/lib/format/avatar-color'
import { BandeiraImg } from '@/components/ui/BandeiraImg'
import { FormaDots } from '@/components/ranking/FormaDots'
import { tituloDesempenho } from '@/lib/ranking/titulo'
import { agruparPorDia, type PalpiteJogo } from '@/lib/ranking/agruparPorDia'
import type { RankingRowData } from './RankingRow'

type BonusSel = { nome: string; bandeira: string } | null
type Tabela = { bilheteId: string; numero: number; pontos: number; posicao: number }
type PerfilData = {
  campeao: BonusSel
  vice: BonusSel
  terceiro: BonusSel
  quarto: BonusSel
  revelacao: BonusSel
  artilheiro: string | null
  numero: number
  pontos: number
  posicao: number
  exatos: number
  forma: string[]
  tabelas: Tabela[]
  totalTabelas: number
  palpites: PalpiteJogo[]
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
  const [data, setData] = useState<PerfilData | null>(null)
  const [loading, setLoading] = useState(false)
  const [verTodos, setVerTodos] = useState(false)
  const [selBilheteId, setSelBilheteId] = useState<string | null>(entry?.melhorBilheteId ?? null)

  // ao abrir outro perfil, volta pra melhor tabela
  useEffect(() => {
    setSelBilheteId(entry?.melhorBilheteId ?? null)
  }, [entry?.melhorBilheteId])

  useEffect(() => {
    setVerTodos(false)
    if (!selBilheteId) {
      setData(null)
      return
    }
    let cancel = false
    setLoading(true)
    setData(null)
    fetch(`/api/perfil/${selBilheteId}`)
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
  }, [selBilheteId])

  const isDefault = entry != null && selBilheteId === entry.melhorBilheteId
  const selo = !entry
    ? null
    : isDefault
      ? tituloDesempenho(entry.posicao, total)
      : data
        ? tituloDesempenho(data.posicao, data.totalTabelas)
        : null
  const pontos = isDefault ? (entry?.pontosTotais ?? 0) : (data?.pontos ?? 0)
  const exatos = isDefault ? (entry?.acertosExatos ?? 0) : (data?.exatos ?? 0)
  const forma = isDefault ? (entry?.forma ?? null) : (data?.forma ?? null)
  const subtitle = !entry
    ? ''
    : isDefault
      ? `${entry.posicao}º no ranking`
      : data
        ? `Tabela nº${data.numero} · ${data.posicao}ª de ${data.totalTabelas}`
        : 'Carregando…'
  const topReady = isDefault || data != null

  const grupos = data ? agruparPorDia(data.palpites) : []
  const gruposVisiveis = verTodos ? grupos : grupos.slice(0, 1)
  const escondidos = grupos.slice(1).reduce((n, g) => n + g.jogos.length, 0)

  const bonusSelecoes: [string, string, BonusSel][] = [
    ['🏆', 'Campeão', data?.campeao ?? null],
    ['🥈', 'Vice', data?.vice ?? null],
    ['🥉', '3º lugar', data?.terceiro ?? null],
    ['4️⃣', '4º lugar', data?.quarto ?? null],
  ]

  return (
    <Dialog.Root open={entry !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-[#0c0c0e]/70 p-5 text-text-primary shadow-2xl shadow-black/50 outline-none backdrop-blur-2xl scrollbar-glass">
          {entry && (
            <>
              <Dialog.Title className="sr-only">Perfil de {entry.nome}</Dialog.Title>
              <Dialog.Description className="sr-only">Card do apostador no ranking</Dialog.Description>

              {!isDefault && (
                <button
                  type="button"
                  onClick={() => setSelBilheteId(entry.melhorBilheteId ?? null)}
                  className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-text-primary"
                >
                  ← Voltar pro card do ranking
                </button>
              )}

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
                  <div className="font-mono text-xs text-text-muted">{subtitle}</div>
                </div>
              </div>

              {selo && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#1f1f23] bg-[#111] px-3 py-2">
                  <span className="text-2xl" aria-hidden="true">{selo.emoji}</span>
                  <span className="font-display text-xl tracking-wide">{selo.label}</span>
                </div>
              )}

              {topReady ? (
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-accent text-xl font-bold tabular-nums">{pontos}</div>
                    <div className="text-[10px] uppercase text-text-muted">Pontos</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold tabular-nums">{exatos}</div>
                    <div className="text-[10px] uppercase text-text-muted">Exatos</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="flex h-7 items-center"><FormaDots forma={forma} /></div>
                    <div className="text-[10px] uppercase text-text-muted">Últimos 5</div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-text-muted">Carregando…</div>
              )}

              <div className="mt-4 space-y-1.5">
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Palpites de bônus</div>
                {loading ? (
                  <div className="text-sm text-text-muted">Carregando…</div>
                ) : (
                  <>
                    {bonusSelecoes.map(([icon, label, sel]) => (
                      <div key={label} className="flex items-center gap-2 text-sm">
                        <span aria-hidden="true">{icon}</span>
                        <span className="w-20 shrink-0 text-xs text-text-muted">{label}</span>
                        {sel ? (
                          <>
                            <BandeiraImg emoji={sel.bandeira} nome={sel.nome} size={16} />
                            <strong className="truncate">{sel.nome}</strong>
                          </>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true">⚽</span>
                      <span className="w-20 shrink-0 text-xs text-text-muted">Artilheiro</span>
                      {data?.artilheiro ? (
                        <strong className="truncate">{data.artilheiro}</strong>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true">🌟</span>
                      <span className="w-20 shrink-0 text-xs text-text-muted">Revelação</span>
                      {data?.revelacao ? (
                        <>
                          <BandeiraImg emoji={data.revelacao.bandeira} nome={data.revelacao.nome} size={16} />
                          <strong className="truncate">{data.revelacao.nome}</strong>
                        </>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {data && data.tabelas.length > 1 && (
                <div className="mt-4 space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">Pontuação por tabela</div>
                  {data.tabelas.map((t) => {
                    const sel = t.bilheteId === selBilheteId
                    return (
                      <button
                        key={t.bilheteId}
                        type="button"
                        onClick={() => setSelBilheteId(t.bilheteId)}
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                          sel ? 'bg-white/[0.06] ring-1 ring-accent/40' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span>Tabela nº{t.numero}</span>
                          {t.bilheteId === entry.melhorBilheteId && (
                            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-accent">
                              ★ ranking
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-text-muted">
                          <strong className="text-text-primary">{t.pontos}</strong> pts · {t.posicao}ª de {data.totalTabelas}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {grupos.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">Palpites nos jogos</div>
                  {gruposVisiveis.map((grupo) => (
                    <div key={grupo.dia} className="space-y-1">
                      <div className="font-mono text-[10px] text-text-muted">{grupo.label}</div>
                      {grupo.jogos.map((j) => (
                        <div key={j.numeroJogo} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-1">
                            <BandeiraImg emoji={j.bandeiraCasa} nome={j.casa} size={14} />
                            <span className="truncate">{j.casa}</span>
                            {j.palpiteCasa != null && j.palpiteFora != null ? (
                              <strong className="px-1 tabular-nums">{j.palpiteCasa}×{j.palpiteFora}</strong>
                            ) : (
                              <span className="px-1 text-text-muted">— sem palpite</span>
                            )}
                            <span className="truncate">{j.fora}</span>
                            <BandeiraImg emoji={j.bandeiraFora} nome={j.fora} size={14} />
                          </span>
                          <span className="shrink-0 font-mono text-text-muted">
                            {j.finalizado ? (
                              <>
                                real {j.realCasa}×{j.realFora}
                                {j.palpiteCasa != null && (
                                  <strong className="text-accent"> · +{j.pontos ?? 0}</strong>
                                )}
                              </>
                            ) : (
                              'em andamento'
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {grupos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setVerTodos((v) => !v)}
                      aria-expanded={verTodos}
                      className="w-full rounded-lg border border-white/10 py-1.5 text-xs font-semibold text-text-muted hover:text-text-primary"
                    >
                      {verTodos ? 'Ver menos' : `Ver todos os palpites (+${escondidos})`}
                    </button>
                  )}
                </div>
              )}

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

- [ ] **Step 2: Atualizar o teste**

Em `components/ranking/__tests__/PerfilModal.test.tsx`:

(a) Garanta que o import inclui `fireEvent`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
```

(b) Troque o `beforeEach` default pra incluir o shape novo:
```tsx
beforeEach(() => {
  mockFetch({
    campeao: null, vice: null, terceiro: null, quarto: null, revelacao: null, artilheiro: null,
    numero: 117, pontos: 30, posicao: 1, exatos: 2, forma: [],
    tabelas: [], totalTabelas: 0, palpites: [],
  })
})
```

(c) No teste "lista pontuação por tabela quando há 2+ tabelas", o mock atual já passa `tabelas` com 2 itens — acrescente os campos novos ao objeto (`vice:null, terceiro:null, quarto:null, revelacao:null, numero:117, pontos:50, posicao:12, exatos:0, forma:[]`) pra ficar completo. As asserções (`getByText('Tabela nº117')` etc.) seguem válidas (o texto está dentro do `<button>` agora).

(d) Adicione dois testes novos dentro do `describe`:
```tsx
  it('mostra os 6 rótulos de bônus', async () => {
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    for (const label of ['Campeão', 'Vice', '3º lugar', '4º lugar', 'Artilheiro', 'Revelação']) {
      expect(await screen.findByText(label)).toBeInTheDocument()
    }
  })

  it('trocar de tabela mostra "Voltar"; voltar limpa', async () => {
    mockFetch({
      campeao: null, vice: null, terceiro: null, quarto: null, revelacao: null, artilheiro: null,
      numero: 117, pontos: 50, posicao: 12, exatos: 2, forma: [], totalTabelas: 148, palpites: [],
      tabelas: [
        { bilheteId: 'b1', numero: 117, pontos: 50, posicao: 12 },
        { bilheteId: 'b2', numero: 130, pontos: 20, posicao: 80 },
      ],
    })
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    fireEvent.click(await screen.findByText('Tabela nº130'))
    const voltar = await screen.findByText(/voltar/i)
    expect(voltar).toBeInTheDocument()
    fireEvent.click(voltar)
    expect(screen.queryByText(/voltar/i)).toBeNull()
  })
```
*(O `entry` do arquivo de teste já tem `melhorBilheteId: 'b1'`, então clicar em `b2` torna `isDefault` falso → aparece o "Voltar".)*

- [ ] **Step 3: Typecheck + testes**

Run: `npx tsc --noEmit && npx vitest run components/ranking/__tests__/PerfilModal.test.tsx`
Expected: tsc limpo; todos os testes passam (os antigos ajustados + os 2 novos). Avisos `act()` do Radix são cosméticos. Se algum teste antigo falhar por shape do mock, ajuste o mock daquele teste com os campos novos (sem enfraquecer asserções).

- [ ] **Step 4: Commit**

```bash
git add components/ranking/PerfilModal.tsx components/ranking/__tests__/PerfilModal.test.tsx
git commit -m "feat(ranking): modal mostra 6 bônus + troca de tabela (card inteiro) + Voltar"
```

---

## Task 3: Verificação final

- [ ] **Step 1: tsc + lint + testes + build**

Run:
```bash
npx tsc --noEmit && npx eslint components/ranking app/api/perfil && npx vitest run && npx next build
```
Expected: tudo limpo; suíte verde; `✓ Compiled successfully`.

- [ ] **Step 2: Checagem manual em `/ranking`**

- Clicar no avatar de alguém: bloco de bônus mostra os 6 (🏆 Campeão, 🥈 Vice, 🥉 3º, 4️⃣ 4º, ⚽ Artilheiro, 🌟 Revelação), cada um com seleção+bandeira ou "—".
- Quem tem 2+ tabelas: clicar numa tabela troca **o card inteiro** (selo, pontos, exatos, form, bônus, palpites) pra ela; a linha clicada fica destacada; aparece **"← Voltar"** que retorna ao card do ranking.
- A tabela do ranking mostra "Xº no ranking"; as outras "Tabela nºX · Yª de Z tabelas".

---

## Fora de escopo
- Trocar de pessoa; mexer no /ranking; migration.
