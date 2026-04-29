# Feature 3 — Landing page

**Data:** 2026-04-29
**Status:** Aprovado para implementação
**Autor:** Brainstorm conduzido com Jonatas
**Próximo passo:** writing-plans → executing-plans em worktree separado

---

## 1. Contexto e motivação

Terceira feature da seção 5 do `CLAUDE.md`. As Features 1 (setup do projeto) e 2 (schema do banco) já estão concluídas e mergeadas em `main`.

O repositório hoje tem:

- `app/(public)/page.tsx` — placeholder explícito ("Setup OK — landing page real entra na Feature 3")
- `app/(public)/layout.tsx` — header + footer placeholder ("placeholder de footer (real na Feature 3)")
- `app/globals.css` — tokens completos do protótipo via `@theme` Tailwind v4 (cores, fontes)
- `docs/prototype/bolao-copa-2026.html` — protótipo visual de referência (linhas 1316-1482 cobrem a landing)

Esta feature substitui os placeholders por uma landing page **fiel ao protótipo**, single-page com 3 seções (Hero, Features, Promo Cashback), single-page header com nav âncora e footer real com disclaimer regulatório. A página é Server Component puro: sem `"use client"`, sem estado, sem I/O. Conteúdo hardcoded — quando a Feature 6 (checkout) ligar dados reais às vagas de cashback, refatora-se a `<PromoSection/>`.

Esta feature **não** entrega:

- Páginas `/regras`, `/faq`, `/ranking` (rotas adiadas; nav remove esses links)
- Auth flow real (Feature 4)
- Checkout / Asaas (Feature 6)
- OpenGraph image, Twitter card, manifest, favicon (Feature 14)
- Termos de uso, Política de privacidade (Feature 14)
- Visual regression / a11y completa (axe) — fora do escopo de testes desta feature

---

## 2. Decisões consolidadas no brainstorming

| #   | Pergunta                              | Escolha                                                                   | Motivação                                                                                                                            |
| --- | ------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | Escopo da landing                     | **Single page com 3 seções, nav âncora, sem rotas auxiliares**            | Entrega o que o protótipo mostra; sem expandir escopo pra `/regras`/`/faq`                                                           |
| Q2  | Conteúdo dinâmico vs estático         | **Hardcoded direto no JSX**                                               | Sem retrabalho desnecessário; Feature 6 refatora `<PromoSection/>` quando houver dados reais                                         |
| Q3  | Destino dos CTAs principais           | **Todos → `/login`**                                                      | Destino semântico claro (precisa logar antes de comprar); coerente com nav "Entrar"                                                  |
| Q4  | Footer                                | **Mínimo + disclaimer regulatório**                                       | Lei 14.790/2023 deixa bolão pago em zona cinzenta; disclaimer barato e útil; Termos/Privacidade ficam pra Feature 14                 |
| Q5  | Localização e granularidade           | **`components/` no root, subpastas `layout/` e `landing/`, 1 arquivo por seção** | Convenção padrão Next/React; sub-bits repetidos (`FeatureCard`, `FlagRow`) ficam inline na seção pai                                |
| Q6  | Estratégia de nav no mobile           | **Esconder âncoras, manter logo + Entrar**                                | 3 seções é scroll natural curto; sem hambúrguer (overkill); zero JS extra                                                            |
| Q7  | Estratégia de testes                  | **Smoke test único Vitest + RTL**                                         | Landing é apresentação pura; smoke test catches regressão de markup sem ditar forma interna                                          |
| Q8  | Mapeamento CSS → Tailwind v4          | **`@utility` para padrões repetidos ≥3×, utilities puras no resto**       | Fidelidade ao protótipo (já pensa em componentes); JSX limpo; superfície CSS mínima e localizada em `globals.css`                    |

---

## 3. Arquitetura

### 3.1 Runtime e hierarquia

- **Tudo Server Component.** Zero `"use client"` na feature.
- **Sem estado, sem I/O.** A página não consulta banco, não faz fetch, não tem hook.
- **JS no cliente apenas o mínimo do React/Next** pra hidratação básica (Next sempre injeta um runtime base).
- Smooth scroll dos âncoras via CSS (`scroll-behavior: smooth` em `<html>`), com fallback `auto` em `prefers-reduced-motion: reduce`.

