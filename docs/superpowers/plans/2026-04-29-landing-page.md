# Landing page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os placeholders em `app/(public)/page.tsx` e `app/(public)/layout.tsx` pela landing page real, fiel ao protótipo HTML, com 3 seções (Hero, Features, Promo Cashback), header sticky com nav âncora, footer minimal com disclaimer regulatório, e smoke test único validando contrato do spec.

**Architecture:** Server Components puros (zero `"use client"`) com conteúdo hardcoded. Componentes em `components/{layout,landing}/` usando export nomeado. Estilo via Tailwind v4 + custom utilities (`@utility`) no `globals.css` pros padrões repetidos do protótipo (`btn-primary`, `btn-secondary`, `btn-hero`, `feature-card`, `flag-row`, `flag-row-selected`, `animate-pulse-dot`). Smoke test único (Vitest + RTL) em `app/(public)/page.test.tsx`.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript estrito, Tailwind v4 (`@theme`/`@utility`), Vitest + Testing Library + jsdom. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-04-29-landing-page-design.md` (commit `b7f01cb` em `main`).

**Estratégia de testes neste plano:** A landing é apresentação pura sem regra de negócio — TDD per-component seria contrived. O spec é o contrato; o smoke test final verifica conformidade. Tarefas constroem componentes bottom-up; teste é a penúltima tarefa, antes da verificação final. Cada commit deixa `pnpm typecheck` + `pnpm lint` verdes; o teste novo aparece como verde no final.

**Prerequisites for the developer (verify before starting):**

- [ ] Worktree set up at `feat/landing-page` branch (the controller creates this via using-git-worktrees skill before dispatching tasks)
- [ ] HEAD of `feat/landing-page` branch is `b7f01cb` or descendant (includes the spec commit)
- [ ] `pnpm install` is up to date (no new dependencies needed for this feature)
- [ ] All quality gates pass on the starting state:
  - `pnpm typecheck` (zero errors)
  - `pnpm lint` (zero warnings)
  - `pnpm format:check` (no formatting issues)
  - `pnpm test:run` (existing tests pass — `lib/__tests__/utils.test.ts`)
- [ ] `.env.local` exists in the worktree (preserved from Features 1 and 2)
- [ ] `pnpm dev` boots clean and shows the placeholder landing at `http://localhost:3000` (does not need to stay running between tasks; restart as needed)

---

## Task 1: Foundation — custom utilities and scroll behavior in `app/globals.css`

**Goal:** Adicionar comportamento global de scroll (smooth + reduced-motion fallback + scroll-margin pra âncoras), custom utilities Tailwind v4 pros padrões repetidos do protótipo, e o keyframe `pulse-dot` com utility `animate-pulse-dot`. Subsequent component tasks dependem dessas classes.

**Files:**

- Modify: `app/globals.css`

- [ ] **Step 1: Replace `app/globals.css` with the new content**

```css
@import 'tailwindcss';

@theme {
  --color-bg-dark: #0a0e1a;
  --color-bg-card: #111827;
  --color-bg-elevated: #1a2234;
  --color-border: #1f2937;
  --color-border-strong: #374151;
  --color-text-primary: #f8fafc;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  --color-accent: #facc15;
  --color-accent-hover: #fde047;
  --color-success: #10b981;
  --color-danger: #ef4444;
  --color-info: #3b82f6;
  --color-brasil: #009739;
  --color-brasil-yellow: #fedf00;

  --font-display: var(--font-bebas), 'Bebas Neue', sans-serif;
  --font-body: var(--font-archivo), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains), ui-monospace, monospace;
}

@layer base {
  body {
    background: var(--color-bg-dark);
    color: var(--color-text-primary);
    font-family: var(--font-body);
    line-height: 1.5;
    min-height: 100vh;
  }

  html {
    scroll-behavior: smooth;
  }

  section[id] {
    scroll-margin-top: 6rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}

@utility btn-primary {
  @apply bg-accent text-bg-dark hover:bg-accent-hover focus-visible:ring-accent focus-visible:ring-offset-bg-dark inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-bold transition hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(250,204,21,0.3)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none;
}

@utility btn-secondary {
  @apply text-text-primary border-border-strong hover:border-accent hover:text-accent focus-visible:ring-accent focus-visible:ring-offset-bg-dark inline-flex items-center justify-center rounded-lg border bg-transparent px-6 py-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none;
}

@utility btn-hero {
  @apply px-7 py-4 text-[15px];
}

@utility feature-card {
  @apply bg-bg-elevated border-border hover:border-accent rounded-2xl border p-7 transition hover:-translate-y-1;
}

@utility flag-row {
  @apply bg-bg-elevated border-border flex items-center gap-4 rounded-xl border p-4;
}

@utility flag-row-selected {
  @apply border-accent bg-[rgba(250,204,21,0.08)];
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

@utility animate-pulse-dot {
  animation: pulse-dot 2s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-pulse-dot {
    animation: none;
  }
}
```

