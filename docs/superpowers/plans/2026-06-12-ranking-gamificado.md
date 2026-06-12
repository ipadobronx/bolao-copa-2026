# Ranking Gamificado (fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-row emoji badges (🔥/👍/😭/🦄/💎), curated club crests, and podium confetti to the ranking.

**Architecture:** Badges are computed server-side reusing `classificarPalpite` from `lib/pontuacao.ts` (no scoring re-implemented in SQL). A pure function maps result-class + day-points → emoji; a thin DB helper gathers the data and returns `Map<userId, emoji>`. Both the ranking page and the realtime `/api/ranking` route call the same helper. Club crests come from a manual `profiles.clube` slug + static SVGs in `public/escudos/`. Confetti is a small client component in the podium.

**Tech Stack:** Next.js 14 (App Router, TS strict, `exactOptionalPropertyTypes`), Supabase, Vitest + RTL, Tailwind v4, `canvas-confetti`.

**Spec:** `docs/superpowers/specs/2026-06-12-ranking-gamificado-design.md`

---

## File structure

- Create `lib/ranking/badge.ts` — pure `emojiDoResultado(classe, pontosNoDia)`.
- Create `lib/ranking/badges.ts` — `calcularBadges(admin, usuarios)` DB orchestrator → `Map<userId, emoji>`.
- Create `lib/ranking/__tests__/badge.test.ts` — unit tests for the pure function.
- Create `components/ui/EscudoImg.tsx` — renders `/escudos/<slug>.svg`.
- Create `public/escudos/nautico.svg`, `public/escudos/corinthians.svg` — placeholder crests.
- Create `components/ranking/ConfettiBurst.tsx` — client confetti, fired once on mount.
- Create `supabase/migrations/20260612120000_profiles_clube.sql` — `profiles.clube text`.
- Modify `components/ranking/RankingRow.tsx` — `RankingRowData` gains `emoji`/`clube`; render both.
- Modify `components/ranking/PodioSection.tsx` — `PodioEntry` gains `clube`; render `ConfettiBurst`.
- Modify `components/ranking/PodioCard.tsx` — render crest next to name.
- Modify `components/ranking/RankingTabGeral.tsx` — pass `clube` into `PodioEntry`.
- Modify `app/(dashboard)/ranking/page.tsx` — enrich `geral` with emoji + clube.
- Modify `app/api/ranking/route.ts` — same enrichment.

---

## Task 1: DB — add `profiles.clube`

**Files:**
- Create: `supabase/migrations/20260612120000_profiles_clube.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Clube do coração (curado manualmente) para exibir escudo no ranking.
-- Slug minúsculo, ex.: 'nautico', 'corinthians'. NULL = sem escudo.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clube text;
```

- [ ] **Step 2: Apply to production**

DDL não roda pelo cliente JS (service_role). Aplicar no **Supabase Studio → SQL Editor** colando o conteúdo do arquivo e rodando. Esperado: "Success. No rows returned".

- [ ] **Step 3: Seed dos clubes conhecidos (Studio SQL ou script service_role)**

```sql
UPDATE public.profiles SET clube = 'nautico'
  WHERE email IN ('b2intermediacoes@hotmail.com');           -- Bruno daniel barbosa dos santos
UPDATE public.profiles SET clube = 'nautico'   WHERE nome ILIKE 'Baxola';
UPDATE public.profiles SET clube = 'corinthians'
  WHERE email = 'samara.samara.samara@hotmail.com';          -- Gladystone
```
*(João Philippe e Tshabalala ficam sem clube até o dono enviar.)*

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260612120000_profiles_clube.sql
git commit -m "feat(db): profiles.clube para escudo do ranking"
```

---

## Task 2: Pure function `emojiDoResultado` (TDD)

**Files:**
- Create: `lib/ranking/badge.ts`
- Test: `lib/ranking/__tests__/badge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { emojiDoResultado } from '../badge'