### 3.2 Árvore de arquivos

**Arquivos novos:**

```
app/(public)/
  page.test.tsx                   ← smoke test (Vitest + RTL)

components/
  layout/
    SiteHeader.tsx                ← logo + nav âncora (desktop) + botão Entrar
    SiteFooter.tsx                ← copyright + disclaimer regulatório
  landing/
    HeroSection.tsx               ← badge, título, desc, CTAs, stats, PrizeCard inline
    FeaturesSection.tsx           ← header + 4 FeatureCard inline
    PromoSection.tsx              ← lado texto + 4 FlagRow inline (hardcoded)
```

**Arquivos editados (substituições):**

```
app/
  layout.tsx                      ← editar metadata.description
  globals.css                     ← adicionar smooth-scroll, scroll-margin, custom utilities, keyframes
  (public)/
    layout.tsx                    ← reescrever: <SiteHeader/> + <main>{children}</main> + <SiteFooter/>
    page.tsx                      ← reescrever: <HeroSection/> + <FeaturesSection/> + <PromoSection/>
```

**Não toco:**

- `app/error.tsx`, `app/not-found.tsx` — autocontidos por design (ver §6)
- `app/(auth)`, `app/(dashboard)`, `app/(admin)` — fora do escopo
- `lib/`, `supabase/`, configs em raiz — landing não consulta nada nem precisa de novo setup

### 3.3 Cross-check de dependências e configs

Verificado antes do design ser finalizado:

| Item                                    | Estado          | Observação                                                                       |
| --------------------------------------- | --------------- | -------------------------------------------------------------------------------- |
| `vitest.setup.ts`                       | ✅ existe        | Já importa `@testing-library/jest-dom/vitest` — `toBeInTheDocument()` funciona  |
| `vitest.config.mts`                     | ✅ existe        | `environment: 'jsdom'`, `globals: true`, `tsconfigPaths` plugin                  |
| `tsconfig.json#paths`                   | ✅ `@/* → ./*`  | Imports `@/components/layout/...` resolvem em código e em testes                 |
| `next.config.mjs#typedRoutes`           | ✅ `true`        | `<Link href="/login">` é type-checked; `/login` existe                           |
| `postcss.config.mjs`                    | ✅ Tailwind v4   | Suporta `@utility` e `@theme`                                                    |
| `app/globals.css#@theme`                | ✅ tokens prontos| Cores, fontes, todos os tokens do protótipo já registrados — não preciso editar |
| `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` | ✅ em devDeps | Sem instalação extra |

---

## 4. Componentes

Todos são Server Components. Nenhum recebe props (conteúdo hardcoded conforme Q2).

### 4.1 `<SiteHeader/>` — `components/layout/SiteHeader.tsx`

`<header class="sticky top-0 z-50 border-b border-border backdrop-blur-md bg-bg-dark/95 px-6 py-3">` (sticky no topo, blur 12px, fundo `--color-bg-dark` a 95%, borda inferior). Contém um container `flex items-center justify-between max-w-[1200px] mx-auto`:

- **Logo** à esquerda (também é `<Link href="/" aria-label="Bolão Copa 2026 — início">`):
  - Caixa amarela 36×36 rotacionada `-5deg` com letra "B" preta peso 900
  - Texto `BOLÃO 26` em Bebas Neue, com "26" em accent
- **Nav** (`<nav aria-label="Principal">`) à direita:
  - `<a href="#features">Como funciona</a>` — `hidden md:inline-flex`
  - `<a href="#cashback">Cashback</a>` — `hidden md:inline-flex` (substitui "Ranking" do protótipo, que ia pra rota inexistente)
  - `<Link href="/login" class="btn-primary">Entrar</Link>` — sempre visível
- Removidos do nav original do protótipo: "Regras" e "FAQ" (rotas não existem)

### 4.2 `<SiteFooter/>` — `components/layout/SiteFooter.tsx`

`<footer class="border-t border-border py-8 text-center">` (32px de padding vertical, borda `--color-border` no topo). Conteúdo:

