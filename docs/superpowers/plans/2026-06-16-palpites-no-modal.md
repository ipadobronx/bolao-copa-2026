# Palpites por jogo no modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar no modal de perfil do ranking, agrupado por dia, o placar que a melhor tabela da pessoa cravou em cada jogo já travado (com resultado oficial + pontos nos finalizados).

**Architecture:** A rota `/api/perfil/[bilheteId]` passa a retornar `palpites[]` — um item por jogo já iniciado (RLS já esconde jogos futuros), com o palpite da melhor tabela ou `null`. Um helper puro agrupa por dia BRT. O `PerfilModal` renderiza a seção e ganha scroll interno.

**Tech Stack:** Next.js 14 App Router, TS strict (`exactOptionalPropertyTypes`), Supabase (RLS `palpites_select_own_or_started` filtra por jogo iniciado), Vitest + RTL, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-16-palpites-no-modal-design.md`

---

## File structure

- Modify `app/api/perfil/[bilheteId]/route.ts` — adicionar `palpites[]` à resposta.
- Create `lib/ranking/agruparPorDia.ts` — tipo `PalpiteJogo` + função pura `agruparPorDia`.
- Create `lib/ranking/__tests__/agruparPorDia.test.ts`.
- Modify `components/ranking/PerfilModal.tsx` — seção "Palpites nos jogos" + scroll no Content.
- Modify `components/ranking/__tests__/PerfilModal.test.tsx` — mock + novo caso.

---

## Task 1: Rota retorna `palpites[]` dos jogos travados

**Files:**
- Modify: `app/api/perfil/[bilheteId]/route.ts`

- [ ] **Step 1: Adicionar a query de palpites + merge antes do `return`**

No arquivo, ANTES da linha final `return NextResponse.json({ campeao, artilheiro, tabelas, totalTabelas: count ?? 0 })`, insira:
```ts
  // palpites por jogo TRAVADO (RLS `palpites_select_own_or_started` já libera só os iniciados).
  // Lista todos os jogos já iniciados; anexa o palpite da melhor tabela (bilheteId) ou null.
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

  const palpites = (jogosTravados ?? []).map((j) => {
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
```

- [ ] **Step 2: Incluir `palpites` na resposta**

Troque a linha final:
```ts
  return NextResponse.json({ campeao, artilheiro, tabelas, totalTabelas: count ?? 0 })
```
por:
```ts
  return NextResponse.json({ campeao, artilheiro, tabelas, totalTabelas: count ?? 0, palpites })
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: limpo. (Se o tipo do join `selecao_casa`/`selecao_fora` reclamar, é o mesmo padrão array/objeto já usado no bloco de bônus acima — `Array.isArray(...) ? [0] : ...` — não precisa de cast extra. Se ainda assim acusar, aplique `as { nome: string; bandeira_emoji: string } | null` em `c`/`f`.)

- [ ] **Step 4: Commit**

```bash
git add "app/api/perfil/[bilheteId]/route.ts"
git commit -m "feat(ranking): rota /api/perfil retorna palpites dos jogos travados"
```

---

## Task 2: Helper puro `agruparPorDia` (TDD)

**Files:**
- Create: `lib/ranking/agruparPorDia.ts`
- Test: `lib/ranking/__tests__/agruparPorDia.test.ts`

- [ ] **Step 1: Escrever o teste primeiro**

Crie `lib/ranking/__tests__/agruparPorDia.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { agruparPorDia, type PalpiteJogo } from '../agruparPorDia'

const mk = (numeroJogo: number, dataHora: string): PalpiteJogo => ({
  numeroJogo,
  dataHora,
  casa: 'A',
  fora: 'B',
  bandeiraCasa: null,
  bandeiraFora: null,
  palpiteCasa: 1,
  palpiteFora: 0,
  realCasa: null,
  realFora: null,
  finalizado: false,
  pontos: null,
})

describe('agruparPorDia', () => {
  it('agrupa por dia BRT; dias e jogos do mais recente pro mais antigo', () => {
    const r = agruparPorDia([
      mk(1, '2026-06-14T16:00:00Z'), // 14/06 13:00 BRT
      mk(2, '2026-06-15T19:00:00Z'), // 15/06 16:00 BRT
      mk(3, '2026-06-15T22:00:00Z'), // 15/06 19:00 BRT
    ])
    expect(r.map((g) => g.dia)).toEqual(['2026-06-15', '2026-06-14'])
    expect(r[0]!.jogos.map((j) => j.numeroJogo)).toEqual([3, 2])
  })

  it('usa o fuso BRT pra decidir o dia (jogo de madrugada cai no dia anterior)', () => {
    // 2026-06-15T02:00:00Z = 14/06 23:00 BRT
    const r = agruparPorDia([mk(9, '2026-06-15T02:00:00Z')])
    expect(r[0]!.dia).toBe('2026-06-14')
  })

  it('lista vazia → []', () => {
    expect(agruparPorDia([])).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/ranking/__tests__/agruparPorDia.test.ts`
Expected: FAIL (módulo `../agruparPorDia` não existe).

- [ ] **Step 3: Implementar**

Crie `lib/ranking/agruparPorDia.ts`:
```ts
export type PalpiteJogo = {
  numeroJogo: number
  dataHora: string
  casa: string
  fora: string
  bandeiraCasa: string | null
  bandeiraFora: string | null
  palpiteCasa: number | null
  palpiteFora: number | null
  realCasa: number | null
  realFora: number | null
  finalizado: boolean
  pontos: number | null
}

export type GrupoDia = { dia: string; label: string; jogos: PalpiteJogo[] }

const TZ = 'America/Sao_Paulo'

/**
 * Agrupa palpites por dia (BRT). Dias do mais recente pro mais antigo;
 * dentro do dia, jogos por horário decrescente. `dia` = YYYY-MM-DD (BRT),
 * `label` = ex. "dom., 14/06".
 */
export function agruparPorDia(palpites: PalpiteJogo[]): GrupoDia[] {
  const map = new Map<string, PalpiteJogo[]>()
  for (const p of palpites) {
    const dia = new Date(p.dataHora).toLocaleDateString('en-CA', { timeZone: TZ })
    const arr = map.get(dia)
    if (arr) arr.push(p)
    else map.set(dia, [p])
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([dia, jogos]) => ({
      dia,
      label: new Date(jogos[0]!.dataHora).toLocaleDateString('pt-BR', {
        timeZone: TZ,
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      }),
      jogos: [...jogos].sort((x, y) =>
        x.dataHora < y.dataHora ? 1 : x.dataHora > y.dataHora ? -1 : 0,
      ),
    }))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/ranking/__tests__/agruparPorDia.test.ts`
Expected: 3 testes passam.

- [ ] **Step 5: Commit**

```bash
git add lib/ranking/agruparPorDia.ts lib/ranking/__tests__/agruparPorDia.test.ts
git commit -m "feat(ranking): helper agruparPorDia (palpites por dia BRT) + testes"
```

---

## Task 3: Seção "Palpites nos jogos" no `PerfilModal`

**Files:**
- Modify: `components/ranking/PerfilModal.tsx`
- Modify: `components/ranking/__tests__/PerfilModal.test.tsx`

- [ ] **Step 1: Import do helper/tipo + `palpites` no `PerfilData`**

No topo de `PerfilModal.tsx`, após a linha `import { tituloDesempenho } from '@/lib/ranking/titulo'`, adicione:
```tsx
import { agruparPorDia, type PalpiteJogo } from '@/lib/ranking/agruparPorDia'
```
No tipo `PerfilData`, adicione o campo `palpites`:
```tsx
type PerfilData = {
  campeao: { nome: string; bandeira: string } | null
  artilheiro: string | null
  tabelas: Tabela[]
  totalTabelas: number
  palpites: PalpiteJogo[]
}
```

- [ ] **Step 2: Scroll no `Dialog.Content`**

Troque a className do `Dialog.Content`. De:
```tsx
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#1f1f23] bg-[#0c0c0e] p-5 text-text-primary outline-none">
```
para:
```tsx
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[#1f1f23] bg-[#0c0c0e] p-5 text-text-primary outline-none">
```

- [ ] **Step 3: Renderizar a seção**

Logo APÓS o bloco `{data && data.tabelas.length > 1 && ( ... )}` (o de "Pontuação por tabela") e ANTES do `<Dialog.Close ...>`, insira:
```tsx
              {data && data.palpites.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">Palpites nos jogos</div>
                  {agruparPorDia(data.palpites).map((grupo) => (
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
                </div>
              )}
```

- [ ] **Step 4: Atualizar o teste**

Em `components/ranking/__tests__/PerfilModal.test.tsx`:

(a) No `beforeEach`, adicione `palpites: []` ao payload default. A chamada vira:
```tsx
beforeEach(() => {
  mockFetch({ campeao: null, artilheiro: null, tabelas: [], totalTabelas: 0, palpites: [] })
})
```

(b) Nos mocks dos testes que passam payloads próprios (o de "lista pontuação por tabela"), adicione `palpites: []` ao objeto. O mock daquele teste vira:
```tsx
    mockFetch({
      campeao: null, artilheiro: null, totalTabelas: 148, palpites: [],
      tabelas: [
        { bilheteId: 'b1', numero: 117, pontos: 50, posicao: 12 },
        { bilheteId: 'b2', numero: 130, pontos: 20, posicao: 80 },
      ],
    })
```

(c) Adicione um novo teste (dentro do `describe`):
```tsx
  it('mostra a seção de palpites nos jogos (finalizado + em andamento)', async () => {
    mockFetch({
      campeao: null, artilheiro: null, tabelas: [], totalTabelas: 0,
      palpites: [
        { numeroJogo: 7, dataHora: '2026-06-13T22:00:00Z', casa: 'Brasil', fora: 'Marrocos', bandeiraCasa: null, bandeiraFora: null, palpiteCasa: 2, palpiteFora: 1, realCasa: 1, realFora: 1, finalizado: true, pontos: 2 },
        { numeroJogo: 15, dataHora: '2026-06-15T22:00:00Z', casa: 'Arábia Saudita', fora: 'Uruguai', bandeiraCasa: null, bandeiraFora: null, palpiteCasa: 1, palpiteFora: 1, realCasa: null, realFora: null, finalizado: false, pontos: null },
      ],
    })
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    expect(await screen.findByText('Palpites nos jogos')).toBeInTheDocument()
    expect(screen.getByText('Brasil')).toBeInTheDocument()
    expect(screen.getByText('em andamento')).toBeInTheDocument()
  })
```

- [ ] **Step 5: Typecheck + testes**

Run: `npx tsc --noEmit && npx vitest run components/ranking/__tests__/PerfilModal.test.tsx`
Expected: tsc limpo; 4 testes passam. (Avisos de `act()` do Radix são cosméticos.)

- [ ] **Step 6: Commit**

```bash
git add components/ranking/PerfilModal.tsx components/ranking/__tests__/PerfilModal.test.tsx
git commit -m "feat(ranking): modal mostra palpites por jogo travado (agrupado por dia)"
```

---

## Task 4: Verificação final

- [ ] **Step 1: tsc + lint + testes + build**

Run:
```bash
npx tsc --noEmit && npx eslint lib/ranking components/ranking app/api/perfil && npx vitest run && npx next build
```
Expected: tudo limpo; suíte verde (inclui `agruparPorDia.test.ts` com 3 e `PerfilModal.test.tsx` com 4); `✓ Compiled successfully`.

- [ ] **Step 2: Checagem manual em `/ranking`**

- Clicar no avatar de alguém com jogos já travados abre o modal com a seção "Palpites nos jogos", agrupada por dia (recentes primeiro).
- Jogo finalizado mostra `real X×Y · +N`; jogo travado sem resultado mostra "em andamento"; jogo travado que a melhor tabela pulou mostra "— sem palpite".
- Nenhum jogo **futuro** aparece (RLS).
- O modal rola internamente quando a lista é longa.

---

## Fora de escopo
- Palpites das outras tabelas (só a melhor).
- Jogos não iniciados (escondidos pelo RLS).
- Mexer em `/jogos` ou no `/ranking`.