describe('emojiDoResultado', () => {
  it('mapeia cada classe do último jogo', () => {
    expect(emojiDoResultado('exato', 0)).toBe('🔥')
    expect(emojiDoResultado('vencedor_saldo', 0)).toBe('👍')
    expect(emojiDoResultado('vencedor', 0)).toBe('😭')
    expect(emojiDoResultado('parcial', 0)).toBe('😭')
    expect(emojiDoResultado('erro', 0)).toBe('🦄')
  })
  it('sem palpite no último jogo (classe null) = 🦄', () => {
    expect(emojiDoResultado(null, 0)).toBe('🦄')
  })
  it('💎 quando somou ≥25 no dia, sobrepondo a classe', () => {
    expect(emojiDoResultado('erro', 25)).toBe('💎')
    expect(emojiDoResultado(null, 30)).toBe('💎')
    expect(emojiDoResultado('exato', 24)).toBe('🔥') // abaixo do limiar mantém a classe
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ranking/__tests__/badge.test.ts`
Expected: FAIL — `emojiDoResultado` not found.

- [ ] **Step 3: Implement the pure function**

```ts
import type { ClassePalpite } from '@/lib/pontuacao'

/** Limiar de pontos no dia que rende o 💎. Tunável. */
export const DIAMANTE_MIN_PONTOS = 25

const EMOJI_POR_CLASSE: Record<ClassePalpite, string> = {
  exato: '🔥',
  vencedor_saldo: '👍',
  vencedor: '😭',
  parcial: '😭',
  erro: '🦄',
}

/**
 * Emoji do badge a partir da classe do palpite no ÚLTIMO jogo finalizado e da
 * soma de pontos da tabela NO DIA. `classe === null` = não palpitou aquele jogo.
 * Chamada só quando existe um último jogo finalizado.
 */
export function emojiDoResultado(
  classe: ClassePalpite | null,
  pontosNoDia: number,
): string {
  if (pontosNoDia >= DIAMANTE_MIN_PONTOS) return '💎'
  if (classe === null) return '🦄'
  return EMOJI_POR_CLASSE[classe]
}
```
*(Record exaustivo evita o erro "not all paths return" do switch sob strict.)*

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ranking/__tests__/badge.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ranking/badge.ts lib/ranking/__tests__/badge.test.ts
git commit -m "feat(ranking): função pura emojiDoResultado + testes"
```

---

## Task 3: DB helper `calcularBadges`

Thin orchestrator (read-only, service-role). Computes the badge map. Not unit-tested
(it's I/O over Supabase); the scoring/mapping it relies on is covered by Task 2 and the
existing `lib/pontuacao` tests. Verified end-to-end in Task 9.

**Files:**
- Create: `lib/ranking/badges.ts`

- [ ] **Step 1: Implement the helper**

```ts
import type { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { classificarPalpite, type ClassePalpite, type FaseJogo } from '@/lib/pontuacao'
import { emojiDoResultado } from '@/lib/ranking/badge'

type Admin = ReturnType<typeof createSupabaseAdminClient>

export type UsuarioBadge = { userId: string; melhorBilheteId: string | null }

function diaBRT(iso: string): string {
  // YYYY-MM-DD no fuso de Brasília
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/**
 * Retorna Map<userId, emoji> para o último jogo finalizado da Copa.
 * Vazio se ainda não há jogo finalizado (badge fica neutro/oculto).
 * Usa o cliente service_role: lê palpites/jogos/profiles de todos (server-only).
 */
export async function calcularBadges(
  admin: Admin,
  usuarios: UsuarioBadge[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const bilheteIds = usuarios
    .map((u) => u.melhorBilheteId)
    .filter((id): id is string => Boolean(id))
  if (bilheteIds.length === 0) return result

  // 1. último jogo finalizado (com placar)
  const { data: ultimo } = await admin
    .from('jogos')
    .select('id, fase, data_hora, gols_casa, gols_fora')
    .eq('finalizado', true)
    .order('data_hora', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!ultimo || ultimo.gols_casa === null || ultimo.gols_fora === null) return result

  // 2. ids dos jogos finalizados no mesmo dia (BRT)
  const alvoDia = diaBRT(ultimo.data_hora)
  const { data: jogosFin } = await admin
    .from('jogos')
    .select('id, data_hora')
    .eq('finalizado', true)
  const idsDia = (jogosFin ?? [])
    .filter((j) => diaBRT(j.data_hora) === alvoDia)
    .map((j) => j.id)

  // 3. classe no último jogo, por bilhete
  const { data: palpUltimo } = await admin
    .from('palpites')
    .select('bilhete_id, gols_casa, gols_fora')
    .eq('jogo_id', ultimo.id)
    .in('bilhete_id', bilheteIds)
  const classePorBilhete = new Map<string, ClassePalpite>()
  for (const p of palpUltimo ?? []) {
    classePorBilhete.set(
      p.bilhete_id,
      classificarPalpite(
        { gols_casa: p.gols_casa, gols_fora: p.gols_fora },
        {
          fase: ultimo.fase as FaseJogo,
          finalizado: true,
          gols_casa: ultimo.gols_casa,
          gols_fora: ultimo.gols_fora,
        },
      ),
    )
  }

  // 4. soma de pontos no dia, por bilhete
  const pontosDia = new Map<string, number>()
  if (idsDia.length > 0) {
    const { data: palpDia } = await admin
      .from('palpites')
      .select('bilhete_id, pontos_calculados')
      .in('jogo_id', idsDia)
      .in('bilhete_id', bilheteIds)
    for (const p of palpDia ?? []) {
      pontosDia.set(p.bilhete_id, (pontosDia.get(p.bilhete_id) ?? 0) + (p.pontos_calculados ?? 0))
    }
  }

  // 5. emoji por usuário (via melhor_bilhete)
  for (const u of usuarios) {
    if (!u.melhorBilheteId) continue
    const classe = classePorBilhete.get(u.melhorBilheteId) ?? null
    const pts = pontosDia.get(u.melhorBilheteId) ?? 0
    result.set(u.userId, emojiDoResultado(classe, pts))
  }
  return result
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `FaseJogo` isn't exported from `lib/pontuacao`, it is — `export type FaseJogo` exists.)

- [ ] **Step 3: Commit**

```bash
git add lib/ranking/badges.ts
git commit -m "feat(ranking): calcularBadges (último jogo + 💎 do dia)"
```

---

## Task 4: Extend `RankingRowData` and render in `RankingRow`

**Files:**
- Modify: `components/ranking/RankingRow.tsx`
- Create: `components/ui/EscudoImg.tsx`
- Create: `public/escudos/nautico.svg`, `public/escudos/corinthians.svg`

- [ ] **Step 1: Create the crest component**

`components/ui/EscudoImg.tsx`:
```tsx
const ESCUDOS: Record<string, string> = {
  nautico: 'Náutico',
  corinthians: 'Corinthians',
}

export function EscudoImg({ slug, size = 18 }: { slug: string | null | undefined; size?: number }) {
  if (!slug || !(slug in ESCUDOS)) return null
  return (
    <img
      src={`/escudos/${slug}.svg`}
      alt={ESCUDOS[slug]}
      title={ESCUDOS[slug]}
      width={size}
      height={size}
      className="inline-block shrink-0 align-middle"
    />
  )
}
```
*(Quando um novo clube entrar, adicionar o slug aqui + o SVG em `public/escudos/`.)*

- [ ] **Step 2: Create placeholder crests**

`public/escudos/nautico.svg` (escudo provisório — substituir pelo oficial depois):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 1l9 3v7c0 5-3.8 9.4-9 11-5.2-1.6-9-6-9-11V4l9-3z" fill="#c8102e"/><text x="12" y="15" font-family="Arial" font-size="8" font-weight="bold" fill="#fff" text-anchor="middle">NAU</text></svg>
```

`public/escudos/corinthians.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 1l9 3v7c0 5-3.8 9.4-9 11-5.2-1.6-9-6-9-11V4l9-3z" fill="#000"/><text x="12" y="15" font-family="Arial" font-size="8" font-weight="bold" fill="#fff" text-anchor="middle">SCC</text></svg>
```

- [ ] **Step 3: Extend the type + render (RankingRow.tsx)**

Add to the `RankingRowData` type (after `isCurrentUser: boolean`). **Opcionais** para não
quebrar fixtures de testes existentes (RankingShell/TabGeral) que constroem `RankingRowData`:
```ts
  emoji?: string | null
  clube?: string | null
```

Add the import at the top:
```ts
import { EscudoImg } from '@/components/ui/EscudoImg'
```

Destructure `emoji, clube` from `data` (extend the existing destructure on line ~22).

Render the crest next to the name — inside `.rank-name`, right after `{nome}`:
```tsx
            <div className="rank-name">
              {nome}
              {clube && <EscudoImg slug={clube} />}
              {isCurrentUser && <span className="rank-you-badge">Você</span>}
            </div>
```

Render the emoji next to the points — change the points cell:
```tsx
      <td className="rank-pts">
        {emoji && <span className="mr-1" aria-hidden="true">{emoji}</span>}
        {pontosTotais}
      </td>
```

- [ ] **Step 4: Update the existing RankingRow test fixture**

`components/ranking/__tests__/RankingRow.test.tsx` — add to the `base` object so it satisfies the type:
```ts
  emoji: null,
  clube: null,
```

- [ ] **Step 5: Add render tests (append to RankingRow.test.tsx)**

```ts
  it('renderiza emoji quando presente', () => {
    render(<table><tbody><RankingRow data={{ ...base, emoji: '🔥' }} /></tbody></table>)
    expect(screen.getByText('🔥')).toBeInTheDocument()
  })
  it('renderiza escudo quando há clube', () => {
    render(<table><tbody><RankingRow data={{ ...base, clube: 'nautico' }} /></tbody></table>)
    expect(screen.getByAltText('Náutico')).toBeInTheDocument()
  })
  it('não renderiza escudo sem clube', () => {
    render(<table><tbody><RankingRow data={base} /></tbody></table>)
    expect(screen.queryByAltText('Náutico')).toBeNull()
  })
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run components/ranking/__tests__/RankingRow.test.tsx && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
git add components/ranking/RankingRow.tsx components/ui/EscudoImg.tsx public/escudos lib
git commit -m "feat(ranking): emoji + escudo na linha do ranking"
```

---

## Task 5: Enrich the ranking page

**Files:**
- Modify: `app/(dashboard)/ranking/page.tsx`

- [ ] **Step 1: Add imports**

```ts
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { calcularBadges, type UsuarioBadge } from '@/lib/ranking/badges'
```

- [ ] **Step 2: Compute badges + clube before building `geral`**

After the `Promise.all` that loads `rankingData`/`jogosData`/`snapshots`, add:
```ts
  const admin = createSupabaseAdminClient()
  const usuarios: UsuarioBadge[] = (rankingData ?? [])
    .filter((r): r is typeof r & { user_id: string } => Boolean(r.user_id))
    .map((r) => ({ userId: r.user_id, melhorBilheteId: r.melhor_bilhete_id ?? null }))

  const [emojiMap, { data: perfis }] = await Promise.all([
    calcularBadges(admin, usuarios),
    admin.from('profiles').select('id, clube').in('id', usuarios.map((u) => u.userId)),
  ])
  const clubeMap = new Map<string, string | null>(
    (perfis ?? []).map((p) => [p.id, p.clube ?? null]),
  )
```

- [ ] **Step 3: Attach `emoji` + `clube` to each `geral` row**

In the `geral` map's returned object, add:
```ts
      emoji: emojiMap.get(r.user_id ?? '') ?? null,
      clube: clubeMap.get(r.user_id ?? '') ?? null,
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (`periodoRows` rows inherit emoji/clube via spread `{ ...r }`, already typed).

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/ranking/page.tsx"
git commit -m "feat(ranking): página enriquece linhas com emoji + clube"
```

---

## Task 6: Enrich the realtime `/api/ranking` route

**Files:**
- Modify: `app/api/ranking/route.ts`

- [ ] **Step 1: Add imports**

```ts
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { calcularBadges, type UsuarioBadge } from '@/lib/ranking/badges'
```

- [ ] **Step 2: Compute badges + clube, attach to `geral`**

After `rankingData` is loaded, before building `geral`:
```ts
  const admin = createSupabaseAdminClient()
  const usuarios: UsuarioBadge[] = (rankingData ?? [])
    .filter((r): r is typeof r & { user_id: string } => Boolean(r.user_id))
    .map((r) => ({ userId: r.user_id, melhorBilheteId: r.melhor_bilhete_id ?? null }))
  const [emojiMap, { data: perfis }] = await Promise.all([
    calcularBadges(admin, usuarios),
    admin.from('profiles').select('id, clube').in('id', usuarios.map((u) => u.userId)),
  ])
  const clubeMap = new Map<string, string | null>((perfis ?? []).map((p) => [p.id, p.clube ?? null]))
```

In the `geral` map's returned object add:
```ts
        emoji: emojiMap.get(r.user_id) ?? null,
        clube: clubeMap.get(r.user_id) ?? null,
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: clean)
```bash
git add app/api/ranking/route.ts
git commit -m "feat(ranking): /api/ranking enriquece com emoji + clube (realtime)"
```

---

## Task 7: Crest on the podium

**Files:**
- Modify: `components/ranking/PodioSection.tsx`
- Modify: `components/ranking/PodioCard.tsx`
- Modify: `components/ranking/RankingTabGeral.tsx`

- [ ] **Step 1: Add `clube` to `PodioEntry` (PodioSection.tsx)**

In the `PodioEntry` type add (opcional, mesma razão do RankingRowData):
```ts
  clube?: string | null
```

- [ ] **Step 2: Pass `clube` through (RankingTabGeral.tsx)**

In the `top3` map, add `clube: r.clube ?? null,` to each entry object (o `?? null` evita
atribuir `undefined` a um campo opcional sob `exactOptionalPropertyTypes`).

- [ ] **Step 3: Render the crest (PodioCard.tsx)**

Add the import:
```tsx
import { EscudoImg } from '@/components/ui/EscudoImg'
```
Destructure `clube` from `entry`, and render after `{nome}` in `.podio-nome`:
```tsx
      <div className="podio-nome">
        {nome}
        {clube && <EscudoImg slug={clube} size={20} />}
        {isCurrentUser && <span className="rank-you-badge">Você</span>}
      </div>
```

- [ ] **Step 4: (Sem mudança de fixture)**

Como `clube` é opcional em `PodioEntry`, as fixtures existentes de `PodioSection.test.tsx`
continuam válidas. Nada a editar aqui.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run components/ranking/__tests__/PodioSection.test.tsx && npx tsc --noEmit`
Expected: PASS; clean.

- [ ] **Step 6: Commit**

```bash
git add components/ranking/PodioSection.tsx components/ranking/PodioCard.tsx components/ranking/RankingTabGeral.tsx components/ranking/__tests__/PodioSection.test.tsx
git commit -m "feat(ranking): escudo no pódio"
```

---

## Task 8: Podium confetti

**Files:**
- Create: `components/ranking/ConfettiBurst.tsx`
- Modify: `components/ranking/PodioSection.tsx`
- Modify: `package.json` (dep)

- [ ] **Step 1: Add the dependency**

Run:
```bash
npm install canvas-confetti && npm install -D @types/canvas-confetti
```
Expected: both added to package.json.

- [ ] **Step 2: Create the confetti component**

`components/ranking/ConfettiBurst.tsx`:
```tsx
'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'

/** Dispara um confete sutil 1x. `triggerKey` muda → dispara de novo (ex.: pódio mudou). */
export function ConfettiBurst({ triggerKey }: { triggerKey: string }) {
  useEffect(() => {
    const id = window.setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 70,
        startVelocity: 38,
        origin: { y: 0.35 },
        colors: ['#facc15', '#ffffff', '#22c55e'],
        disableForReducedMotion: true,
      })
    }, 250)
    return () => window.clearTimeout(id)
  }, [triggerKey])
  return null
}
```

- [ ] **Step 3: Fire it from the podium (PodioSection.tsx)**

Add the import:
```tsx
import { ConfettiBurst } from './ConfettiBurst'
```
Inside the returned `<div className="podio-section">`, as the first child, add:
```tsx
      <ConfettiBurst triggerKey={ordered.map((e) => e.userId).join('-')} />
```
*(PodioSection has no other client code; rendering a client child from a server component is fine — `ConfettiBurst` is `'use client'`.)*

- [ ] **Step 4: Typecheck + smoke**

Run: `npx tsc --noEmit && npx next build` (or at least `tsc`)
Expected: clean. (Confetti only runs in the browser; `useEffect` guards SSR.)

- [ ] **Step 5: Commit**

```bash
git add components/ranking/ConfettiBurst.tsx components/ranking/PodioSection.tsx package.json package-lock.json
git commit -m "feat(ranking): confete no pódio"
```

---

## Task 9: Full verification

- [ ] **Step 1: Lint + typecheck + tests**

Run:
```bash
npx tsc --noEmit && npx eslint lib/ranking components/ranking components/ui/EscudoImg.tsx "app/(dashboard)/ranking/page.tsx" app/api/ranking/route.ts && npx vitest run
```
Expected: all clean; full suite green (new badge tests + RankingRow/PodioSection tests included).

- [ ] **Step 2: Manual check on `/ranking`**

With the migration applied and clubes seeded (Task 1), open `/ranking`:
- Emoji ao lado dos pontos coerente com o último jogo finalizado (ex.: jogo 1 México 2×0 — quem cravou 2×0 → 🔥; quem zerou/não palpitou → 🦄).
- 💎 para quem somou ≥25 pontos no dia.
- Escudo ao lado do nome de Bruno/Baxola (Náutico) e Gladystone (Corinthians).
- Confete dispara ao abrir o pódio.
- Mobile (pós PR #21): emoji + escudo cabem na linha.

- [ ] **Step 3: Cross-check no banco (opcional)**

Conferir via SQL que `profiles.clube` está setado nos 3 e que o último jogo finalizado é o esperado.

---

## Notes / out of scope (fase 2+)

- Top-5 automático (hoje é curadoria manual via SQL).
- Redesign premium completo (gradientes, medalhas animadas) — só o confete entra agora.
- Escudo substituindo o avatar (decidido: ao lado do nome).
- Substituir os SVGs placeholder de escudo pelos oficiais quando disponíveis.