- Linha 1 (`text-text-secondary`, font-body, 14px): `© 2026 Bolão Copa 2026`
- Linha 2 (`text-text-muted`, font-mono, 12px, `mt-2`): `Não afiliado à FIFA. Competição entre conhecidos.`

### 4.3 `<HeroSection/>` — `components/landing/HeroSection.tsx`

`<section id="hero">` com background composto (literal do protótipo, aplicado via `style`):

```
radial-gradient(ellipse at top right, rgba(250, 204, 21, 0.15), transparent 50%),
radial-gradient(ellipse at bottom left, rgba(0, 151, 57, 0.12), transparent 50%),
var(--color-bg-dark)
```

Padding vertical: `pt-20 pb-30` (80px / 120px). Em cima do background, um grid overlay sutil via `::before`:

```
background-image:
  linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
background-size: 40px 40px;
pointer-events: none;
```

Container interno `max-w-[1200px] mx-auto` posicionado relative com z-index acima do overlay. Grid principal: `grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-20 md:gap-20 items-center`.

**Lado esquerdo:**

- `<HeroBadge/>` inline: pill amarelo translúcido com bullet `animate-pulse-dot` e texto `Copa do Mundo · EUA · México · Canadá` (uppercase, mono, letterspacing)
- `<h1 class="hero-title">` com 3 spans:
  1. `<span class="line-1">Palpite.</span>` — text-primary
  2. `<span class="line-2">Pontue.</span>` — accent
  3. `<span class="line-3">Leve R$ 10 mil pra casa.</span>` — sub-line, font-archivo, peso 800, uppercase
- `<p>` descritivo: literal do protótipo
  > "O bolão mais justo da Copa 2026. 104 jogos, pontuação ao vivo, ranking em tempo real. R$ 20 a tabela. Comprou 5, escolhe uma seleção — se ela for campeã, você leva 100% de volta."
- 2 CTAs:
  - `<Link href="/login" class="btn-primary btn-hero">Comprar minha tabela →</Link>`
  - `<a href="#features" class="btn-secondary btn-hero">Ver regras</a>` (aponta pra Features porque `/regras` não existe)
- Bloco `<div class="hero-stats">` com 3 stats em grid:
  - `R$ 10K / Prêmio total`
  - `104 / Jogos`
  - `48 / Seleções`

**Lado direito — `<PrizeCard/>` inline:**

Card escuro com gradiente `linear-gradient(145deg, var(--color-bg-elevated), var(--color-bg-card))` e radial-gradient accent overlay. Interior:

- Header: span "Distribuição do Prêmio" (mono, muted) + caixa amarela com 🏆
- Valor grande: `R$ 10.000` (currency `R$` superscript menor)
- Sub-label: "dividido entre os 10 primeiros colocados"
- 4 linhas de distribuição (`<div class="prize-row">`), cada uma com:
  - posição em caixa pequena (`1º`, `2º`, `3º`, `4-10`)
  - rótulo (`Campeão`, `Vice`, `Terceiro`, `Top 10`)
  - valor em accent mono (`R$ 5.000`, `R$ 2.500`, `R$ 1.500`, `R$ 1.000`)
- Borda esquerda colorida por posição: ouro #FFD700 (1º), prata #C0C0C0 (2º), bronze #CD7F32 (3º), neutra (4-10)

### 4.4 `<FeaturesSection/>` — `components/landing/FeaturesSection.tsx`

`<section id="features" class="bg-bg-card py-24">` (alvo da âncora `#features`; `py-24` = 96px ≈ 100px do protótipo).

- Título centralizado `<h2 class="section-title">Como <span>funciona</span></h2>` (Bebas Neue, "funciona" em accent)
- Subtítulo: "Simples, transparente e ao vivo. Você palpita, o sistema calcula, o placar sobe."
- Grid responsivo `auto-fit, minmax(280px, 1fr)` com 4 cards inline (`<div class="feature-card">`):

