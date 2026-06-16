# Polimento dashboard/palpites — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Linhas de cada pessoa em cinza/glass, "Próximos jogos" preto e compacto (times numa linha só), e botão "← Dashboard" na tela de palpites.

**Architecture:** Mudanças de className (cinza translúcido + preto), redesenho do `JogoRow` para uma linha flex, e um link no `PalpitesHeader`. Sem lógica nova.

**Tech Stack:** Next.js 14 App Router, TS strict, Tailwind v4. (Verificação por `tsc`/`eslint`/`vitest`/`next build`.)

**Spec:** `docs/superpowers/specs/2026-06-16-polimento-dashboard-palpites-design.md`

---

## File structure
- Modify `components/dashboard/JogoResumoCard.tsx` — cinza/glass nas linhas + lockbox.
- Modify `components/dashboard/JogoRow.tsx` — layout inline de uma linha.
- Modify `components/dashboard/ProximosJogosPanel.tsx` — `<section>` preta.
- Modify `components/palpites/PalpitesHeader.tsx` — link "← Dashboard".

---

## Task 1: Linhas de cada pessoa em cinza/glass

**Files:**
- Modify: `components/dashboard/JogoResumoCard.tsx`

- [ ] **Step 1: Linha de cada pessoa**

Em `JogoResumoCard.tsx`, a linha de cada apostador é:
```tsx
              <div key={p.userId} className="bg-bg-elevated border-border flex items-center gap-2 rounded-xl border px-2.5 py-2">
```
Troque por:
```tsx
              <div key={p.userId} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-2.5 py-2">
```

- [ ] **Step 2: Lockbox do card "próximo"**

A linha do lockbox é:
```tsx
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border bg-bg-elevated px-3 py-2.5 text-xs text-text-muted">
```
Troque por:
```tsx
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-white/[0.06] bg-white/[0.04] px-3 py-2.5 text-xs text-text-muted">
```

- [ ] **Step 3: Typecheck + testes do componente + commit**

Run: `npx tsc --noEmit && npx vitest run components/dashboard/__tests__/JogoResumoCard.test.tsx`
Expected: limpo; 2 testes passam (mudança é só de classe).
```bash
git add components/dashboard/JogoResumoCard.tsx
git commit -m "style(dashboard): linhas de cada pessoa em cinza/glass (casa com o preto)"
```

---

## Task 2: "Próximos jogos" preto + JogoRow em uma linha

**Files:**
- Modify: `components/dashboard/JogoRow.tsx`
- Modify: `components/dashboard/ProximosJogosPanel.tsx`

- [ ] **Step 1: Reescrever `JogoRow` (layout inline)**

Substitua o conteúdo INTEIRO de `components/dashboard/JogoRow.tsx` por:
```tsx
import { formatDataRelativa } from '@/lib/format/data-relativa';
import type { Database } from '@/lib/supabase/types';
import { BandeiraImg } from '@/components/ui/BandeiraImg';
import { PalpitarButton, type TabelaPalpite } from '@/components/dashboard/PalpitarButton';

type FaseEnum = Database['public']['Enums']['fase_jogo'];

export type JogoRowData = {
  id: number;
  data_hora: string;
  fase: FaseEnum;
  placeholder_casa: string | null;
  placeholder_fora: string | null;
  casa: { nome: string; bandeira_emoji: string } | null;
  fora: { nome: string; bandeira_emoji: string } | null;
};

export type JogoRowProps = {
  jogo: JogoRowData;
  agora?: Date | undefined; // override pra testes; default = new Date()
  tabelas?: TabelaPalpite[];
};

export function JogoRow({ jogo, agora = new Date(), tabelas = [] }: JogoRowProps) {
  const { date, hour } = formatDataRelativa({ data: new Date(jogo.data_hora), agora });
  const tbd = !jogo.casa || !jogo.fora;

  return (
    <li className="border-border flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <div className="w-14 shrink-0 font-mono text-[11px] leading-tight">
        <div className="text-text-primary font-semibold">{date}</div>
        <div className="text-text-muted">{hour}</div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-sm font-semibold">
        {jogo.casa ? (
          <>
            <BandeiraImg emoji={jogo.casa.bandeira_emoji} nome={jogo.casa.nome} size={20} />
            <span className="truncate">{jogo.casa.nome}</span>
          </>
        ) : (
          <span className="text-text-muted truncate font-mono text-xs">
            {jogo.placeholder_casa ?? 'TBD'}
          </span>
        )}

        <span className="text-text-muted shrink-0 px-0.5">×</span>

        {jogo.fora ? (
          <>
            <span className="truncate">{jogo.fora.nome}</span>
            <BandeiraImg emoji={jogo.fora.bandeira_emoji} nome={jogo.fora.nome} size={20} />
          </>
        ) : (
          <span className="text-text-muted truncate font-mono text-xs">
            {jogo.placeholder_fora ?? 'TBD'}
          </span>
        )}
      </div>

      <div className="shrink-0">
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
      </div>
    </li>
  );
}
```
*(Mudanças vs atual: `<li>` vira flex de uma linha; times no centro com `truncate`; bandeiras `size={20}`; removido o chip de fase e o `FASE_LABEL`/imports não usados.)*