- [ ] **Step 2: Verify build picks up the new CSS without errors**

Run: `pnpm build`
Expected: Build completes successfully. No "Unknown at-rule `@utility`" or similar errors. The output may show an `app/(public)/page` route. Pre-existing layout output is unchanged.

If build fails with an error mentioning `@utility`: confirm `@tailwindcss/postcss` is at `^4.0.0` in `package.json` (it should be; this was set up in Feature 1).

- [ ] **Step 3: Verify typecheck and lint still pass**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(landing): add Tailwind v4 utilities and scroll behavior

Define custom utilities for repeated prototype patterns (btn-primary,
btn-secondary, btn-hero, feature-card, flag-row, flag-row-selected,
animate-pulse-dot) and global scroll behavior (smooth scroll with
reduced-motion fallback, scroll-margin-top for sticky-header offset).
Foundation for upcoming SiteHeader/Footer and landing section components."
```

---

## Task 2: `<SiteFooter/>` component

**Goal:** Footer minimal com copyright + disclaimer regulatório (literal do spec §4.2).

**Files:**

- Create: `components/layout/SiteFooter.tsx`

- [ ] **Step 1: Create the component file with the full content**

```tsx
export function SiteFooter() {
  return (
    <footer className="border-border border-t py-8 text-center">
      <p className="text-text-secondary font-body text-sm">© 2026 Bolão Copa 2026</p>
      <p className="text-text-muted mt-2 font-mono text-xs">
        Não afiliado à FIFA. Competição entre conhecidos.
      </p>
    </footer>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: zero errors. (The component is unused so far, but it must compile cleanly.)

- [ ] **Step 3: Verify lint**

Run: `pnpm lint`
Expected: zero warnings.

- [ ] **Step 4: Commit**

```bash
git add components/layout/SiteFooter.tsx
git commit -m "feat(landing): add SiteFooter with regulatory disclaimer"
```

---

## Task 3: `<SiteHeader/>` component

**Goal:** Header sticky com logo (link pra `/`), nav âncora (`Como funciona`, `Cashback` — escondidas no mobile), e botão `Entrar` apontando pra `/login`. Conteúdo conforme spec §4.1 e §6.1.

**Files:**

- Create: `components/layout/SiteHeader.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-border bg-bg-dark/95 sticky top-0 z-50 border-b px-6 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between">
        <Link
          href="/"
          aria-label="Bolão Copa 2026 — início"
          className="font-display flex items-center gap-2.5 text-2xl tracking-[2px]"
        >
          <span
            aria-hidden="true"
            className="bg-accent text-bg-dark flex h-9 w-9 -rotate-[5deg] items-center justify-center rounded-lg text-xl font-black"
          >
            B
          </span>
          <span className="text-text-primary">
            BOLÃO<span className="text-accent">26</span>
          </span>
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-8">
          <a
            href="#features"
            className="text-text-secondary hover:text-accent hidden text-sm font-medium transition md:inline-flex"
          >
            Como funciona
          </a>
          <a
            href="#cashback"
            className="text-text-secondary hover:text-accent hidden text-sm font-medium transition md:inline-flex"
          >
            Cashback
          </a>
          <Link href="/login" className="btn-primary">
            Entrar
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: zero errors. With `experimental.typedRoutes: true`, both `<Link href="/">` and `<Link href="/login">` are validated against existing routes (`app/(public)/page.tsx` and `app/(auth)/login/page.tsx`).

- [ ] **Step 3: Verify lint**

Run: `pnpm lint`
Expected: zero warnings.

- [ ] **Step 4: Commit**

```bash
git add components/layout/SiteHeader.tsx
git commit -m "feat(landing): add SiteHeader with sticky nav and anchor links"
```

---

## Task 4: Wire `<SiteHeader/>` and `<SiteFooter/>` into `app/(public)/layout.tsx`

**Goal:** Substituir o layout placeholder do grupo `(public)` pelo header e footer reais. A partir desta tarefa o `pnpm dev` mostra a chrome real (mesmo que `page.tsx` ainda seja placeholder).

**Files:**

- Modify: `app/(public)/layout.tsx`

- [ ] **Step 1: Replace the layout file contents**

```tsx
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 2: Smoke-check in the browser**

Run (in a separate terminal, leave running): `pnpm dev`
Open: `http://localhost:3000`

Expected:

- Header sticky on top with logo "BOLÃO 26" + nav links "Como funciona", "Cashback", "Entrar"
- Page body still shows the placeholder text from the existing `page.tsx` ("Bolão Copa 2026 — Setup OK ...")
- Footer with copyright and disclaimer at the bottom
- "Entrar" button is yellow (accent), "Como funciona" / "Cashback" are visible at desktop width

You can stop `pnpm dev` after the visual check; it's not required for the next tasks.

- [ ] **Step 3: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 4: Commit**

```bash
git add app/\(public\)/layout.tsx
git commit -m "feat(landing): wire SiteHeader and SiteFooter into public layout"
```

> **Note for shell:** the parentheses in `app/(public)/layout.tsx` may need shell escaping. On bash/zsh use `app/\(public\)/layout.tsx`. On PowerShell use `'app/(public)/layout.tsx'`.

---

## Task 5: `<HeroSection/>` component

**Goal:** Maior componente da landing — header pequeno com badge animado, título h1 em três linhas, descrição, dois CTAs (`/login` e âncora `#features`), grid de 3 stats, e card lateral `PrizeCard` com distribuição do prêmio. Background composto do protótipo aplicado via `style`. Conteúdo conforme spec §4.3.

**Files:**

- Create: `components/landing/HeroSection.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import Link from 'next/link';

const heroBackground = {
  background: `
    radial-gradient(ellipse at top right, rgba(250, 204, 21, 0.15), transparent 50%),
    radial-gradient(ellipse at bottom left, rgba(0, 151, 57, 0.12), transparent 50%),
    var(--color-bg-dark)
  `,
};

const gridOverlay = {
  backgroundImage: `
    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
  `,
  backgroundSize: '40px 40px',
};

const prizeCardBackground = {
  background: 'linear-gradient(145deg, var(--color-bg-elevated), var(--color-bg-card))',
};

const prizeCardOverlay = {
  background: 'radial-gradient(circle, rgba(250, 204, 21, 0.08), transparent 60%)',
};

export function HeroSection() {
  return (
    <section id="hero" className="relative overflow-hidden pt-20 pb-30" style={heroBackground}>
      <div
        className="pointer-events-none absolute inset-0"
        style={gridOverlay}
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto max-w-[1200px] px-6">
        <div className="grid grid-cols-1 items-center gap-20 md:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="border-accent/30 bg-accent/10 text-accent mb-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-xs font-semibold tracking-[1px] uppercase">
              <span
                aria-hidden="true"
                className="bg-accent animate-pulse-dot h-1.5 w-1.5 rounded-full"
              />
              Copa do Mundo · EUA · México · Canadá
            </div>
            <h1 className="font-display mb-6 text-[clamp(48px,8vw,96px)] leading-[0.9] tracking-[-1px]">
              <span className="text-text-primary block">Palpite.</span>
              <span className="text-accent block">Pontue.</span>
              <span className="font-body text-text-primary mt-3 block text-[0.5em] font-extrabold tracking-normal uppercase">
                Leve R$ 10 mil pra casa.
              </span>
            </h1>
            <p className="text-text-secondary mb-8 max-w-[520px] text-lg leading-relaxed">
              O bolão mais justo da Copa 2026. 104 jogos, pontuação ao vivo, ranking em tempo real.
              R$ 20 a tabela. Comprou 5, escolhe uma seleção — se ela for campeã, você leva 100% de
              volta.
            </p>
            <div className="mb-12 flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary btn-hero">
                Comprar minha tabela →
              </Link>
              <a href="#features" className="btn-secondary btn-hero">
                Ver regras
              </a>
            </div>
            <div className="border-border grid grid-cols-3 gap-6 border-t pt-8">
              <div>
                <div className="font-display text-accent text-4xl leading-none">R$ 10K</div>
                <div className="text-text-muted mt-1 font-mono text-xs tracking-[1px] uppercase">
                  Prêmio total
                </div>
              </div>
              <div>
                <div className="font-display text-accent text-4xl leading-none">104</div>
                <div className="text-text-muted mt-1 font-mono text-xs tracking-[1px] uppercase">
                  Jogos
                </div>
              </div>
              <div>
                <div className="font-display text-accent text-4xl leading-none">48</div>
                <div className="text-text-muted mt-1 font-mono text-xs tracking-[1px] uppercase">
                  Seleções
                </div>
              </div>
            </div>
          </div>

          <div
            className="border-border-strong relative overflow-hidden rounded-[20px] border p-8"
            style={prizeCardBackground}
          >
            <div
              className="pointer-events-none absolute -top-1/2 -right-1/2 h-[200%] w-[200%]"
              style={prizeCardOverlay}
              aria-hidden="true"
            />
            <div className="relative mb-6 flex items-center justify-between">
              <span className="text-text-muted font-mono text-[11px] tracking-[1px] uppercase">
                Distribuição do Prêmio
              </span>
              <span
                aria-hidden="true"
                className="bg-accent flex h-10 w-10 items-center justify-center rounded-[10px] text-xl"
              >
                🏆
              </span>
            </div>
            <div className="font-display text-accent relative text-7xl leading-none">
              <span className="mr-1 align-top text-4xl">R$</span>10.000
            </div>
            <p className="text-text-secondary relative mt-1 mb-8 text-sm">
              dividido entre os 10 primeiros colocados
            </p>
            <div className="relative space-y-3">
              <div className="flex items-center justify-between rounded-[10px] border-l-[3px] border-l-[#FFD700] bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2.5 text-[13px] font-semibold">
                  <span className="bg-bg-elevated flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-bold">
                    1º
                  </span>
                  <span>Campeão</span>
                </div>
                <span className="text-accent font-mono font-bold">R$ 5.000</span>
              </div>
              <div className="flex items-center justify-between rounded-[10px] border-l-[3px] border-l-[#C0C0C0] bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2.5 text-[13px] font-semibold">
                  <span className="bg-bg-elevated flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-bold">
                    2º
                  </span>
                  <span>Vice</span>
                </div>
                <span className="text-accent font-mono font-bold">R$ 2.500</span>
              </div>
              <div className="flex items-center justify-between rounded-[10px] border-l-[3px] border-l-[#CD7F32] bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2.5 text-[13px] font-semibold">
                  <span className="bg-bg-elevated flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-bold">
                    3º
                  </span>
                  <span>Terceiro</span>
                </div>
                <span className="text-accent font-mono font-bold">R$ 1.500</span>
              </div>
              <div className="border-l-border-strong flex items-center justify-between rounded-[10px] border-l-[3px] bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2.5 text-[13px] font-semibold">
                  <span className="bg-bg-elevated flex h-6 w-6 items-center justify-center rounded-md font-mono text-[10px] font-bold">
                    4-10
                  </span>
                  <span>Top 10</span>
                </div>
                <span className="text-accent font-mono font-bold">R$ 1.000</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 3: Commit**

```bash
git add components/landing/HeroSection.tsx
git commit -m "feat(landing): add HeroSection with badge, title, CTAs, stats, prize card"
```

---

## Task 6: `<FeaturesSection/>` component

**Goal:** Seção "Como funciona" com título centralizado e grid de 4 cards. Conteúdo literal conforme spec §4.4.

**Files:**

- Create: `components/landing/FeaturesSection.tsx`

- [ ] **Step 1: Create the component file**

```tsx
type Feature = {
  emoji: string;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    emoji: '💳',
    title: 'Compre sua tabela',
    description:
      'R$ 20 por tabela via PIX. Quanto mais tabelas, mais chances. Confirmação na hora no WhatsApp.',
  },
  {
    emoji: '⚽',
    title: 'Palpite nos 104 jogos',
    description:
      'Fase de grupos e mata-mata. Escolha campeão, vice, artilheiro e mais bônus especiais.',
  },
  {
    emoji: '📊',
    title: 'Pontue em tempo real',
    description:
      'Placar exato vale 10 pts. Vencedor vale 5. Mata-mata multiplica. Ranking atualiza automático.',
  },
  {
    emoji: '💰',
    title: 'Receba no PIX',
    description: 'Terminou a Copa? Top 10 recebe o prêmio direto na conta em até 48h após a final.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-bg-card py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2 className="font-display mb-3 text-center text-[56px] tracking-[-0.5px]">
          Como <span className="text-accent">funciona</span>
        </h2>
        <p className="text-text-secondary mb-14 text-center text-base">
          Simples, transparente e ao vivo. Você palpita, o sistema calcula, o placar sobe.
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="feature-card">
              <span
                aria-hidden="true"
                className="bg-accent/15 mb-5 flex h-12 w-12 items-center justify-center rounded-xl text-[22px]"
              >
                {feature.emoji}
              </span>
              <h3 className="mb-2 text-lg font-bold">{feature.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 3: Commit**

```bash
git add components/landing/FeaturesSection.tsx
git commit -m "feat(landing): add FeaturesSection with 4 feature cards"
```

---

## Task 7: `<PromoSection/>` component

**Goal:** Seção cashback (id `#cashback`) com lado-texto (badge Brasil, título, descrição, CTA `/login`) e lado-visual com 4 `flag-row` hardcoded (Brasil = selected). Conteúdo conforme spec §4.5.

**Files:**

- Create: `components/landing/PromoSection.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import Link from 'next/link';

type FlagRowData = {
  flag: string;
  name: string;
  vagas: string;
  selected: boolean;
};

// Conteúdo demonstrativo até a Feature 6 (checkout) ligar dados reais
// — vagas restantes virão de COUNT(bilhetes WHERE selecao_cashback_id = X).
const FLAGS: FlagRowData[] = [
  { flag: '🇧🇷', name: 'Brasil', vagas: '12/20 vagas restantes', selected: true },
  { flag: '🇦🇷', name: 'Argentina', vagas: '8/20 vagas restantes', selected: false },
  { flag: '🇫🇷', name: 'França', vagas: '15/20 vagas restantes', selected: false },
  { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', name: 'Inglaterra', vagas: '19/20 vagas restantes', selected: false },
];

const promoBackground = {
  background: `
    linear-gradient(135deg, rgba(250, 204, 21, 0.08), rgba(0, 151, 57, 0.05)),
    var(--color-bg-dark)
  `,
};

export function PromoSection() {
  return (
    <section id="cashback" className="border-border border-y py-20" style={promoBackground}>
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 px-6 md:grid-cols-2">
        <div>
          <span className="bg-brasil mb-4 inline-block rounded px-3 py-1 font-mono text-[11px] font-bold tracking-[1px] text-white uppercase">
            🎁 Promoção Cashback
          </span>
          <h2 className="font-display mb-4 text-[64px] leading-[0.95]">
            Comprou <span className="text-accent">R$ 100+</span>
            <br />
            Escolheu campeão?
            <br />
            <span className="text-accent">Dinheiro de volta.</span>
          </h2>
          <p className="text-text-secondary mb-6 text-base leading-relaxed">
            Compre 5 tabelas ou mais (R$ 100+) e escolha uma seleção. Se ela for campeã da Copa,
            você recebe 100% do valor pago de volta no PIX. Limite de 20 apostadores por seleção —
            primeiro chegou, levou.
          </p>
          <Link href="/login" className="btn-primary btn-hero">
            Garantir meu cashback →
          </Link>
        </div>
        <div className="bg-bg-card border-border-strong rounded-2xl border p-8">
          <div className="space-y-3">
            {FLAGS.map((flag) => (
              <div
                key={flag.name}
                className={flag.selected ? 'flag-row flag-row-selected' : 'flag-row'}
              >
                <span aria-hidden="true" className="text-[32px] leading-none">
                  {flag.flag}
                </span>
                <div className="flex-1">
                  <div className="text-[15px] font-bold">{flag.name}</div>
                  <div className="text-text-muted font-mono text-xs">{flag.vagas}</div>
                </div>
                {flag.selected && (
                  <span className="bg-accent text-bg-dark rounded px-2.5 py-1 font-mono text-[11px] font-bold">
                    SUA ESCOLHA
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 3: Commit**

```bash
git add components/landing/PromoSection.tsx
git commit -m "feat(landing): add PromoSection with cashback CTA and flag rows"
```

---

## Task 8: Compose `app/(public)/page.tsx` from the three sections

**Goal:** Substituir o placeholder em `page.tsx` pela composição das 3 seções. A landing real fica visível em `pnpm dev`.

**Files:**

- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Replace the page contents**

```tsx
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { HeroSection } from '@/components/landing/HeroSection';
import { PromoSection } from '@/components/landing/PromoSection';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <PromoSection />
    </>
  );
}
```

- [ ] **Step 2: Visual smoke check in the browser**

Run (separate terminal): `pnpm dev`
Open: `http://localhost:3000`

Expected at desktop width (≥1024px):

- Hero with yellow "Pontue." line, gold prize card on the right
- Features section with 4 cards in one row (or 2×2 depending on width)
- Promo section with cashback text on left, 4 flag rows on right (Brasil highlighted yellow)
- Header sticky, footer at the very bottom

Click the "Como funciona" link in the header → page smooth-scrolls to features section without hiding the title under the header.
Click the "Cashback" link → smooth-scrolls to promo section.
Click "Comprar minha tabela →" → navigates to `/login`.

Stop `pnpm dev` after confirming. (`Ctrl+C` in the terminal where it runs.)

- [ ] **Step 3: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 4: Commit**

```bash
git add app/\(public\)/page.tsx
git commit -m "feat(landing): compose landing page from Hero, Features, Promo sections"
```

---

## Task 9: Update root metadata description

**Goal:** Tom da `metadata.description` em `app/layout.tsx` reflete a landing real (preço, prêmio, ranking ao vivo). Conforme spec §7.4.

**Files:**

- Modify: `app/layout.tsx` (only the `metadata` constant)

- [ ] **Step 1: Edit `app/layout.tsx` — change only the `description` field**

Replace:

```ts
export const metadata: Metadata = {
  title: 'Bolão Copa 2026',
  description: 'Bolão da Copa do Mundo FIFA 2026.',
};
```

With:

```ts
export const metadata: Metadata = {
  title: 'Bolão Copa 2026',
  description:
    'Bolão da Copa do Mundo FIFA 2026. R$ 20 a tabela, R$ 10 mil em prêmios, ranking ao vivo.',
};
```

Do not touch the imports, font setup, body, or `<Toaster/>`.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "chore(landing): update metadata description to reflect real landing"
```

---

## Task 10: Smoke test — `app/(public)/page.test.tsx`

**Goal:** Teste único Vitest + RTL valida o contrato do spec: landmarks, conteúdo do hero, ids das seções, links/destinos do header e dos CTAs, conteúdo do footer. Conforme spec §8.2.

**Files:**

- Create: `app/(public)/page.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PublicLayout from './layout';
import HomePage from './page';

const renderLanding = () =>
  render(
    <PublicLayout>
      <HomePage />
    </PublicLayout>,
  );

describe('Landing page', () => {
  it('renderiza landmarks principais', () => {
    renderLanding();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('hero exibe título e CTA principal apontando pra /login', () => {
    renderLanding();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Palpite\.\s*Pontue\.\s*Leve R\$ 10 mil pra casa\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Comprar minha tabela/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('seção features tem id correto e renderiza 4 cards', () => {
    const { container } = renderLanding();
    expect(container.querySelector('#features')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Como funciona/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
  });

  it('seção cashback tem id correto e CTA aponta pra /login', () => {
    const { container } = renderLanding();
    expect(container.querySelector('#cashback')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Garantir meu cashback/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('header tem links de âncora e CTA Entrar', () => {
    renderLanding();
    // Regexes ancoradas pra desambiguar:
    // - "Cashback" sem ^$ casaria também o "Garantir meu cashback" do promo
    // - "Entrar" sem ^$ poderia casar variantes do CTA principal
    expect(screen.getByRole('link', { name: /^Como funciona$/i })).toHaveAttribute(
      'href',
      '#features',
    );
    expect(screen.getByRole('link', { name: /^Cashback$/i })).toHaveAttribute('href', '#cashback');
    expect(screen.getByRole('link', { name: /^Entrar$/i })).toHaveAttribute('href', '/login');
  });

  it('footer mostra copyright e disclaimer', () => {
    renderLanding();
    expect(screen.getByText(/©\s*2026 Bolão Copa 2026/)).toBeInTheDocument();
    expect(
      screen.getByText(/Não afiliado à FIFA\. Competição entre conhecidos\./i),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm test:run`
Expected output (relevant lines):

```
 ✓ app/(public)/page.test.tsx (6 tests)
   ✓ Landing page > renderiza landmarks principais
   ✓ Landing page > hero exibe título e CTA principal apontando pra /login
   ✓ Landing page > seção features tem id correto e renderiza 4 cards
   ✓ Landing page > seção cashback tem id correto e CTA aponta pra /login
   ✓ Landing page > header tem links de âncora e CTA Entrar
   ✓ Landing page > footer mostra copyright e disclaimer
 ✓ lib/__tests__/utils.test.ts (existing tests still pass)

 Test Files  2 passed
      Tests  7+ passed
```

If a test fails:

- "Multiple elements with role link and name /Cashback/i" → confirm the regex anchors `^...$` are present in test 5; non-anchored regex would also match the "Garantir meu cashback" CTA.
- "Unable to find heading level 1 with name /Palpite...Pontue.../" → check that all three spans of the h1 are direct children (no intermediate divs); accessible name concatenates child text.
- "Unable to find role banner/main/contentinfo" → verify `<header>`, `<main>`, `<footer>` tags are used (not `<div>`).

Fix the underlying issue, do not change the test.

- [ ] **Step 3: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 4: Commit**

```bash
git add app/\(public\)/page.test.tsx
git commit -m "test(landing): add smoke test for landing page spec contract"
```

---

## Task 11: Final verification

**Goal:** Validar todos os critérios de pronto do spec §9 antes de mergear: build, typecheck, lint, format, tests, e inspeção manual em duas viewports.

**Files:** none (verification only)

- [ ] **Step 1: Run the full quality gate suite**

Run: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:run && pnpm build`

Expected:

- `typecheck`: zero errors
- `lint`: zero warnings
- `format:check`: passes (if it complains, run `pnpm format` and stage/commit the formatting fix as a separate small commit `chore: apply prettier formatting`)
- `test:run`: 7+ tests passed (6 new + at least 1 from `lib/__tests__/utils.test.ts`)
- `build`: completes without error; output shows the route `/` as a static page

- [ ] **Step 2: Manual viewport check at 1280px (desktop)**

Run (separate terminal): `pnpm dev`
Open Chrome DevTools, set viewport to 1280×800.
Navigate to `http://localhost:3000`.

Confirm:

- Hero grid is two-column: text on left, prize card on right (~1.3:1 ratio)
- Stats row (R$ 10K / 104 / 48) is 3 columns
- Features section: 4 cards in a single row
- Promo section: text on left, flag list on right; Brasil row highlighted yellow with "SUA ESCOLHA" badge
- Header nav shows "Como funciona" + "Cashback" + yellow "Entrar" button
- Footer at the bottom with copyright + disclaimer

- [ ] **Step 3: Manual viewport check at 390px (mobile, iPhone 14 width)**

In the same DevTools, switch viewport to 390×844 (or pick "iPhone 14" preset).
Reload `http://localhost:3000`.

Confirm:

- Header still visible: logo + "Entrar" button. "Como funciona" and "Cashback" anchor links are HIDDEN.
- Hero is single-column: badge → title → description → CTAs → stats → prize card BELOW (not beside)
- Features: cards stack to 1 column (or 2 columns max if width allows; spec uses `auto-fit, minmax(280px, 1fr)`)
- Promo: text block above, flag list below (1 column)
- Footer remains at the bottom

- [ ] **Step 4: Click-through manual check**

Still in the browser:

- Click "Como funciona" in the header → smooth scrolls to Features section, title not hidden by sticky header
- Click "Cashback" in the header → smooth scrolls to Promo section
- Click "Ver regras" in the hero → smooth scrolls to Features section
- Click "Comprar minha tabela →" in the hero → navigates to `/login` (which still shows whatever placeholder Feature 1 set up; that's expected)
- Click logo "BOLÃO 26" → reloads home (`/`)

Stop `pnpm dev` (`Ctrl+C`).

- [ ] **Step 5: Final commit cleanup (only if needed)**

If `pnpm format` made changes in Step 1, stage and commit them:

```bash
git status
# if files were modified by format:
git add -u
git commit -m "chore: apply prettier formatting"
```

If no format changes, this step is a no-op. The branch is now ready for PR/merge per CLAUDE.md §9.

- [ ] **Step 6: Confirm clean tree**

Run: `git status`
Expected: `nothing to commit, working tree clean`

Run: `git log --oneline -15`
Expected (most recent first):

```
<hash> chore: apply prettier formatting          # only if Step 5 was needed
<hash> test(landing): add smoke test for landing page spec contract
<hash> chore(landing): update metadata description to reflect real landing
<hash> feat(landing): compose landing page from Hero, Features, Promo sections
<hash> feat(landing): add PromoSection with cashback CTA and flag rows
<hash> feat(landing): add FeaturesSection with 4 feature cards
<hash> feat(landing): add HeroSection with badge, title, CTAs, stats, prize card
<hash> feat(landing): wire SiteHeader and SiteFooter into public layout
<hash> feat(landing): add SiteHeader with sticky nav and anchor links
<hash> feat(landing): add SiteFooter with regulatory disclaimer
<hash> feat(landing): add Tailwind v4 utilities and scroll behavior
b7f01cb docs: add design spec for feature 3 (landing page)
... (older commits)
```

10 thematic commits implementing the feature, sitting on top of the spec commit. Ready for review.

---

## Done criteria recap (from spec §9)

- [x] `pnpm dev` shows the landing fiel ao protótipo nas 3 seções (Step 2-3 of Task 11)
- [x] `pnpm build` compila sem erro (Step 1 of Task 11)
- [x] `pnpm typecheck` passa sem erros (Step 1 of Task 11)
- [x] `pnpm lint` zero warnings (Step 1 of Task 11)
- [x] `pnpm test:run` passa todos os testes (Step 1 of Task 11)
- [x] Inspeção manual a 390px e 1280px (Steps 2-3 of Task 11)
- [x] Nenhum link da landing aponta pra rota inexistente (Step 4 of Task 11 confirms `/`, `/login`, and anchors)