| Ícone | Título                       | Descrição                                                                                |
| ----- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| 💳    | Compre sua tabela            | R$ 20 por tabela via PIX. Quanto mais tabelas, mais chances. Confirmação na hora no WhatsApp. |
| ⚽    | Palpite nos 104 jogos        | Fase de grupos e mata-mata. Escolha campeão, vice, artilheiro e mais bônus especiais.   |
| 📊    | Pontue em tempo real         | Placar exato vale 10 pts. Vencedor vale 5. Mata-mata multiplica. Ranking atualiza automático. |
| 💰    | Receba no PIX                | Terminou a Copa? Top 10 recebe o prêmio direto na conta em até 48h após a final.        |

Cada card tem o emoji em `<span aria-hidden="true">` dentro de uma caixa amarela translúcida 48×48; título em `<h3>` peso 700 18px; descrição em `text-text-secondary` 14px. Hover sobe 4px e troca borda para accent — via custom utility `feature-card`.

### 4.5 `<PromoSection/>` — `components/landing/PromoSection.tsx`

`<section id="cashback" class="border-y border-border py-20">` (alvo da âncora `#cashback`; `py-20` = 80px). Background composto (literal do protótipo, aplicado via `style`):

```
linear-gradient(135deg, rgba(250, 204, 21, 0.08), rgba(0, 151, 57, 0.05)),
var(--color-bg-dark)
```

Grid 2-col em desktop, 1-col mobile.

**Esquerda:**

- Tag verde Brasil: `<span class="promo-tag">🎁 Promoção Cashback</span>`
- `<h2 class="promo-title">Comprou <span>R$ 100+</span><br>Escolheu campeão?<br><span>Dinheiro de volta.</span></h2>` (Bebas Neue 64px, accent nos spans)
- `<p>` descritivo:
  > "Compre 5 tabelas ou mais (R$ 100+) e escolha uma seleção. Se ela for campeã da Copa, você recebe 100% do valor pago de volta no PIX. Limite de 20 apostadores por seleção — primeiro chegou, levou."
- CTA: `<Link href="/login" class="btn-primary btn-hero">Garantir meu cashback →</Link>`

**Direita — `<PromoVisual/>` inline:**

Card externo: `<div class="bg-bg-card border border-border-strong rounded-2xl p-8">` (32px de padding, borda forte, raio 16px). Logo dentro, comentário JSX deixa claro que dados são demonstrativos até a Feature 6. Conteúdo em `<div class="space-y-3">` com 4 `flag-row`:

| Bandeira (emoji) | Nome        | Texto vagas             | Classe na div                    | Notas                              |
| ---------------- | ----------- | ----------------------- | -------------------------------- | ---------------------------------- |
| 🇧🇷               | Brasil      | 12/20 vagas restantes   | `flag-row flag-row-selected`     | Inclui badge "SUA ESCOLHA" à direita |
| 🇦🇷               | Argentina   | 8/20 vagas restantes    | `flag-row`                       | —                                  |
| 🇫🇷               | França      | 15/20 vagas restantes   | `flag-row`                       | —                                  |
| 🏴󠁧󠁢󠁥󠁮󠁧󠁿               | Inglaterra  | 19/20 vagas restantes   | `flag-row`                       | —                                  |

Bandeiras emoji em `<span aria-hidden="true">` (decoração). Nome em peso 700 15px; metadado em font-mono 12px text-muted. Badge "SUA ESCOLHA" usa `bg-accent text-bg-dark px-2.5 py-1 rounded font-mono text-[11px] font-bold`.

**Por que `space-y-3` no parent em vez de `mb-3` na utility:** `space-y-*` zera a margem do último item naturalmente; manter `flag-row` sem margem deixa a utility reusável em outros contextos.

---

## 5. Estilização

### 5.1 Estado atual de `app/globals.css`

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
}
```

Tokens completos. **Nenhum token novo precisa ser adicionado.**

### 5.2 Adições a `app/globals.css`

#### Bloco A — Comportamento global de scroll

```css
@layer base {
  html {
    scroll-behavior: smooth;
  }

  section[id] {
    scroll-margin-top: 6rem; /* compensa header sticky de ~72px */
  }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}
```

#### Bloco B — Custom utilities (Tailwind v4 `@utility`)

Apenas padrões que aparecem ≥3× no protótipo. JSX usa cada utility como classe simples; podem ser combinadas com utilities Tailwind.

```css
@utility btn-primary {
  @apply inline-flex items-center justify-center bg-accent text-bg-dark
         px-6 py-3 rounded-lg font-bold text-sm transition
         hover:bg-accent-hover hover:-translate-y-px
         hover:shadow-[0_8px_24px_rgba(250,204,21,0.3)]
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-dark;
}

