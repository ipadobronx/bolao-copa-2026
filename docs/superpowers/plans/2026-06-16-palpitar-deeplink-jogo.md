# "Palpitar" direto no jogo + painel preto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consertar o "Palpitar" (404), abrindo a tela de palpites direto no jogo (rola+destaca; 1 tabela → direto, 2+ → modal com pontos), e deixar o painel "Palpites do jogo" preto como o ranking.

**Architecture:** `PalpitarButton` (client) decide link/modal pelo nº de tabelas. A rota `/palpites/[bilheteId]?jogo=<id>` faz o `PalpitesShell` abrir a aba/grupo do jogo e rolar+destacar a linha (âncora `id` na `MatchRow` + efeito de scroll). Helper puro `abaInicial`. Cor: 1 classe.

**Tech Stack:** Next.js 14 App Router, TS strict (`exactOptionalPropertyTypes`), `@radix-ui/react-dialog`, Vitest + RTL, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-16-palpitar-deeplink-jogo-design.md`

---

## File structure
- Modify `lib/palpites.ts` — `abaInicial` + tipo `AbaPalpite`.
- Create `lib/__tests__/aba-inicial.test.ts`.
- Modify `components/palpites/MatchRow.tsx` — âncora `id="jogo-<id>"`.
- Modify `app/globals.css` — `.jogo-destacado` (flash).
- Modify `app/(dashboard)/palpites/[bilheteId]/page.tsx` — ler `?jogo=`.
- Modify `components/palpites/PalpitesShell.tsx` — aba/scroll do alvo.
- Modify `components/palpites/GruposTab.tsx` — grupo inicial do alvo.
- Create `components/dashboard/PalpitarButton.tsx` (client) + test.
- Modify `components/dashboard/JogoRow.tsx` — usar `PalpitarButton`.
- Modify `components/dashboard/ProximosJogosPanel.tsx` — repassar `tabelas`.
- Modify `app/(dashboard)/dashboard/page.tsx` — buscar pontos das tabelas + repassar.
- Modify `components/dashboard/JogoResumoCard.tsx` — cor preta.

---

## Task 1: Helper `abaInicial` (TDD)

**Files:**
- Modify: `lib/palpites.ts`
- Test: `lib/__tests__/aba-inicial.test.ts`

- [ ] **Step 1: Teste**

Crie `lib/__tests__/aba-inicial.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { abaInicial } from '@/lib/palpites'