- [ ] **Step 2: `<section>` preta no `ProximosJogosPanel`**

Em `components/dashboard/ProximosJogosPanel.tsx`, troque:
```tsx
    <section className="panel">
```
por:
```tsx
    <section className="panel border-[#1b1b1e] bg-[#08080a]">
```
(Não muda mais nada no arquivo.)

- [ ] **Step 3: Typecheck + lint + testes + commit**

Run: `npx tsc --noEmit && npx eslint components/dashboard && npx vitest run components/dashboard`
Expected: limpo; testes do `ProximosJogosPanel` seguem verdes (nomes dos times + links "Palpitar" continuam presentes). Se algum teste assertava o **rótulo de fase** (removido), atualize-o removendo essa asserção; se assertava nome de time ou href do Palpitar, deve continuar passando sem mudança.
```bash
git add components/dashboard/JogoRow.tsx components/dashboard/ProximosJogosPanel.tsx
git commit -m "style(dashboard): Próximos jogos preto + jogo numa linha só (responsivo)"
```

---

## Task 3: Botão "← Dashboard" na tela de palpites

**Files:**
- Modify: `components/palpites/PalpitesHeader.tsx`

- [ ] **Step 1: Adicionar o link**

Substitua o conteúdo INTEIRO de `components/palpites/PalpitesHeader.tsx` por:
```tsx
import Link from 'next/link';
import type { Route } from 'next';

type Props = {
  numeroBilhete: number;
  palpitesCount: number;
  primeiroJogoDataHora: string;
};

const TOTAL = 104;

export function PalpitesHeader({ numeroBilhete, palpitesCount, primeiroJogoDataHora }: Props) {
  const deadline = new Date(primeiroJogoDataHora);
  const dateStr = deadline.toLocaleDateString('pt-BR');
  const timeStr = deadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mb-5">
      <Link
        href={'/dashboard' as Route}
        className="text-text-muted hover:text-text-primary mb-2 inline-flex items-center gap-1 text-xs"
      >
        ← Dashboard
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">
            Meus <span className="text-accent">palpites</span>
          </h1>
          <p className="font-mono text-text-muted mt-1 text-[12px]">
            Tabela #{numeroBilhete} · Copa até {dateStr} às {timeStr}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-accent text-[22px] font-bold leading-none">
            {palpitesCount}
            <span className="text-text-muted text-sm font-normal">/{TOTAL}</span>
          </div>
          <div className="text-text-muted text-[11px]">preenchidos</div>
        </div>
      </div>
    </div>
  );
}
```
*(Só adiciona o `<Link>` "← Dashboard" no topo; o resto é o mesmo conteúdo, agora dentro de um wrapper.)*

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: limpo.
```bash
git add components/palpites/PalpitesHeader.tsx
git commit -m "feat(palpites): botão Voltar ao Dashboard no topo da tela de palpites"
```

---

## Task 4: Verificação final

- [ ] **Step 1: tsc + lint + testes + build**

Run:
```bash
npx tsc --noEmit && npx eslint components/dashboard components/palpites && npx vitest run && npx next build
```
Expected: tudo limpo; suíte verde; `✓ Compiled successfully`.

- [ ] **Step 2: Checagem manual (mobile)**

- Painel "Palpites do jogo": linhas de cada pessoa em **cinza fosco** (não azul), casando com o preto; lockbox idem.
- "Próximos jogos": **preto**; cada jogo em **uma linha** (bandeira+nome × nome+bandeira + Palpitar), nomes longos truncam; nada empilhado.
- Tela de palpites: **"← Dashboard"** no topo, leva pra `/dashboard`.

---

## Fora de escopo
- `.panel` global; modal seletor do PalpitarButton; lógica dos jogos.