@utility btn-secondary {
  @apply inline-flex items-center justify-center bg-transparent text-text-primary
         px-6 py-3 rounded-lg border border-border-strong font-semibold text-sm transition
         hover:border-accent hover:text-accent
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-dark;
}

@utility btn-hero {
  @apply px-7 py-4 text-[15px];
}

@utility feature-card {
  @apply bg-bg-elevated border border-border rounded-2xl p-7 transition
         hover:border-accent hover:-translate-y-1;
}

@utility flag-row {
  @apply flex items-center gap-4 p-4 bg-bg-elevated rounded-xl border border-border;
}

@utility flag-row-selected {
  @apply border-accent bg-[rgba(250,204,21,0.08)];
}
```

#### Bloco C — Keyframe `pulse-dot` (do bullet do hero badge)

```css
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@utility animate-pulse-dot {
  animation: pulse-dot 2s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-pulse-dot { animation: none; }
}
```

(Não usamos `animate-pulse` do Tailwind porque ele tem timing e easing diferentes do protótipo.)

### 5.3 O que **não** vira utility

Padrões que aparecem só 1× (`prize-card`, `hero-grid`, `promo-grid`, `landing-hero` background, `logo-mark`, `prize-amount`) ficam com utilities Tailwind inline no JSX da seção dona. Coisas únicas como o `radial-gradient` do hero ficam como `bg-[...]` (Tailwind v4 aceita arbitrary values) ou `style={{ background: '...' }}` se a expressão for muito longa.

---

## 6. Rotas, links e âncoras

### 6.1 Mapa completo de links

| Texto                       | Componente / tag | Destino     | Atributos especiais                          |
| --------------------------- | ---------------- | ----------- | -------------------------------------------- |
| Logo `BOLÃO 26`             | `next/link`      | `/`         | `aria-label="Bolão Copa 2026 — início"`     |
| Nav: `Como funciona`        | `<a>`            | `#features` | `hidden md:inline-flex`                      |
| Nav: `Cashback`             | `<a>`            | `#cashback` | `hidden md:inline-flex`                      |
| Nav: `Entrar`               | `next/link`      | `/login`    | `class="btn-primary"`, sempre visível       |
| Hero CTA primário           | `next/link`      | `/login`    | `class="btn-primary btn-hero"`               |
| Hero CTA secundário         | `<a>`            | `#features` | `class="btn-secondary btn-hero"`             |
| Promo CTA                   | `next/link`      | `/login`    | `class="btn-primary btn-hero"`               |

### 6.2 Convenção `<Link>` vs `<a>`

- **Navegação interna entre rotas** (`/`, `/login`) usa `next/link`.
- **Âncoras na mesma página** (`#features`, `#cashback`) usam `<a href="#...">` puro. `<Link>` em âncora dispara prefetch desnecessário e adiciona ruído.

### 6.3 IDs de seção

A landing tem 3 seções com `id` deterministicamente atribuídos:

- `<section id="hero">` — não é alvo de âncora; mantido só por simetria/possível uso futuro
- `<section id="features">` — alvo de "Como funciona" (nav) e "Ver regras" (hero CTA secundário)
- `<section id="cashback">` — alvo de "Cashback" (nav)

`scroll-margin-top: 6rem` em `section[id]` evita que o título fique escondido sob o header sticky.

### 6.4 Acessibilidade

- Logo do header tem `aria-label`.
- Nav tem `aria-label="Principal"`.
- Botões/CTAs têm `focus-visible:ring-*` (definido nas custom utilities `btn-primary`/`btn-secondary`).
- Emojis decorativos (🏆, 💳, ⚽, 📊, 💰, 🎁, 🇧🇷, 🇦🇷, 🇫🇷, 🏴󠁧󠁢󠁥󠁮󠁧󠁿) ficam em `<span aria-hidden="true">` pra leitores de tela pularem o decorativo.
- Sem `outline-none` em nenhum lugar; estilo de focus default do browser permanece como fallback.
- Todos os `<a>` e `<Link>` têm conteúdo textual visível — nenhum link "vazio".