describe('abaInicial', () => {
  it('jogo-alvo manda: usa a fase do jogo', () => {
    expect(abaInicial('grupos', null)).toBe('grupos')
    expect(abaInicial('16avos', 'bonus')).toBe('16avos')
    expect(abaInicial('final', null)).toBe('final')
    expect(abaInicial('disputa_terceiro', null)).toBe('disputa_terceiro')
  })
  it('sem alvo: respeita ?tab=bonus, senão grupos', () => {
    expect(abaInicial(null, 'bonus')).toBe('bonus')
    expect(abaInicial(null, null)).toBe('grupos')
    expect(abaInicial(null, 'qualquer')).toBe('grupos')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/__tests__/aba-inicial.test.ts`
Expected: FAIL (`abaInicial` não existe).

- [ ] **Step 3: Implementar**

Em `lib/palpites.ts`, no fim do arquivo, adicione (o tipo `FaseJogo` já é exportado deste módulo):
```ts
/** Aba inicial da tela de palpites: o jogo-alvo (sua fase) tem prioridade; senão ?tab=bonus, senão grupos. */
export type AbaPalpite = FaseJogo | 'bonus'

export function abaInicial(targetFase: FaseJogo | null, tabParam: string | null): AbaPalpite {
  if (targetFase) return targetFase
  if (tabParam === 'bonus') return 'bonus'
  return 'grupos'
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/__tests__/aba-inicial.test.ts`
Expected: 2 testes passam.

- [ ] **Step 5: Commit**

```bash
git add lib/palpites.ts lib/__tests__/aba-inicial.test.ts
git commit -m "feat(palpites): helper abaInicial (deep-link por fase) + teste"
```

---

## Task 2: Âncora na `MatchRow` + CSS de destaque

**Files:**
- Modify: `components/palpites/MatchRow.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Âncora na MatchRow**

Em `components/palpites/MatchRow.tsx`, o `<div>` raiz do retorno é:
```tsx
    <div
      className={cn(
        'bg-bg-card border-border rounded-xl border p-3.5 transition-colors',
        estado === 'open' && saveState === 'saved' && 'border-green-500/25',
        estado === 'finalized' && 'border-accent/15',
        estado === 'locked' && 'opacity-70',
      )}
    >
```
Adicione o atributo `id` (âncora pro deep-link), ficando:
```tsx
    <div
      id={`jogo-${jogo.id}`}
      className={cn(
        'bg-bg-card border-border rounded-xl border p-3.5 transition-colors',
        estado === 'open' && saveState === 'saved' && 'border-green-500/25',
        estado === 'finalized' && 'border-accent/15',
        estado === 'locked' && 'opacity-70',
      )}
    >
```

- [ ] **Step 2: CSS do flash**

Acrescente ao FINAL de `app/globals.css`:
```css

/* Destaque temporário da linha de jogo ao chegar via deep-link (?jogo=). */
@keyframes jogo-flash {
  0%, 35% { box-shadow: 0 0 0 2px #facc15; }
  100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0); }
}
.jogo-destacado {
  animation: jogo-flash 3s ease-out;
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` → limpo.
```bash
git add components/palpites/MatchRow.tsx app/globals.css
git commit -m "feat(palpites): âncora id na MatchRow + classe .jogo-destacado"
```

---

## Task 3: Deep-link na tela de palpites (`?jogo=`)

**Files:**
- Modify: `app/(dashboard)/palpites/[bilheteId]/page.tsx`
- Modify: `components/palpites/PalpitesShell.tsx`
- Modify: `components/palpites/GruposTab.tsx`

- [ ] **Step 1: Ler `?jogo=` na página**

Em `app/(dashboard)/palpites/[bilheteId]/page.tsx`, troque o tipo de `searchParams` e a leitura. De:
```tsx
  searchParams: Promise<{ tab?: string }>;
}) {
  const { bilheteId } = await params;
  const { tab } = await searchParams;
```
para:
```tsx
  searchParams: Promise<{ tab?: string; jogo?: string }>;
}) {
  const { bilheteId } = await params;
  const { tab, jogo } = await searchParams;
  const targetJogoId = jogo && /^\d+$/.test(jogo) ? Number(jogo) : null;
```
E onde renderiza `<PalpitesShell ... initialTab={tab ?? null} />`, adicione a prop `targetJogoId`:
```tsx
      initialTab={tab ?? null}
      targetJogoId={targetJogoId}
```
*(Mantenha as demais props como estão; só acrescente a linha `targetJogoId={targetJogoId}` dentro do JSX do `<PalpitesShell ...>`.)*

- [ ] **Step 2: `PalpitesShell` — aba inicial pelo alvo + scroll/destaque + repassar pro GruposTab**

Em `components/palpites/PalpitesShell.tsx`:

(a) Import `useEffect` e `abaInicial`. Troque:
```tsx
import { useMemo, useState } from 'react';
```
por:
```tsx
import { useEffect, useMemo, useState } from 'react';
```
e adicione, junto aos imports de tipos do `@/lib/palpites`, `abaInicial`:
```tsx
import { abaInicial } from '@/lib/palpites';
```

(b) Adicione `targetJogoId` às props:
```tsx
type Props = {
  bilhete: BilheteResumo;
  jogos: JogoComSelecoes[];
  palpitesSalvos: PalpiteSalvo[];
  bonusSalvos: BonusSalvo[];
  selecoes: SelecaoBasica[];
  initialTab?: string | null;
  targetJogoId?: number | null;
};
```
e na desestruturação dos params da função, adicione `targetJogoId`:
```tsx
export function PalpitesShell({
  bilhete,
  jogos,
  palpitesSalvos,
  bonusSalvos,
  selecoes,
  initialTab,
  targetJogoId,
}: Props) {
```

(c) Remova a função `resolveInitialTab` (não é mais usada) e troque o `useState`. De:
```tsx
function resolveInitialTab(param: string | null): TabKey {
  if (param === 'bonus') return 'bonus';
  return 'grupos';
}
```
(apague esse bloco) e troque:
```tsx
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    resolveInitialTab(initialTab ?? null),
  );
```
por:
```tsx
  const targetJogo = targetJogoId != null ? jogos.find((j) => j.id === targetJogoId) ?? null : null;
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    abaInicial(targetJogo?.fase ?? null, initialTab ?? null),
  );

  useEffect(() => {
    if (targetJogoId == null) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`jogo-${targetJogoId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('jogo-destacado');
      }
    }, 150);
    return () => clearTimeout(t);
  }, [targetJogoId]);
```

(d) Passe `targetJogoId` ao `GruposTab`:
```tsx
        <GruposTab
          bilheteId={bilhete.id}
          jogos={jogos}
          palpitesSalvos={palpitesSalvos}
          targetJogoId={targetJogoId ?? null}
        />
```

- [ ] **Step 3: `GruposTab` — grupo inicial do alvo**

Em `components/palpites/GruposTab.tsx`, troque o tipo `Props` e o início da função. De:
```tsx
type Props = {
  bilheteId: string;
  jogos: JogoComSelecoes[];
  palpitesSalvos: PalpiteSalvo[];
};

export function GruposTab({ bilheteId, jogos, palpitesSalvos }: Props) {
  const byGrupo = groupGamesByGrupo(jogos);
  const grupos = [...byGrupo.keys()];
  const [activeGrupo, setActiveGrupo] = useState(grupos[0] ?? 'A');
```
para:
```tsx
type Props = {
  bilheteId: string;
  jogos: JogoComSelecoes[];
  palpitesSalvos: PalpiteSalvo[];
  targetJogoId?: number | null;
};

export function GruposTab({ bilheteId, jogos, palpitesSalvos, targetJogoId }: Props) {
  const byGrupo = groupGamesByGrupo(jogos);
  const grupos = [...byGrupo.keys()];
  const grupoAlvo =
    targetJogoId != null
      ? grupos.find((g) => (byGrupo.get(g) ?? []).some((j) => j.id === targetJogoId))
      : undefined;
  const [activeGrupo, setActiveGrupo] = useState(grupoAlvo ?? grupos[0] ?? 'A');
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` → limpo.
```bash
git add "app/(dashboard)/palpites/[bilheteId]/page.tsx" components/palpites/PalpitesShell.tsx components/palpites/GruposTab.tsx
git commit -m "feat(palpites): deep-link ?jogo= abre aba/grupo e rola+destaca o jogo"
```

---

## Task 4: `PalpitarButton` + fluxo de tabelas

**Files:**
- Create: `components/dashboard/PalpitarButton.tsx`
- Test: `components/dashboard/__tests__/PalpitarButton.test.tsx`
- Modify: `components/dashboard/JogoRow.tsx`
- Modify: `components/dashboard/ProximosJogosPanel.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: `PalpitarButton.tsx` (client)**

Crie `components/dashboard/PalpitarButton.tsx`:
```tsx
'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

export type TabelaPalpite = { id: string; numero: number; pontos: number }

export function PalpitarButton({ jogoId, tabelas }: { jogoId: number; tabelas: TabelaPalpite[] }) {
  const [open, setOpen] = useState(false)

  if (tabelas.length === 0) {
    return (
      <Link href={'/comprar' as Route} className="btn-sm">
        Palpitar
      </Link>
    )
  }

  if (tabelas.length === 1) {
    return (
      <Link href={`/palpites/${tabelas[0]!.id}?jogo=${jogoId}` as Route} className="btn-sm">
        Palpitar
      </Link>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="btn-sm">Palpitar</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#1b1b1e] bg-[#08080a] p-5 text-text-primary outline-none">
          <Dialog.Title className="mb-1 text-base font-bold">Qual tabela?</Dialog.Title>
          <Dialog.Description className="mb-3 text-xs text-text-muted">
            Escolha a tabela pra palpitar nesse jogo.
          </Dialog.Description>
          <div className="space-y-2">
            {tabelas.map((t) => (
              <Link
                key={t.id}
                href={`/palpites/${t.id}?jogo=${jogoId}` as Route}
                className="bg-bg-elevated border-border hover:border-border-strong flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm"
              >
                <span className="font-semibold">Tabela nº{t.numero}</span>
                <span className="font-mono text-text-muted">
                  <strong className="text-accent">{t.pontos}</strong> pts
                </span>
              </Link>
            ))}
          </div>
          <Dialog.Close className="mt-4 w-full rounded-lg bg-bg-elevated py-2 text-sm font-semibold text-text-muted hover:text-text-primary">
            Fechar
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: Teste do botão**

Crie `components/dashboard/__tests__/PalpitarButton.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PalpitarButton } from '../PalpitarButton'

describe('<PalpitarButton />', () => {
  it('1 tabela: link direto pro jogo', () => {
    render(<PalpitarButton jogoId={16} tabelas={[{ id: 'b1', numero: 117, pontos: 50 }]} />)
    expect(screen.getByRole('link', { name: 'Palpitar' })).toHaveAttribute('href', '/palpites/b1?jogo=16')
  })
  it('0 tabela: link pra comprar', () => {
    render(<PalpitarButton jogoId={16} tabelas={[]} />)
    expect(screen.getByRole('link', { name: 'Palpitar' })).toHaveAttribute('href', '/comprar')
  })
  it('2+ tabelas: botão (não link) que abre o seletor', () => {
    render(
      <PalpitarButton
        jogoId={16}
        tabelas={[
          { id: 'b1', numero: 117, pontos: 50 },
          { id: 'b2', numero: 120, pontos: 30 },
        ]}
      />,
    )
    expect(screen.queryByRole('link', { name: 'Palpitar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Palpitar' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: `JogoRow` usa o `PalpitarButton`**

Em `components/dashboard/JogoRow.tsx`:

(a) Adicione o import:
```tsx
import { PalpitarButton, type TabelaPalpite } from '@/components/dashboard/PalpitarButton';
```

(b) Em `JogoRowProps`, adicione `tabelas`:
```tsx
export type JogoRowProps = {
  jogo: JogoRowData;
  agora?: Date | undefined; // override pra testes; default = new Date()
  tabelas?: TabelaPalpite[];
};
```
e na assinatura:
```tsx
export function JogoRow({ jogo, agora = new Date(), tabelas = [] }: JogoRowProps) {
```

(c) Troque o bloco do botão (o `{tbd ? (...) : (<Link href={`/palpites/${jogo.id}`...>Palpitar</Link>)}`) por:
```tsx
        {tbd ? (
          <span
            aria-disabled="true"
            title="Aguarde os times serem definidos"
            className="btn-sm pointer-events-none cursor-not-allowed opacity-50"
          >
            Palpitar
          </span>
        ) : (
          <PalpitarButton jogoId={jogo.id} tabelas={tabelas} />
        )}
```
*(Pode remover os imports `Link`/`Route` se ficarem sem uso após a troca — confira; se ainda forem usados em outro ponto do arquivo, mantenha.)*

- [ ] **Step 4: `ProximosJogosPanel` repassa `tabelas`**

Em `components/dashboard/ProximosJogosPanel.tsx`, adicione `tabelas` aos props e repasse:
```tsx
import { JogoRow, type JogoRowData } from '@/components/dashboard/JogoRow';
import type { TabelaPalpite } from '@/components/dashboard/PalpitarButton';

export type ProximosJogosPanelProps = {
  jogos: JogoRowData[];
  errored?: boolean;
  agora?: Date;
  tabelas?: TabelaPalpite[];
};

export function ProximosJogosPanel({ jogos, errored = false, agora, tabelas = [] }: ProximosJogosPanelProps) {
```
e no `.map`:
```tsx
          {jogos.map((jogo) => (
            <JogoRow key={jogo.id} jogo={jogo} agora={agora} tabelas={tabelas} />
          ))}
```

- [ ] **Step 5: `dashboard/page.tsx` — buscar pontos das tabelas e repassar**

Em `app/(dashboard)/dashboard/page.tsx`:

(a) Após a linha `const totalBilhetesConfirmados = bilhetesRaw.filter((b) => b.effective_status === 'confirmado').length`, adicione:
```tsx
  const idsConfirmados = (bilhetesRes.data ?? [])
    .filter((b) => b.effective_status === 'confirmado')
    .map((b) => b.id)
  const { data: tabelaPontosRows } = idsConfirmados.length
    ? await supabase
        .from('ranking')
        .select('bilhete_id, numero_bilhete, pontos_totais')
        .in('bilhete_id', idsConfirmados)
    : { data: [] }
  const tabelasUsuario = (tabelaPontosRows ?? [])
    .filter((r): r is typeof r & { bilhete_id: string } => r.bilhete_id !== null)
    .map((r) => ({ id: r.bilhete_id, numero: r.numero_bilhete ?? 0, pontos: r.pontos_totais ?? 0 }))
    .sort((a, b) => a.numero - b.numero)
```

(b) Em CADA uso de `<ProximosJogosPanel jogos={jogos} errored={jogosErrored} />` (são 3: pendente-puro, pré-copa, em-andamento), adicione a prop `tabelas`:
```tsx
          <ProximosJogosPanel jogos={jogos} errored={jogosErrored} tabelas={tabelasUsuario} />
```

- [ ] **Step 6: Typecheck + lint + testes + commit**

Run: `npx tsc --noEmit && npx eslint components/dashboard "app/(dashboard)/dashboard" && npx vitest run components/dashboard/__tests__/PalpitarButton.test.tsx`
Expected: limpo; 3 testes passam.
```bash
git add components/dashboard/PalpitarButton.tsx components/dashboard/__tests__/PalpitarButton.test.tsx components/dashboard/JogoRow.tsx components/dashboard/ProximosJogosPanel.tsx "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(dashboard): Palpitar direto no jogo (1 tabela) / seletor (2+) / comprar (0)"
```

---

## Task 5: Painel "Palpites do jogo" preto

**Files:**
- Modify: `components/dashboard/JogoResumoCard.tsx`

- [ ] **Step 1: Cor preta**

Em `components/dashboard/JogoResumoCard.tsx`, troque a className do `<div>` raiz do card. De:
```tsx
    <div className="bg-bg-card border-border rounded-2xl border p-4">
```
para:
```tsx
    <div className="rounded-2xl border border-[#1b1b1e] bg-[#08080a] p-4">
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → limpo.
```bash
git add components/dashboard/JogoResumoCard.tsx
git commit -m "style(dashboard): painel Palpites do jogo em preto (igual ranking)"
```

---

## Task 6: Verificação final

- [ ] **Step 1: tsc + lint + testes + build**

Run:
```bash
npx tsc --noEmit && npx eslint lib components/dashboard components/palpites "app/(dashboard)" && npx vitest run && npx next build
```
Expected: tudo limpo; suíte verde (inclui `aba-inicial.test.ts` ×2 e `PalpitarButton.test.tsx` ×3); `✓ Compiled successfully`.

- [ ] **Step 2: Checagem manual**

- Dashboard → "Próximos jogos" → **Palpitar**: com 1 tabela vai direto pra `/palpites/<id>?jogo=<id>`; com 2+ abre o modal listando tabelas + pontos; com 0 vai pra `/comprar`. Nada de 404.
- Na tela de palpites com `?jogo=<id>`: abre a aba certa (Grupos/fase), o grupo certo (A–L) e **rola até o jogo, com flash amarelo** de ~3s. Jogo de mata-mata idem na aba da fase.
- Painel "Palpites do jogo" agora **preto** igual ao ranking.

---

## Fora de escopo
- Lógica de autosave; Palpitar em jogo já travado; realtime.