### 6.5 Rotas / OpenGraph fora do escopo

- `/regras`, `/faq`, `/ranking`, `/dashboard`, `/admin` — não criadas; nenhum link da landing aponta pra elas.
- OpenGraph image, Twitter card, favicon, manifest, robots.txt — adiados pra Feature 14 (deploy + polimento).

---

## 7. Error handling e edge cases

### 7.1 Superfícies de erro reais

Landing é apresentacional puro: nenhum `await`, nenhum I/O, nenhum estado. Mapa explícito do que pode falhar:

| Cenário                                          | Tratamento                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Fonte do Google falha (`next/font`)              | Fallback automático na chain `var(--font-bebas), 'Bebas Neue', sans-serif` em `globals.css`. Nada a fazer. |
| Erro de hidratação React                         | `app/error.tsx` (já existe, autocontido) captura. Sem mudança.                                 |
| URL desconhecida (`/qualquer-coisa`)             | `app/not-found.tsx` (já existe, autocontido) responde 404. Sem mudança.                        |
| Âncora `#features` ou `#cashback` quebrada       | Smoke test (§8) garante que os IDs existem.                                                    |
| Emoji de bandeira não renderiza no OS do usuário | Aceito — degradação graciosa para texto/quadrado branco. SVG fica pra Feature 14.              |

### 7.2 Estado atual de `app/error.tsx` (não vai mudar)

```tsx
'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="font-display text-danger text-7xl tracking-wide">erro</span>
      <p className="font-body text-text-secondary text-base">Algo deu errado. Tenta de novo.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="border-border-strong text-text-primary hover:border-accent hover:text-accent font-body rounded-md border px-4 py-2 text-sm"
      >
        Tentar novamente
      </button>
    </main>
  );
}
```

### 7.3 Estado atual de `app/not-found.tsx` (não vai mudar)

```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="font-display text-accent text-8xl tracking-wide">404</span>
      <p className="font-body text-text-secondary text-lg">Página não encontrada.</p>
      <Link href="/" className="font-body text-accent text-sm underline-offset-4 hover:underline">
        Voltar pra home
      </Link>
    </main>
  );
}
```

**Por que ambos ficam autocontidos (sem `<SiteHeader/>` / `<SiteFooter/>`):** `error.tsx` precisa funcionar mesmo se um componente do layout quebrar; importar `SiteHeader` cria caminho de erro recursivo. `not-found.tsx` é catch-all global (não pertence ao grupo `(public)`); receber chrome de "página pública" seria errado semanticamente.

### 7.4 `app/layout.tsx` (root) — único ajuste

Estado atual mantém fontes, `<Toaster/>` e estrutura. Único campo a mudar é `metadata.description`:

**Antes:**

```ts
export const metadata: Metadata = {
  title: 'Bolão Copa 2026',
  description: 'Bolão da Copa do Mundo FIFA 2026.',
};
```

**Depois:**

```ts
export const metadata: Metadata = {
  title: 'Bolão Copa 2026',
  description: 'Bolão da Copa do Mundo FIFA 2026. R$ 20 a tabela, R$ 10 mil em prêmios, ranking ao vivo.',
};
```

---

## 8. Testes

### 8.1 Localização e harness

Arquivo único: `app/(public)/page.test.tsx`. Vitest pega via globs do `vitest.config.mts` (`include: ['**/*.{test,spec}.{ts,tsx}']`).

Nenhuma mudança em `vitest.config.mts` ou `vitest.setup.ts` — harness atual já dá:

- `environment: 'jsdom'`
- `globals: true` (sem precisar importar `describe`/`it`/`expect`)
- `setupFiles: ['./vitest.setup.ts']` (que já carrega `@testing-library/jest-dom/vitest`)
- `vite-tsconfig-paths` resolvendo `@/`

### 8.2 Conteúdo do teste (esboço final)

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HomePage from './page';
import PublicLayout from './layout';

const renderLanding = () =>
  render(
    <PublicLayout>
      <HomePage />
    </PublicLayout>,
  );

describe('Landing page', () => {
  it('renderiza landmarks principais', () => {
    renderLanding();
    expect(screen.getByRole('banner')).toBeInTheDocument(); // <header>
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // <footer>
  });

  it('hero exibe título e CTA principal apontando pra /login', () => {
    renderLanding();
    expect(
      screen.getByRole('heading', { level: 1, name: /Palpite\.\s*Pontue\.\s*Leve R\$ 10 mil pra casa\./i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Comprar minha tabela/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('seção features tem id correto e renderiza 4 cards', () => {
    const { container } = renderLanding();
    expect(container.querySelector('#features')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /Como funciona/i }),
    ).toBeInTheDocument();
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
    // Regex ancoradas pra desambiguar: "Cashback" sem ^$ casaria também o
    // "Garantir meu cashback" do promo; "Entrar" sem ^$ casaria "Comprar..."
    // se a regex fosse fuzzy.
    expect(screen.getByRole('link', { name: /^Como funciona$/i })).toHaveAttribute('href', '#features');
    expect(screen.getByRole('link', { name: /^Cashback$/i })).toHaveAttribute('href', '#cashback');
    expect(screen.getByRole('link', { name: /^Entrar$/i })).toHaveAttribute('href', '/login');
  });

  it('footer mostra copyright e disclaimer', () => {
    renderLanding();
    expect(screen.getByText(/©\s*2026 Bolão Copa 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Não afiliado à FIFA\. Competição entre conhecidos\./i)).toBeInTheDocument();
  });
});
```

**Notas técnicas:**

- O teste renderiza `<PublicLayout><HomePage/></PublicLayout>` manualmente porque RTL não conhece o sistema de route groups do App Router.
- `getByRole('link', { name: /^Entrar$/i })` usa âncora regex pra distinguir do botão "Comprar..." (que poderia matchear "Entrar" se a regex fosse fuzzy).

### 8.3 O que **não** é coberto e por quê

- **Visual regression / pixel-perfect** — fora de escopo; protótipo HTML serve de referência manual.
- **Animações, hover, smooth scroll** — RTL/jsdom não roda CSS nem animações; testar isso é teatro.
- **a11y completa via axe** — adiar pra quando tivermos formulários (Feature 4).
- **Responsividade real** — jsdom não tem viewport real; verifica-se manualmente no critério de pronto.

---

## 9. Critérios de pronto

A feature está pronta quando:

1. `pnpm dev` mostra a landing fiel ao protótipo nas 3 seções.
2. `pnpm build` compila sem erro.
3. `pnpm typecheck` passa sem erros.
4. `pnpm lint` zero warnings.
5. `pnpm test:run` passa todos os testes (smoke novo + `lib/__tests__/utils.test.ts` existente).
6. **Inspeção manual obrigatória** em duas viewports:
   - **~390px (mobile):** nav âncora some; logo + Entrar visíveis; hero vira coluna única com prize-card abaixo; features grid colapsa pra 1-2 colunas; promo grid vira 1 coluna; footer permanece no fim.
   - **~1280px (desktop):** layout fiel ao protótipo (hero 1.3fr/1fr, features 4-up, promo 2-up).
7. Nenhum link da landing aponta pra rota inexistente (rotas referenciadas: `/` e `/login`, ambas existem).

---

## 10. Convenções aplicadas

- **Sem comentários explicativos** sobre o que o código faz; nomes de identificadores explicam.
- **Comentário inline apenas onde tem aviso de honestidade técnica:** o `<PromoVisual/>` da `<PromoSection/>` recebe um comentário JSX no topo deixando claro que dados são demonstrativos até a Feature 6.
- **Sem `try/catch` em RSC** — não há chamada que possa falhar.
- **Sem `Suspense` boundaries** — nada é assíncrono.
- **Sem `'use client'`** — landing não tem estado nem interatividade JS.
- **Sem novas dependências** — tudo o que precisa já está em `package.json`.

---

## 11. Próximo passo

Invocar `superpowers:writing-plans` pra gerar o plano de implementação por etapas (commits temáticos sequenciais, igual ao padrão das features anteriores). O plano deve sair em `docs/superpowers/plans/2026-04-29-landing-page.md`.
