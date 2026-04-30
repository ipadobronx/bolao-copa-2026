# Auth + dashboard layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os placeholders de `(auth)/login`, `(auth)/auth/callback`, `(dashboard)/layout`, `(dashboard)/dashboard`, e `(admin)/layout` por (a) fluxo de auth real via Supabase magic link puro com `nome` + `email` no formulário, (b) shell completa do dashboard (sidebar fixa no desktop + drawer Radix Dialog no mobile, header com greeting/user-badge, botão "Sair" no rodapé do nav), (c) painel "Próximos jogos da Copa" no `/dashboard` (top 5 read-only com CTA "Palpitar" linkando pra `/palpites/[id]`), e (d) middleware que protege `/dashboard*`/`/admin*`/`/palpites*`/`/ranking*` redirecionando anon → `/login?next=...` e logado em `/login` → `/dashboard`.

**Architecture:** Server Components por padrão; Client apenas pra `<LoginForm/>` (state machine local + cooldown), `<DashboardNav/>` (signOut + nav links com `usePathname`) e `<DashboardTopbarMobile/>` (estado do drawer Radix Dialog). Auth via `supabase.auth.signInWithOtp` no client com `data: { full_name }` (chave que o trigger `handle_new_user` lê). Callback faz `exchangeCodeForSession` no servidor e redireciona pra `next` validado. Middleware é o single source of truth de redirects; layouts re-checam `getUser` por defesa em profundidade. Helpers puros (`iniciais`, `formatDataRelativa`, `loginSchema`, `validateNext`) ficam em `lib/` com TDD.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript estrito, Tailwind v4 (`@theme`/`@utility`), Supabase Auth + `@supabase/ssr`, Radix UI Dialog, Lucide React (ícones), Sonner (toasts), Zod (validação), Vitest + Testing Library + jsdom. Nenhuma dependência nova — todas já no `package.json`.

**Spec:** `docs/superpowers/specs/2026-04-29-auth-dashboard-design.md` (commits `df69a9e` + `f0854f2` em `main`).

**Estratégia de testes neste plano:**

- **TDD obrigatório** em `lib/format/*` e `lib/validators/*` (puros, alta cobertura).
- **Smoke tests** (Vitest + RTL) pra: `<LoginForm/>` (state machine), `app/(auth)/login/page.tsx` (shell), `<DashboardNav/>` (7 itens + drawer + signOut), `<ProximosJogosPanel/>` (renderiza/empty/TBD).
- **Sem testes** pra middleware, callback (Route Handler), layouts (dashboard/admin), e RLS — todos cobertos manualmente em Task 21 ou validados na F2.
- **`(dashboard)/dashboard/page.test.tsx`** (marcado "opcional" no spec §8.2) é skipado neste plano. Justificativa: testar Server Component async + Layout async + supabase mockado em chains profundas dá baixo retorno comparado ao smoke manual em Task 21. As partes testáveis (panel, helpers) já têm cobertura.

**Prerequisites for the developer (verify before starting):**

- [ ] Worktree set up at `feat/auth-dashboard` branch (the controller creates this via using-git-worktrees skill before dispatching tasks)
- [ ] HEAD of `feat/auth-dashboard` branch is `f0854f2` ou descendant (inclui o spec e os fixes de self-review da F4)
- [ ] `pnpm install` is up to date (no new dependencies needed for this feature)
- [ ] All quality gates pass on the starting state:
  - `pnpm typecheck` (zero errors)
  - `pnpm lint` (zero warnings)
  - `pnpm format:check` (no formatting issues)
  - `pnpm test:run` (existing tests pass — `lib/__tests__/utils.test.ts` + `app/(public)/page.test.tsx`)
- [ ] `.env.local` exists in the worktree com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` populados (preserved from Features 1-3).
- [ ] Project Supabase Cloud (dev) está com schema da F2 aplicado (confirmado por `supabase migration list` ou pelas commits `443583e`/`8477eb4`/`5e2ede0` no `main`).
- [ ] **Supabase Auth → Site URL** configurado (no Supabase Dashboard → Authentication → URL Configuration) com `http://localhost:3000` em "Site URL" e `http://localhost:3000/auth/callback` em "Redirect URLs". Sem isso, o magic link redireciona pra um lugar errado e o smoke manual em T21 falha.
- [ ] `pnpm dev` boots clean e mostra a landing real em `http://localhost:3000`.

---

## Task 1: Foundation — `@utility` classes do dashboard em `app/globals.css`

**Goal:** Adicionar 7 utilities Tailwind v4 que aparecem ≥3× nesta feature: `panel`, `panel-header`, `sidebar-item`, `sidebar-item-active`, `sidebar-item-disabled`, `sign-out-btn`, `btn-sm`. Conforme spec §5.3 e §6. Subsequent component tasks dependem dessas classes.

**Files:**

- Modify: `app/globals.css`

- [ ] **Step 1: Add the new `@utility` blocks to `app/globals.css`**

Open `app/globals.css` and append these blocks **after** the existing `@utility animate-pulse-dot` block and **before** the closing `@media (prefers-reduced-motion: reduce)` block at the end of the file:

```css
@utility panel {
  @apply bg-bg-card border-border mb-6 overflow-hidden rounded-2xl border;
}

@utility panel-header {
  @apply border-border flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5;
}

@utility sidebar-item {
  @apply text-text-secondary hover:bg-bg-elevated hover:text-text-primary flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors;
}

@utility sidebar-item-active {
  @apply bg-accent/10 text-accent;
}

@utility sidebar-item-disabled {
  @apply text-text-muted/60 cursor-not-allowed pointer-events-none;
}

@utility sign-out-btn {
  @apply text-text-secondary hover:bg-bg-elevated hover:text-danger border-border mt-auto flex items-center gap-2 rounded-lg border-t px-3 py-2.5 pt-4 text-sm font-medium transition-colors;
}

@utility btn-sm {
  @apply text-text-primary border-border-strong hover:border-accent hover:text-accent inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold transition;
}
```

- [ ] **Step 2: Verify the build picks up the new utilities**

Run: `pnpm build`
Expected: Build completes successfully. No "Unknown at-rule" errors. Output mentions all existing routes plus generated CSS.

If build fails complaining about an `@utility` block: confirm `@tailwindcss/postcss` is at `^4.0.0` in `package.json`.

- [ ] **Step 3: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(auth-dashboard): add Tailwind utilities for sidebar, panel, sign-out, btn-sm"
```

---

## Task 2: `lib/format/iniciais.ts` (TDD)

**Goal:** Helper puro que extrai 1-2 letras maiúsculas do nome pra usar no avatar circular. Conforme spec §5.2 e §8.1.

**Files:**

- Create: `lib/format/iniciais.ts`
- Test: `lib/__tests__/iniciais.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/iniciais.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { iniciais } from '@/lib/format/iniciais';

describe('iniciais', () => {
  it('uma palavra → primeira letra maiúscula', () => {
    expect(iniciais('Ana')).toBe('A');
  });

  it('duas palavras → primeira de cada', () => {
    expect(iniciais('Jonatas Pereira')).toBe('JP');
  });

  it('três ou mais palavras → primeira + última', () => {
    expect(iniciais('José Anaíde da Silva')).toBe('JS');
  });

  it('normaliza espaços extras nas pontas e no meio', () => {
    expect(iniciais('  jonatas   pereira  ')).toBe('JP');
  });

  it('uma palavra com whitespace → primeira letra', () => {
    expect(iniciais('  jonatas  ')).toBe('J');
  });

  it('string vazia retorna fallback', () => {
    expect(iniciais('')).toBe('?');
  });

  it('string só com espaços retorna fallback', () => {
    expect(iniciais('   ')).toBe('?');
  });

  it('null retorna fallback', () => {
    expect(iniciais(null)).toBe('?');
  });

  it('undefined retorna fallback', () => {
    expect(iniciais(undefined)).toBe('?');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run lib/__tests__/iniciais.test.ts`
Expected: FAIL with "Failed to resolve import '@/lib/format/iniciais'" (file doesn't exist yet).

- [ ] **Step 3: Implement `lib/format/iniciais.ts`**

Create `lib/format/iniciais.ts`:

```ts
export function iniciais(nome: string | null | undefined): string {
  if (!nome) return '?';
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return '?';
  if (palavras.length === 1) return palavras[0]!.slice(0, 1).toUpperCase();
  return (palavras[0]![0]! + palavras[palavras.length - 1]![0]!).toUpperCase();
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run lib/__tests__/iniciais.test.ts`
Expected: All 9 tests pass.

- [ ] **Step 5: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 6: Commit**

```bash
git add lib/format/iniciais.ts lib/__tests__/iniciais.test.ts
git commit -m "feat(format): add iniciais helper with full unit coverage"
```

---

## Task 3: `lib/format/data-relativa.ts` (TDD)

**Goal:** Formata uma data como "Hoje" / "Amanhã" / "Sex, 14/06" + horário "16:00". TZ explícita `America/Sao_Paulo` em todas as chamadas Intl. Conforme spec §5.2 + §11.3.

**Files:**

- Create: `lib/format/data-relativa.ts`
- Test: `lib/__tests__/data-relativa.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/data-relativa.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatDataRelativa } from '@/lib/format/data-relativa';

// Helper: Date no fuso de Brasília (UTC-3, sem horário de verão desde 2019)
function brt(iso: string): Date {
  // ex: brt('2026-06-14T16:00') → 2026-06-14 16:00 BRT == 19:00 UTC
  return new Date(iso + '-03:00');
}

describe('formatDataRelativa', () => {
  it('mesmo dia, hora futura → "Hoje"', () => {
    const out = formatDataRelativa({
      data: brt('2026-06-14T20:00'),
      agora: brt('2026-06-14T15:00'),
    });
    expect(out.date).toBe('Hoje');
    expect(out.hour).toBe('20:00');
  });

  it('dia seguinte mesmo mês → "Amanhã"', () => {
    const out = formatDataRelativa({
      data: brt('2026-06-15T13:00'),
      agora: brt('2026-06-14T22:00'),
    });
    expect(out.date).toBe('Amanhã');
    expect(out.hour).toBe('13:00');
  });

  it('mais de 1 dia à frente → "EEE, DD/MM" abreviado em pt-BR', () => {
    const out = formatDataRelativa({
      data: brt('2026-06-18T19:00'),
      agora: brt('2026-06-14T22:00'),
    });
    // 18/06/2026 é uma quinta-feira
    expect(out.date).toMatch(/^qui,? 18\/06$/i);
    expect(out.hour).toBe('19:00');
  });

  it('virada de meia-noite: data 00:30 do dia seguinte vista às 23:00 → "Amanhã"', () => {
    const out = formatDataRelativa({
      data: brt('2026-06-15T00:30'),
      agora: brt('2026-06-14T23:00'),
    });
    expect(out.date).toBe('Amanhã');
    expect(out.hour).toBe('00:30');
  });

  it('hora sempre em fuso de Brasília mesmo se runtime estiver em UTC', () => {
    // 22:00 UTC == 19:00 BRT
    const out = formatDataRelativa({
      data: new Date('2026-06-14T22:00:00Z'),
      agora: new Date('2026-06-14T12:00:00Z'),
    });
    expect(out.hour).toBe('19:00');
  });

  it('semana seguinte cai no formato abreviado de dia da semana', () => {
    const out = formatDataRelativa({
      data: brt('2026-06-21T18:00'),
      agora: brt('2026-06-14T10:00'),
    });
    // 21/06/2026 é um domingo
    expect(out.date).toMatch(/^dom,? 21\/06$/i);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run lib/__tests__/data-relativa.test.ts`
Expected: FAIL with "Failed to resolve import '@/lib/format/data-relativa'".

- [ ] **Step 3: Implement `lib/format/data-relativa.ts`**

Create `lib/format/data-relativa.ts`:

```ts
type Args = {
  data: Date;
  agora: Date;
};

export function formatDataRelativa({ data, agora }: Args): { date: string; hour: string } {
  const TZ = 'America/Sao_Paulo';

  // YYYY-MM-DD da data e do "agora" no fuso de Brasília (sem hora) pra comparação de dias.
  const ymd = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

  const ymdData = ymd(data);
  const ymdAgora = ymd(agora);

  // Diff em dias: parseia YYYY-MM-DD como UTC midnight pra evitar bugs de TZ na subtração.
  const diffDias = Math.round(
    (Date.parse(ymdData + 'T00:00:00Z') - Date.parse(ymdAgora + 'T00:00:00Z')) / 86_400_000,
  );

  let date: string;
  if (diffDias === 0) {
    date = 'Hoje';
  } else if (diffDias === 1) {
    date = 'Amanhã';
  } else {
    const diaSemana = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ,
      weekday: 'short',
    })
      .format(data)
      .replace('.', '')
      .replace(/^(\w)/, (m) => m.toLowerCase());
    const diaMes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TZ,
      day: '2-digit',
      month: '2-digit',
    }).format(data);
    date = `${diaSemana}, ${diaMes}`;
  }

  const hour = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(data);

  return { date, hour };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run lib/__tests__/data-relativa.test.ts`
Expected: All 6 tests pass.

If a test fails on day-of-week match (e.g. "qui, 18/06" not matching the regex):

- The pt-BR `weekday: 'short'` output may include a trailing dot ("qui."). The regex `/^qui,? 18\/06$/i` and the implementation's `.replace('.', '')` should handle this. Verify both.
- Some Node ICU builds output "Qui." capitalized; the implementation lowercases the first character explicitly. If this still fails, log `out.date` and adjust regex casing.

Do not weaken the test.

- [ ] **Step 5: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 6: Commit**

```bash
git add lib/format/data-relativa.ts lib/__tests__/data-relativa.test.ts
git commit -m "feat(format): add formatDataRelativa with Brasília TZ"
```

---

## Task 4: `lib/validators/login.ts` (TDD)

**Goal:** Zod schema pra validar `nome` + `email` no login. Conforme spec §5.2.

**Files:**

- Create: `lib/validators/login.ts`
- Test: `lib/__tests__/login-validator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/login-validator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loginSchema } from '@/lib/validators/login';

describe('loginSchema', () => {
  it('aceita nome e email válidos', () => {
    const out = loginSchema.parse({ nome: 'Jonatas Pereira', email: 'jonatas@example.com' });
    expect(out).toEqual({ nome: 'Jonatas Pereira', email: 'jonatas@example.com' });
  });

  it('faz trim do nome e email', () => {
    const out = loginSchema.parse({ nome: '  Jonatas  ', email: '  jonatas@example.com  ' });
    expect(out.nome).toBe('Jonatas');
    expect(out.email).toBe('jonatas@example.com');
  });

  it('lowercase no email', () => {
    const out = loginSchema.parse({ nome: 'Jonatas', email: 'JONATAS@EXAMPLE.com' });
    expect(out.email).toBe('jonatas@example.com');
  });

  it('rejeita nome com 1 caractere', () => {
    const result = loginSchema.safeParse({ nome: 'A', email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('rejeita nome só com whitespace (vira string vazia após trim)', () => {
    const result = loginSchema.safeParse({ nome: '   ', email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('rejeita nome maior que 80 caracteres', () => {
    const result = loginSchema.safeParse({ nome: 'a'.repeat(81), email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('rejeita email mal-formado', () => {
    const result = loginSchema.safeParse({ nome: 'Jonatas', email: 'nao-eh-email' });
    expect(result.success).toBe(false);
  });

  it('mensagens de erro vêm em pt-BR', () => {
    const result = loginSchema.safeParse({ nome: 'A', email: 'nao-eh-email' });
    if (result.success) throw new Error('expected failure');
    const errors = result.error.flatten().fieldErrors;
    expect(errors.nome?.[0]).toMatch(/pelo menos 2 caracteres/i);
    expect(errors.email?.[0]).toMatch(/email inválido/i);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run lib/__tests__/login-validator.test.ts`
Expected: FAIL with "Failed to resolve import '@/lib/validators/login'".

- [ ] **Step 3: Implement `lib/validators/login.ts`**

Create `lib/validators/login.ts`:

```ts
import { z } from 'zod';

export const loginSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Nome precisa ter pelo menos 2 caracteres.')
    .max(80, 'Nome muito longo.'),
  email: z.string().trim().toLowerCase().email('Email inválido.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run lib/__tests__/login-validator.test.ts`
Expected: All 8 tests pass.

- [ ] **Step 5: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 6: Commit**

```bash
git add lib/validators/login.ts lib/__tests__/login-validator.test.ts
git commit -m "feat(validators): add Zod loginSchema with trim/lowercase + pt-BR errors"
```

---

## Task 5: `lib/validators/next.ts` (TDD)

**Goal:** Helper minúsculo de segurança pra validar query param `next` de redirect (defesa contra open-redirect, usado em LoginForm e callback). Aceita só caminhos internos (`^/(?!\/)`).

> **Nota:** Esta task adiciona um arquivo que **não está listado em §5.1 do spec**. Justificativa: a regex `/^\/(?!\/)/` é citada em §4.1 step 4 e §7.1 do spec e é usada em 2 lugares (LoginForm pra montar `emailRedirectTo`, Route Handler `/auth/callback` pra decidir destino). Centralizar num único helper testável evita drift de regex e dá cobertura única a uma função sensível. Mantém a feature dentro do escopo declarado.

**Files:**

- Create: `lib/validators/next.ts`
- Test: `lib/__tests__/next-validator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/next-validator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { safeNext } from '@/lib/validators/next';

describe('safeNext', () => {
  it('aceita caminho interno simples', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard');
  });

  it('aceita caminho interno com query string', () => {
    expect(safeNext('/dashboard?tab=jogos')).toBe('/dashboard?tab=jogos');
  });

  it('aceita caminho interno aninhado', () => {
    expect(safeNext('/palpites/123')).toBe('/palpites/123');
  });

  it('rejeita URL absoluta http', () => {
    expect(safeNext('http://evil.com')).toBe('/dashboard');
  });

  it('rejeita URL absoluta https', () => {
    expect(safeNext('https://evil.com')).toBe('/dashboard');
  });

  it('rejeita protocol-relative URL', () => {
    expect(safeNext('//evil.com')).toBe('/dashboard');
  });

  it('rejeita string sem barra inicial', () => {
    expect(safeNext('dashboard')).toBe('/dashboard');
  });

  it('rejeita null', () => {
    expect(safeNext(null)).toBe('/dashboard');
  });

  it('rejeita undefined', () => {
    expect(safeNext(undefined)).toBe('/dashboard');
  });

  it('rejeita string vazia', () => {
    expect(safeNext('')).toBe('/dashboard');
  });

  it('aceita fallback customizado', () => {
    expect(safeNext('//evil.com', '/login')).toBe('/login');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm vitest run lib/__tests__/next-validator.test.ts`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Implement `lib/validators/next.ts`**

Create `lib/validators/next.ts`:

```ts
const INTERNAL_PATH = /^\/(?!\/)/;

export function safeNext(value: string | null | undefined, fallback: string = '/dashboard'): string {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  return INTERNAL_PATH.test(value) ? value : fallback;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run lib/__tests__/next-validator.test.ts`
Expected: All 11 tests pass.

- [ ] **Step 5: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 6: Commit**

```bash
git add lib/validators/next.ts lib/__tests__/next-validator.test.ts
git commit -m "feat(validators): add safeNext to prevent open-redirect via ?next= param"
```

---

## Task 6: `<LoginForm/>` component (Client)

**Goal:** Form de login com state machine local (idle → sending → sent), validação Zod, chamada `signInWithOtp`, cooldown de 60s no botão "Reenviar". Conforme spec §5.2 e §7.1. Sem teste ainda — vem na T7.

**Files:**

- Create: `components/auth/LoginForm.tsx`

- [ ] **Step 1: Create the component file**

```tsx
'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { env } from '@/lib/env';
import { loginSchema } from '@/lib/validators/login';
import { safeNext } from '@/lib/validators/next';

type Idle = {
  kind: 'idle';
  values: { nome: string; email: string };
  errors: Partial<Record<'nome' | 'email', string>>;
};
type Sending = { kind: 'sending'; values: { nome: string; email: string } };
type Sent = { kind: 'sent'; email: string; cooldownLeft: number };
type State = Idle | Sending | Sent;

export type LoginFormProps = {
  defaultNext?: string;
};

const COOLDOWN_SECONDS = 60;

export function LoginForm({ defaultNext }: LoginFormProps) {
  const [state, setState] = useState<State>({
    kind: 'idle',
    values: { nome: '', email: '' },
    errors: {},
  });
  const sentCardRef = useRef<HTMLDivElement>(null);
  const nomeId = useId();
  const emailId = useId();
  const nomeErrorId = useId();
  const emailErrorId = useId();

  // Tick the cooldown while in 'sent' state. The interval starts once on
  // entering 'sent' and is cleared on leaving (or unmount). The functional
  // updater always sees the latest cooldownLeft, so we don't need to restart
  // the interval each tick.
  useEffect(() => {
    if (state.kind !== 'sent') return;
    const timer = setInterval(() => {
      setState((prev) => {
        if (prev.kind !== 'sent' || prev.cooldownLeft === 0) return prev;
        return { ...prev, cooldownLeft: prev.cooldownLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [state.kind]);

  // Move focus to "Link enviado" card when entering 'sent'.
  useEffect(() => {
    if (state.kind === 'sent') {
      sentCardRef.current?.focus();
    }
  }, [state.kind]);

  async function send(values: { nome: string; email: string }) {
    setState({ kind: 'sending', values });
    try {
      const supabase = createSupabaseBrowserClient();
      const next = safeNext(defaultNext);
      const emailRedirectTo = `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo,
          data: { full_name: values.nome.trim() },
        },
      });
      if (error) throw error;
      setState({ kind: 'sent', email: values.email, cooldownLeft: COOLDOWN_SECONDS });
    } catch (err) {
      const msg =
        err instanceof Error && /rate limit|too many/i.test(err.message)
          ? 'Aguarda 60s pra pedir outro link.'
          : 'Não consegui enviar o link. Tenta de novo.';
      toast.error(msg);
      setState({ kind: 'idle', values, errors: {} });
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== 'idle') return;
    const parsed = loginSchema.safeParse(state.values);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setState({
        kind: 'idle',
        values: state.values,
        errors: {
          nome: fieldErrors.nome?.[0],
          email: fieldErrors.email?.[0],
        },
      });
      return;
    }
    send(parsed.data);
  }

  function handleResend() {
    if (state.kind !== 'sent' || state.cooldownLeft > 0) return;
    send({ nome: '', email: state.email });
  }

  if (state.kind === 'sent') {
    return (
      <div
        ref={sentCardRef}
        tabIndex={-1}
        className="bg-bg-elevated border-border space-y-4 rounded-lg border p-6 outline-none"
      >
        <p className="font-body text-text-primary text-sm">
          Link enviado pra <strong className="text-accent">{state.email}</strong>. Abre seu email e
          clica no link pra entrar.
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={state.cooldownLeft > 0}
          className="btn-sm w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.cooldownLeft > 0 ? `Reenviar (${state.cooldownLeft}s)` : 'Reenviar link'}
        </button>
      </div>
    );
  }

  const sending = state.kind === 'sending';

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor={nomeId} className="font-body text-text-secondary text-sm">
          Nome
        </label>
        <input
          id={nomeId}
          name="nome"
          type="text"
          autoComplete="name"
          aria-invalid={state.kind === 'idle' && !!state.errors.nome}
          aria-describedby={state.kind === 'idle' && state.errors.nome ? nomeErrorId : undefined}
          disabled={sending}
          value={state.values.nome}
          onChange={(e) =>
            setState({
              kind: 'idle',
              values: { ...state.values, nome: e.target.value },
              errors: state.kind === 'idle' ? { ...state.errors, nome: undefined } : {},
            })
          }
          className="bg-bg-dark border-border focus:border-accent focus:ring-accent w-full rounded-md border px-3 py-2 font-body text-sm outline-none focus:ring-1 disabled:opacity-50"
        />
        {state.kind === 'idle' && state.errors.nome ? (
          <p id={nomeErrorId} className="text-danger font-mono text-xs">
            {state.errors.nome}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor={emailId} className="font-body text-text-secondary text-sm">
          Email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={state.kind === 'idle' && !!state.errors.email}
          aria-describedby={state.kind === 'idle' && state.errors.email ? emailErrorId : undefined}
          disabled={sending}
          value={state.values.email}
          onChange={(e) =>
            setState({
              kind: 'idle',
              values: { ...state.values, email: e.target.value },
              errors: state.kind === 'idle' ? { ...state.errors, email: undefined } : {},
            })
          }
          className="bg-bg-dark border-border focus:border-accent focus:ring-accent w-full rounded-md border px-3 py-2 font-body text-sm outline-none focus:ring-1 disabled:opacity-50"
        />
        {state.kind === 'idle' && state.errors.email ? (
          <p id={emailErrorId} className="text-danger font-mono text-xs">
            {state.errors.email}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={sending}
        aria-busy={sending}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Enviando...
          </span>
        ) : (
          'Receber link'
        )}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: zero errors. (`@/lib/env`, `@/lib/supabase/browser`, `@/lib/validators/login`, `@/lib/validators/next` already exist; the previous tasks added `loginSchema` and `safeNext`.)

If you get an error like "`useEffect` dependency array has irregular literal" — that's an ESLint warning, not a typecheck error; ignore until Step 3.

- [ ] **Step 3: Verify lint**

Run: `pnpm lint`
Expected: zero warnings.

- [ ] **Step 4: Commit**

```bash
git add components/auth/LoginForm.tsx
git commit -m "feat(auth): add LoginForm with idle/sending/sent state machine"
```

---

## Task 7: `<LoginForm/>` smoke tests

**Goal:** Cobrir os 4 caminhos chave do `<LoginForm/>`: estado idle inicial, submit válido → sending → sent, submit com erro de rede → idle + toast, cooldown decrementando. Conforme spec §8.2.

**Files:**

- Create: `components/auth/LoginForm.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithOtpMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithOtp: signInWithOtpMock },
  }),
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock },
}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
  },
}));

import { LoginForm } from './LoginForm';

beforeEach(() => {
  signInWithOtpMock.mockReset();
  toastErrorMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('<LoginForm/>', () => {
  it('renderiza inputs e botão "Receber link" no estado inicial', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /receber link/i })).not.toBeDisabled();
  });

  it('mostra erros inline quando submete com inputs inválidos', () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'nao-eh-email' } });
    fireEvent.submit(screen.getByRole('button', { name: /receber link/i }).closest('form')!);
    expect(screen.getByText(/pelo menos 2 caracteres/i)).toBeInTheDocument();
    expect(screen.getByText(/email inválido/i)).toBeInTheDocument();
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  it('submit válido transiciona idle → sending → sent', async () => {
    signInWithOtpMock.mockResolvedValue({ error: null });
    render(<LoginForm defaultNext="/dashboard" />);

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Jonatas Pereira' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jonatas@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /receber link/i }).closest('form')!);

    // sending state: button disabled with "Enviando..."
    expect(await screen.findByText(/enviando/i)).toBeInTheDocument();

    // sent state: card shown with email
    await waitFor(() => {
      expect(screen.getByText(/link enviado pra/i)).toBeInTheDocument();
    });
    expect(screen.getByText('jonatas@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reenviar \(60s\)/i })).toBeDisabled();

    // verify the supabase call had the right shape
    expect(signInWithOtpMock).toHaveBeenCalledTimes(1);
    const arg = signInWithOtpMock.mock.calls[0]![0];
    expect(arg.email).toBe('jonatas@example.com');
    expect(arg.options.data).toEqual({ full_name: 'Jonatas Pereira' });
    expect(arg.options.emailRedirectTo).toBe(
      'http://localhost:3000/auth/callback?next=%2Fdashboard',
    );
  });

  it('volta a idle e dispara toast.error quando signInWithOtp rejeita', async () => {
    signInWithOtpMock.mockRejectedValue(new Error('network down'));
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Jonatas' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jonatas@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /receber link/i }).closest('form')!);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringMatching(/não consegui enviar o link/i),
      );
    });
    expect(screen.getByRole('button', { name: /receber link/i })).not.toBeDisabled();
    expect(screen.queryByText(/link enviado/i)).not.toBeInTheDocument();
  });

  it('cooldown decrementa e desbloqueia "Reenviar" em 60s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signInWithOtpMock.mockResolvedValue({ error: null });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Jonatas' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jonatas@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /receber link/i }).closest('form')!);

    await waitFor(() => screen.getByText(/link enviado pra/i));
    expect(screen.getByRole('button', { name: /reenviar \(60s\)/i })).toBeDisabled();

    // Advance 30s
    await vi.advanceTimersByTimeAsync(30_000);
    expect(screen.getByRole('button', { name: /reenviar \(30s\)/i })).toBeDisabled();

    // Advance to 0
    await vi.advanceTimersByTimeAsync(30_000);
    expect(screen.getByRole('button', { name: /^reenviar link$/i })).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test and confirm it passes**

Run: `pnpm vitest run components/auth/LoginForm.test.tsx`
Expected: all 5 tests pass.

If a test fails:

- "Unable to find label /nome/i" → confirm the LoginForm uses `htmlFor`/`id` on the label (the `useId` hook should still produce stable ids for RTL to match by accessible name).
- Mock `vi.mock` not picking up → confirm the `vi.mock` calls are at the top of the file (hoisted before imports). The pattern `vi.mock(...) ; import { LoginForm } from ...` is correct.
- Cooldown timer not advancing → ensure `vi.useFakeTimers({ shouldAdvanceTime: true })` is set BEFORE the form render in the test, and `vi.advanceTimersByTimeAsync` (not the sync version) is used to flush React updates.

Do not weaken the test.

- [ ] **Step 3: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 4: Commit**

```bash
git add components/auth/LoginForm.test.tsx
git commit -m "test(auth): add smoke tests for LoginForm state machine"
```

---

## Task 8: `app/(auth)/login/page.tsx` (Server shell + smoke test)

**Goal:** Substituir o placeholder do `/login` por um Server Component que lê `?next=` e `?error=` do `searchParams` e renderiza `<LoginForm/>` dentro de um card. Mostra banner vermelho quando `error=link-invalido`. Conforme spec §5.2 e §7.1.

**Files:**

- Modify: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/login/page.test.tsx`

- [ ] **Step 1: Replace `app/(auth)/login/page.tsx` with the real shell**

```tsx
import { LoginForm } from '@/components/auth/LoginForm';

type Search = { next?: string; error?: string };

export default function LoginPage({ searchParams }: { searchParams: Search }) {
  const showError = searchParams.error === 'link-invalido';
  return (
    <section className="border-border bg-bg-card rounded-lg border p-8">
      <h1 className="font-display text-3xl tracking-wide">Entrar</h1>
      <p className="font-body text-text-secondary mt-2 mb-6 text-sm">
        Digita seu nome e email. A gente manda um link mágico.
      </p>
      {showError ? (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger mb-4 rounded-md border px-3 py-2 font-mono text-xs"
        >
          Esse link expirou ou já foi usado. Pede um novo abaixo.
        </div>
      ) : null}
      <LoginForm defaultNext={searchParams.next} />
    </section>
  );
}
```

- [ ] **Step 2: Create the smoke test `app/(auth)/login/page.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// LoginForm uses Supabase + env; in the page smoke test we don't exercise it,
// but we still need imports not to throw.
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOtp: vi.fn() } }),
}));
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
  },
}));

import LoginPage from './page';

describe('LoginPage', () => {
  it('renderiza h1 "Entrar" e os 2 inputs do form', () => {
    render(<LoginPage searchParams={{}} />);
    expect(screen.getByRole('heading', { level: 1, name: /entrar/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /receber link/i })).toBeInTheDocument();
  });

  it('NÃO mostra banner de erro quando searchParams.error está ausente', () => {
    render(<LoginPage searchParams={{}} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mostra banner de erro quando searchParams.error === "link-invalido"', () => {
    render(<LoginPage searchParams={{ error: 'link-invalido' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/link expirou ou já foi usado/i);
  });
});
```

- [ ] **Step 3: Run the test and confirm it passes**

Run: `pnpm vitest run app/\(auth\)/login/page.test.tsx`

> On Windows PowerShell, escape with quotes: `pnpm vitest run 'app/(auth)/login/page.test.tsx'`.

Expected: all 3 tests pass.

- [ ] **Step 4: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/login/page.tsx app/\(auth\)/login/page.test.tsx
git commit -m "feat(auth): wire /login Server shell with error banner + smoke test"
```

---

## Task 9: `app/(auth)/auth/callback/route.ts` (real exchange)

**Goal:** Substituir o handler 501 placeholder pela troca real do `code` por sessão e redirect pra `next` validado. Em erro, redireciona pra `/login?error=link-invalido`. Conforme spec §4.1 e §7.1.

**Files:**

- Modify: `app/(auth)/auth/callback/route.ts`

- [ ] **Step 1: Replace the route file contents**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/validators/next';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (!code || searchParams.has('error')) {
    return NextResponse.redirect(`${origin}/login?error=link-invalido`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=link-invalido`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: zero errors. (`createSupabaseServerClient` and `safeNext` are imported from previously-existing/created modules.)

- [ ] **Step 3: Verify lint**

Run: `pnpm lint`
Expected: zero warnings.

- [ ] **Step 4: Verify build still passes**

Run: `pnpm build`
Expected: build succeeds. The route is now part of the output as a dynamic Route Handler.

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/auth/callback/route.ts
git commit -m "feat(auth): wire /auth/callback to exchange code + redirect to safe next"
```

---

## Task 10: Middleware — extend `lib/supabase/middleware.ts` + redirect logic in `middleware.ts`

**Goal:** (a) `updateSupabaseSession` retorna `{ response, user }` em vez de só `response`. (b) `middleware.ts` usa esse retorno pra redirecionar anon em rotas protegidas e logado em `/login`. Conforme spec §4.2 e §5.3.

**Files:**

- Modify: `lib/supabase/middleware.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: Replace `lib/supabase/middleware.ts`**

```ts
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

type CookieToSet = Parameters<SetAllCookies>[0][number];

export async function updateSupabaseSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: CookieToSet[]) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida o JWT no servidor (vs getSession que só lê cookie).
  // Erros de rede / Auth indisponível não devem 500 a request: deixa
  // passar com user=null e cookies não-renovados; o middleware decide se
  // redireciona pra /login (rotas protegidas) ou segue (rotas públicas).
  let user: User | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // transient — segue com user=null
  }

  return { response, user };
}
```

- [ ] **Step 2: Replace `middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

const PROTECTED = /^\/(dashboard|admin|palpites|ranking)(\/|$)/;

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);
  const path = request.nextUrl.pathname;

  if (PROTECTED.test(path) && !user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (path === '/login' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: zero errors.

- [ ] **Step 4: Verify lint**

Run: `pnpm lint`
Expected: zero warnings.

- [ ] **Step 5: Smoke check that the build still works**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add middleware.ts lib/supabase/middleware.ts
git commit -m "feat(auth): middleware redirects anon→login + logado→dashboard"
```

---

## Task 11: `(admin)/layout.tsx` — auth guard básico

**Goal:** Adicionar guard server-side que redireciona anon pra `/login?next=/admin`. Mantém o aviso "guard de is_admin entra na Feature 9". Conforme spec §5.3.

**Files:**

- Modify: `app/(admin)/layout.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Guard de auth (F4). Guard de is_admin entra na F9.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border bg-bg-elevated border-b px-6 py-4">
        <span className="font-display text-danger text-xl tracking-wide">ADMIN</span>
        <span className="text-text-muted ml-2 font-mono text-xs">
          (guard de is_admin entra na Feature 9)
        </span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/layout.tsx
git commit -m "feat(admin): add auth guard to (admin) layout (is_admin still in F9)"
```

---

## Task 12: `<UserBadge/>` component (Server)

**Goal:** Pílula com avatar circular + nome + handle do email. Conforme spec §5.2.

**Files:**

- Create: `components/dashboard/UserBadge.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import { iniciais } from '@/lib/format/iniciais';

export type UserBadgeProps = {
  nome: string;
  email: string;
};

export function UserBadge({ nome, email }: UserBadgeProps) {
  const handle = email.split('@')[0]?.toLowerCase() ?? 'apostador';
  const nomeExibido = nome.trim() || 'Apostador';
  return (
    <div className="bg-bg-card border-border flex items-center gap-2.5 rounded-full border px-3.5 py-2">
      <div
        aria-hidden="true"
        className="text-bg-dark flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-[13px] font-extrabold"
      >
        {iniciais(nomeExibido)}
      </div>
      <div className="text-[13px] leading-tight">
        <div className="font-semibold">{nomeExibido}</div>
        <div className="text-text-muted font-mono text-[11px]">@{handle} · 0 tabelas</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/UserBadge.tsx
git commit -m "feat(dashboard): add UserBadge with avatar initials + handle"
```

---

## Task 13: `<DashboardHeader/>` component (Server)

**Goal:** Greeting "Salve, {primeiroNome} 👋" + subtitle (texto fixo F4) + `<UserBadge/>`. Conforme spec §5.2.

**Files:**

- Create: `components/dashboard/DashboardHeader.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import { UserBadge } from '@/components/dashboard/UserBadge';

export type DashboardHeaderProps = {
  nome: string;
  email: string;
};

function primeiroNome(nome: string): string {
  const trimmed = nome.trim();
  if (!trimmed) return 'Apostador';
  return trimmed.split(/\s+/)[0]!;
}

export function DashboardHeader({ nome, email }: DashboardHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-[38px] leading-none tracking-wide">
          Salve, <span className="text-accent">{primeiroNome(nome)}</span> 👋
        </h1>
        <p className="font-body text-text-secondary mt-2 text-sm">
          Sua primeira tabela ainda não está no jogo. Disponível em breve.
        </p>
      </div>
      <UserBadge nome={nome} email={email} />
    </header>
  );
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/DashboardHeader.tsx
git commit -m "feat(dashboard): add DashboardHeader with greeting + UserBadge"
```

---

## Task 14: `<JogoRow/>` component (Server)

**Goal:** Uma linha do painel "Próximos jogos" com data formatada + casa + `×` + fora + CTA "Palpitar". TBD vs TBD desabilita o CTA. Conforme spec §5.2.

**Files:**

- Create: `components/dashboard/JogoRow.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import Link from 'next/link';
import { formatDataRelativa } from '@/lib/format/data-relativa';
import type { Database } from '@/lib/supabase/types';

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
  agora?: Date; // override pra testes; default = new Date()
};

const FASE_LABEL: Record<FaseEnum, string> = {
  grupos: 'Grupos',
  '16avos': '16-avos',
  oitavas: 'Oitavas',
  quartas: 'Quartas',
  semis: 'Semis',
  disputa_terceiro: 'Disputa de 3º',
  final: 'Final',
};

export function JogoRow({ jogo, agora = new Date() }: JogoRowProps) {
  const { date, hour } = formatDataRelativa({ data: new Date(jogo.data_hora), agora });
  const tbd = !jogo.casa || !jogo.fora;

  return (
    <li className="border-border grid grid-cols-1 items-center gap-3 border-b px-6 py-5 text-center last:border-b-0 md:grid-cols-[120px_1fr_auto_1fr_120px] md:text-left">
      <div className="font-mono text-xs">
        <div className="text-text-primary font-semibold">{date}</div>
        <div className="text-text-muted">{hour}</div>
      </div>

      <div className="flex items-center justify-center gap-3 font-semibold md:justify-start">
        {jogo.casa ? (
          <>
            <span aria-hidden="true" className="text-[28px] leading-none">
              {jogo.casa.bandeira_emoji}
            </span>
            <span>{jogo.casa.nome}</span>
          </>
        ) : (
          <span className="text-text-muted text-sm font-mono">{jogo.placeholder_casa ?? 'TBD'}</span>
        )}
      </div>

      <div className="text-text-muted text-base">×</div>

      <div className="flex items-center justify-center gap-3 font-semibold md:justify-end md:text-right">
        {jogo.fora ? (
          <>
            <span>{jogo.fora.nome}</span>
            <span aria-hidden="true" className="text-[28px] leading-none">
              {jogo.fora.bandeira_emoji}
            </span>
          </>
        ) : (
          <span className="text-text-muted text-sm font-mono">{jogo.placeholder_fora ?? 'TBD'}</span>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 md:justify-end">
        {tbd ? (
          <span
            aria-disabled="true"
            title="Aguarde os times serem definidos"
            className="btn-sm pointer-events-none cursor-not-allowed opacity-50"
          >
            Palpitar
          </span>
        ) : (
          <Link href={`/palpites/${jogo.id}`} className="btn-sm">
            Palpitar
          </Link>
        )}
        <span className="text-text-muted hidden font-mono text-[10px] uppercase tracking-wider md:inline">
          {FASE_LABEL[jogo.fase]}
        </span>
      </div>
    </li>
  );
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/JogoRow.tsx
git commit -m "feat(dashboard): add JogoRow with TBD support and Palpitar CTA"
```

---

## Task 15: `<ProximosJogosPanel/>` component + smoke test

**Goal:** Painel com pulse-dot animado + título + lista de `<JogoRow/>` ou empty state. Conforme spec §5.2 e §8.2.

**Files:**

- Create: `components/dashboard/ProximosJogosPanel.tsx`
- Create: `components/dashboard/ProximosJogosPanel.test.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import { JogoRow, type JogoRowData } from '@/components/dashboard/JogoRow';

export type ProximosJogosPanelProps = {
  jogos: JogoRowData[];
  errored?: boolean;
  agora?: Date;
};

export function ProximosJogosPanel({ jogos, errored = false, agora }: ProximosJogosPanelProps) {
  return (
    <section className="panel">
      <header className="panel-header">
        <div className="flex items-center gap-2.5 text-base font-bold">
          <span
            aria-hidden="true"
            className="bg-success size-2 animate-pulse-dot rounded-full"
          />
          Próximos jogos · Copa 2026
        </div>
      </header>
      {errored ? (
        <div className="text-text-muted px-6 py-12 text-center">
          <p className="font-body text-sm">
            Não foi possível carregar os próximos jogos. Tenta atualizar a página.
          </p>
        </div>
      ) : jogos.length === 0 ? (
        <div className="text-text-muted px-6 py-12 text-center">
          <p className="font-display text-2xl">A Copa acabou. Bola pra frente. ⚽</p>
        </div>
      ) : (
        <ul>
          {jogos.map((jogo) => (
            <JogoRow key={jogo.id} jogo={jogo} agora={agora} />
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Create the smoke test**

```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProximosJogosPanel } from './ProximosJogosPanel';
import type { JogoRowData } from './JogoRow';

const AGORA = new Date('2026-06-14T10:00:00-03:00');

const jogo = (overrides: Partial<JogoRowData> = {}): JogoRowData => ({
  id: 1,
  data_hora: '2026-06-14T16:00:00-03:00',
  fase: 'grupos',
  placeholder_casa: null,
  placeholder_fora: null,
  casa: { nome: 'Brasil', bandeira_emoji: '🇧🇷' },
  fora: { nome: 'Sérvia', bandeira_emoji: '🇷🇸' },
  ...overrides,
});

describe('<ProximosJogosPanel/>', () => {
  it('renderiza n linhas a partir do array de jogos', () => {
    render(
      <ProximosJogosPanel
        agora={AGORA}
        jogos={[jogo({ id: 1 }), jogo({ id: 2 }), jogo({ id: 3 })]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('jogo definido renderiza link "Palpitar" pra /palpites/{id}', () => {
    render(<ProximosJogosPanel agora={AGORA} jogos={[jogo({ id: 42 })]} />);
    const link = screen.getByRole('link', { name: /palpitar/i });
    expect(link).toHaveAttribute('href', '/palpites/42');
  });

  it('jogo TBD (sem seleção) desabilita o CTA', () => {
    render(
      <ProximosJogosPanel
        agora={AGORA}
        jogos={[
          jogo({
            id: 99,
            casa: null,
            fora: null,
            placeholder_casa: 'Vencedor jogo 80',
            placeholder_fora: 'Vencedor jogo 81',
            fase: 'oitavas',
          }),
        ]}
      />,
    );
    expect(screen.queryByRole('link', { name: /palpitar/i })).not.toBeInTheDocument();
    expect(
      screen.getByText('Palpitar', { selector: '[aria-disabled="true"]' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Vencedor jogo 80/)).toBeInTheDocument();
  });

  it('lista vazia renderiza empty state "A Copa acabou"', () => {
    render(<ProximosJogosPanel agora={AGORA} jogos={[]} />);
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.getByText(/A Copa acabou/i)).toBeInTheDocument();
  });

  it('errored renderiza fallback de erro mesmo com jogos no array', () => {
    render(
      <ProximosJogosPanel agora={AGORA} jogos={[jogo({ id: 1 })]} errored />,
    );
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.getByText(/Não foi possível carregar/i)).toBeInTheDocument();
  });

  it('mostra label da fase em desktop apenas (a classe md:inline cobre isso; markup contém o texto)', () => {
    render(
      <ProximosJogosPanel
        agora={AGORA}
        jogos={[jogo({ id: 1, fase: 'final' })]}
      />,
    );
    const item = screen.getByRole('listitem');
    expect(within(item).getByText(/^final$/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test and confirm it passes**

Run: `pnpm vitest run components/dashboard/ProximosJogosPanel.test.tsx`
Expected: all 6 tests pass.

If "Palpitar" element fails to be found in the disabled case: confirm `<JogoRow/>` renders `<span aria-disabled="true">Palpitar</span>` (not as a `<button>` with `disabled` attribute, which would change the accessibility tree).

- [ ] **Step 4: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ProximosJogosPanel.tsx components/dashboard/ProximosJogosPanel.test.tsx
git commit -m "feat(dashboard): add ProximosJogosPanel with empty/errored/TBD states + tests"
```

---

## Task 16: `<DashboardNav/>` component + smoke test

**Goal:** Lista de nav (sidebar fixa desktop, conteúdo do drawer mobile) com 7 itens (1 ativo + 6 disabled "em breve") + botão "Sair" no rodapé que chama `signOut`. Conforme spec §5.2 e §8.2.

**Files:**

- Create: `components/dashboard/DashboardNav.tsx`
- Create: `components/dashboard/DashboardNav.test.tsx`

- [ ] **Step 1: Create the component file**

```tsx
'use client';

import {
  Award,
  DollarSign,
  Home,
  LogOut,
  Settings,
  Target,
  Ticket,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type NavLink = {
  label: string;
  icon: LucideIcon;
  href?: string;
  disabledHint?: string;
};

const PRINCIPAL: NavLink[] = [
  { label: 'Dashboard', icon: Home, href: '/dashboard' },
  { label: 'Meus Palpites', icon: Trophy, disabledHint: 'Em breve (F7)' },
  { label: 'Ranking', icon: Award, disabledHint: 'Em breve (F8)' },
  { label: 'Bônus', icon: Target, disabledHint: 'Em breve (F7)' },
];

const CONTA: NavLink[] = [
  { label: 'Minhas Tabelas', icon: Ticket, disabledHint: 'Em breve (F6)' },
  { label: 'Cashback', icon: DollarSign, disabledHint: 'Em breve (F11)' },
  { label: 'Configurações', icon: Settings, disabledHint: 'Em breve' },
];

export type DashboardNavProps = {
  className?: string;
  onItemClick?: () => void;
};

export function DashboardNav({ className, onItemClick }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Não consegui deslogar. Tenta de novo.');
      return;
    }
    onItemClick?.();
    router.push('/login');
    router.refresh();
  }

  return (
    <nav
      aria-label="Navegação do painel"
      className={cn('bg-bg-card border-border flex h-full flex-col border-r p-6', className)}
    >
      <div className="font-display mb-8 flex items-center gap-2.5 px-2 text-2xl tracking-[2px]">
        <span
          aria-hidden="true"
          className="bg-accent text-bg-dark flex h-9 w-9 -rotate-[5deg] items-center justify-center rounded-lg text-xl font-black"
        >
          B
        </span>
        <span>
          BOLÃO<span className="text-accent">26</span>
        </span>
      </div>

      <Section label="Principal">
        {PRINCIPAL.map((item) => (
          <NavItem key={item.label} item={item} pathname={pathname} onClick={onItemClick} />
        ))}
      </Section>

      <Section label="Conta">
        {CONTA.map((item) => (
          <NavItem key={item.label} item={item} pathname={pathname} onClick={onItemClick} />
        ))}
      </Section>

      <button type="button" onClick={handleSignOut} className="sign-out-btn">
        <LogOut className="size-4" aria-hidden="true" /> Sair
      </button>
    </nav>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-text-muted mb-2 px-3 font-mono text-[10px] tracking-wider uppercase">
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NavItem({
  item,
  pathname,
  onClick,
}: {
  item: NavLink;
  pathname: string;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  if (!item.href) {
    return (
      <span
        aria-disabled="true"
        title={item.disabledHint}
        className="sidebar-item sidebar-item-disabled"
      >
        <Icon className="size-4" aria-hidden="true" /> {item.label}
      </span>
    );
  }
  const active = pathname === item.href;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn('sidebar-item', active && 'sidebar-item-active')}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="size-4" aria-hidden="true" /> {item.label}
    </Link>
  );
}
```

- [ ] **Step 2: Create the smoke test**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const usePathnameMock = vi.fn();
const pushMock = vi.fn();
const refreshMock = vi.fn();
const signOutMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signOut: signOutMock } }),
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock },
}));

import { DashboardNav } from './DashboardNav';

beforeEach(() => {
  usePathnameMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();
  signOutMock.mockReset();
  toastErrorMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('<DashboardNav/>', () => {
  it('renderiza 7 itens — só "Dashboard" como link real, 6 disabled', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    render(<DashboardNav />);
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');

    const disabledLabels = ['Meus Palpites', 'Ranking', 'Bônus', 'Minhas Tabelas', 'Cashback', 'Configurações'];
    for (const label of disabledLabels) {
      const span = screen.getByText(new RegExp(`^\\s*${label}\\s*$`));
      const wrapper = span.closest('[aria-disabled="true"]');
      expect(wrapper).not.toBeNull();
    }
  });

  it('"Sair" aparece no rodapé', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    render(<DashboardNav />);
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });

  it('Dashboard ativo via aria-current="page" quando pathname casa', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    render(<DashboardNav />);
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('aria-current', 'page');
  });

  it('clicar em "Sair" chama signOut + router.push("/login") + refresh + onItemClick', async () => {
    usePathnameMock.mockReturnValue('/dashboard');
    signOutMock.mockResolvedValue({ error: null });
    const onItemClick = vi.fn();
    render(<DashboardNav onItemClick={onItemClick} />);

    fireEvent.click(screen.getByRole('button', { name: /sair/i }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith('/login');
      expect(refreshMock).toHaveBeenCalledTimes(1);
      expect(onItemClick).toHaveBeenCalledTimes(1);
    });
  });

  it('signOut error → toast.error e NÃO redireciona', async () => {
    usePathnameMock.mockReturnValue('/dashboard');
    signOutMock.mockResolvedValue({ error: new Error('boom') });
    render(<DashboardNav />);

    fireEvent.click(screen.getByRole('button', { name: /sair/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(expect.stringMatching(/não consegui deslogar/i));
    });
    expect(pushMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test and confirm it passes**

Run: `pnpm vitest run components/dashboard/DashboardNav.test.tsx`
Expected: all 5 tests pass.

If a disabled item lookup fails: the test uses `text → closest('[aria-disabled="true"]')`. Confirm the disabled `<span>` has the text node directly as a child (the implementation has `<Icon/> Label` — the text is a sibling of the icon, but they share the same `<span>` parent).

- [ ] **Step 4: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/DashboardNav.tsx components/dashboard/DashboardNav.test.tsx
git commit -m "feat(dashboard): add DashboardNav with 7 items + signOut + tests"
```

---

## Task 17: `<DashboardTopbarMobile/>` component (Client)

**Goal:** Topbar fixa mobile (logo + hamburger) que abre drawer Radix Dialog renderizando o `<DashboardNav/>` em modo drawer. Conforme spec §5.2.

**Files:**

- Create: `components/dashboard/DashboardTopbarMobile.tsx`

- [ ] **Step 1: Create the component file**

```tsx
'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { DashboardNav } from '@/components/dashboard/DashboardNav';

export function DashboardTopbarMobile() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <header className="bg-bg-dark/95 border-border fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b px-4 backdrop-blur-md md:hidden">
        <span className="font-display flex items-center gap-2 text-xl tracking-[2px]">
          <span
            aria-hidden="true"
            className="bg-accent text-bg-dark flex h-7 w-7 -rotate-[5deg] items-center justify-center rounded-md text-base font-black"
          >
            B
          </span>
          <span>
            BOLÃO<span className="text-accent">26</span>
          </span>
        </span>
        <Dialog.Trigger asChild>
          <button
            type="button"
            aria-label="Abrir menu"
            className="hover:bg-bg-elevated rounded-lg p-2"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </Dialog.Trigger>
      </header>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 md:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 outline-none md:hidden">
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <Dialog.Description className="sr-only">
            Navegação do painel do apostador
          </Dialog.Description>
          <DashboardNav onItemClick={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/DashboardTopbarMobile.tsx
git commit -m "feat(dashboard): add DashboardTopbarMobile with hamburger drawer"
```

---

## Task 18: `<DashboardShell/>` component (Server)

**Goal:** Orquestra layout grid (240px sidebar | main no desktop, single column no mobile) com topbar mobile, sidebar desktop, header e área de children. Conforme spec §5.2.

**Files:**

- Create: `components/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { DashboardTopbarMobile } from '@/components/dashboard/DashboardTopbarMobile';

export type DashboardShellProps = {
  nome: string;
  email: string;
  children: React.ReactNode;
};

export function DashboardShell({ nome, email, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <DashboardTopbarMobile />
      <DashboardNav className="hidden md:flex" />
      <div className="flex flex-col">
        <main className="flex-1 px-5 pt-20 pb-10 md:p-8 md:pt-8">
          <DashboardHeader nome={nome} email={email} />
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: zero errors, zero warnings.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/DashboardShell.tsx
git commit -m "feat(dashboard): add DashboardShell orchestrating topbar/nav/header/main"
```

---

## Task 19: `app/(dashboard)/layout.tsx` (real)

**Goal:** Substituir o aside placeholder por: guard de auth + fetch do profile do user logado + render do `<DashboardShell/>`. Conforme spec §4.3 e §5.3.

**Files:**

- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, email')
    .eq('id', user.id)
    .single();

  if (!profile?.nome) {
    console.warn(
      '[dashboard/layout] profile.nome vazio para user',
      user.id,
      '— exibindo fallback "Apostador"',
    );
  }

  return (
    <DashboardShell nome={profile?.nome ?? ''} email={user.email!}>
      {children}
    </DashboardShell>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: zero errors. (`from('profiles').select('nome, email').eq('id', ...).single()` typing comes from `Database` in `lib/supabase/types.ts`.)

- [ ] **Step 3: Verify lint**

Run: `pnpm lint`
Expected: zero warnings.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/layout.tsx
git commit -m "feat(dashboard): wire layout with auth guard + profile fetch + shell"
```

---

## Task 20: `app/(dashboard)/dashboard/page.tsx` (real)

**Goal:** Substituir o placeholder por Server Component que busca os 5 próximos jogos da Copa e renderiza `<ProximosJogosPanel/>`. Conforme spec §4.3 e §5.2.

**Files:**

- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { ProximosJogosPanel } from '@/components/dashboard/ProximosJogosPanel';
import type { JogoRowData } from '@/components/dashboard/JogoRow';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const agora = new Date().toISOString();

  const { data, error } = await supabase
    .from('jogos')
    .select(
      `
        id, data_hora, fase, placeholder_casa, placeholder_fora,
        casa:selecoes!selecao_casa_id(nome, bandeira_emoji),
        fora:selecoes!selecao_fora_id(nome, bandeira_emoji)
      `,
    )
    .gt('data_hora', agora)
    .order('data_hora', { ascending: true })
    .limit(5);

  if (error) {
    return <ProximosJogosPanel jogos={[]} errored />;
  }

  // Supabase tipa os related selects como possivelmente arrays mesmo em FK 1:1.
  // Normalizamos pro shape esperado pelo JogoRow.
  const jogos: JogoRowData[] = (data ?? []).map((j) => ({
    id: j.id,
    data_hora: j.data_hora,
    fase: j.fase,
    placeholder_casa: j.placeholder_casa,
    placeholder_fora: j.placeholder_fora,
    casa: Array.isArray(j.casa) ? (j.casa[0] ?? null) : j.casa,
    fora: Array.isArray(j.fora) ? (j.fora[0] ?? null) : j.fora,
  }));

  return <ProximosJogosPanel jogos={jogos} />;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: zero errors.

If you get "Property 'casa' does not exist on type ..." or similar mismatch between the join shape and `JogoRowData`: confirm the `Array.isArray` normalization is in place. The Supabase JS client typing for nested selects sometimes returns `T | T[]` depending on FK cardinality.

- [ ] **Step 3: Verify lint**

Run: `pnpm lint`
Expected: zero warnings.

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: succeeds. The `/dashboard` route appears as **dynamic** (ƒ) because of `force-dynamic` and the per-request `getUser`.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(dashboard): wire /dashboard with próximos jogos query + panel"
```

---

## Task 21: Final verification

**Goal:** Validar todos os critérios de pronto do spec §10 antes de mergear: build, typecheck, lint, format, todos os tests, e dois smokes manuais (auth flow real + redirects do middleware) em duas viewports.

**Files:** none (verification only)

- [ ] **Step 1: Run the full quality gate suite**

Run: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:run && pnpm build`

Expected:

- `typecheck`: zero errors
- `lint`: zero warnings
- `format:check`: passes (se reclamar, rode `pnpm format` e commite o ajuste como `chore: apply prettier formatting`)
- `test:run`: pelo menos **8 arquivos de teste** passando:
  - `lib/__tests__/utils.test.ts` (existente)
  - `app/(public)/page.test.tsx` (F3)
  - `lib/__tests__/iniciais.test.ts` (T2)
  - `lib/__tests__/data-relativa.test.ts` (T3)
  - `lib/__tests__/login-validator.test.ts` (T4)
  - `lib/__tests__/next-validator.test.ts` (T5)
  - `components/auth/LoginForm.test.tsx` (T7)
  - `app/(auth)/login/page.test.tsx` (T8)
  - `components/dashboard/ProximosJogosPanel.test.tsx` (T15)
  - `components/dashboard/DashboardNav.test.tsx` (T16)
  - Total: **10 arquivos**, com pelo menos 40 testes passando
- `build`: completes; `/login`, `/auth/callback`, `/dashboard`, `/admin` aparecem como rotas dynamic (ƒ).

- [ ] **Step 2: Manual smoke — auth flow real (Supabase Cloud dev)**

Run (separate terminal): `pnpm dev`

In Chrome, open `http://localhost:3000`:

1. Click "Entrar" no header da landing → vai pra `/login`.
2. No `/login`: digita um nome (ex: "Jonatas Pereira") e um email **real seu** (ex: `seuemail@gmail.com`).
3. Click "Receber link". Form deve transicionar pra estado "Link enviado pra **{email}**" com botão "Reenviar (60s)" disabled.
4. Abre seu inbox, espera o email do Supabase. **No mesmo navegador**, click no link "Confirmar". Você deve cair em `/auth/callback?...` brevemente e ser redirecionado pra `/dashboard`.
5. No `/dashboard`:
   - Header mostra "Salve, **Jonatas** 👋" + subtitle.
   - User-badge (canto superior direito) mostra "JP" no avatar, "Jonatas Pereira" e "@seuemail · 0 tabelas".
   - Sidebar à esquerda (>768px) com 7 itens; só "Dashboard" amarelo. Os outros cinza claro.
   - Painel "Próximos jogos · Copa 2026" com 5 jogos. Cada linha tem CTA "Palpitar".
6. Click em "Palpitar" de qualquer linha → cai em `app/not-found.tsx` (a 404 amarela com "Voltar pra home"). Esperado — `/palpites/[id]` é F7.
7. Click em algum item disabled da sidebar (ex: "Ranking") → nada acontece (sem href).
8. Click em "Sair" no rodapé da sidebar → volta pra `/login`. Sessão limpa.

- [ ] **Step 3: Manual smoke — redirects do middleware**

Ainda com `pnpm dev` rodando, em uma **janela anônima** (sem cookie):

1. Abre `http://localhost:3000/dashboard` → redireciona pra `http://localhost:3000/login?next=%2Fdashboard`.
2. Abre `http://localhost:3000/admin` → redireciona pra `http://localhost:3000/login?next=%2Fadmin`.
3. Abre `http://localhost:3000/palpites/123` → redireciona pra `http://localhost:3000/login?next=%2Fpalpites%2F123`.
4. Abre `http://localhost:3000/ranking` → redireciona pra `http://localhost:3000/login?next=%2Franking`.
5. Volta pra janela normal (logada do Step 2). Tenta abrir `http://localhost:3000/login` → redireciona pra `/dashboard`.
6. Tenta um `next` malicioso: na janela anônima, abre `http://localhost:3000/login?next=//evil.com`. Faz o login. O callback deve redirecionar pra `/dashboard` (não pra `evil.com`).

- [ ] **Step 4: Manual viewport check — desktop 1280px**

Abre Chrome DevTools, viewport 1280×800.

- `/dashboard`: sidebar fixa à esquerda (240px); main com header (greeting + user-badge à direita) + painel de jogos abaixo.
- Topbar mobile **NÃO** aparece.
- Sidebar tem todas as 7 entradas + "Sair" no rodapé.

- [ ] **Step 5: Manual viewport check — mobile 390px**

Mesma DevTools, viewport 390×844 (iPhone 14).

- `/dashboard`: topbar fixa no topo (logo BOLÃO26 + hamburger).
- Sidebar **NÃO** aparece.
- Click no hamburger → drawer slides da esquerda; mostra os mesmos 7 itens + "Sair".
- Click no "Sair" do drawer → drawer fecha + redireciona pra `/login`.
- Reabre o drawer, click fora ou pressiona Esc → drawer fecha.

- [ ] **Step 6: Final commit cleanup (only if needed)**

If `pnpm format` made changes in Step 1, stage and commit them:

```bash
git status
# se files foram modificados pela formatação:
git add -u
git commit -m "chore: apply prettier formatting"
```

Stop `pnpm dev` (`Ctrl+C`).

- [ ] **Step 7: Confirm clean tree**

Run: `git status`
Expected: `nothing to commit, working tree clean`

Run: `git log --oneline -25`
Expected (mais recente primeiro):

```
<hash> chore: apply prettier formatting          # opcional
<hash> feat(dashboard): wire /dashboard with próximos jogos query + panel
<hash> feat(dashboard): wire layout with auth guard + profile fetch + shell
<hash> feat(dashboard): add DashboardShell orchestrating topbar/nav/header/main
<hash> feat(dashboard): add DashboardTopbarMobile with hamburger drawer
<hash> feat(dashboard): add DashboardNav with 7 items + signOut + tests
<hash> feat(dashboard): add ProximosJogosPanel with empty/errored/TBD states + tests
<hash> feat(dashboard): add JogoRow with TBD support and Palpitar CTA
<hash> feat(dashboard): add DashboardHeader with greeting + UserBadge
<hash> feat(dashboard): add UserBadge with avatar initials + handle
<hash> feat(admin): add auth guard to (admin) layout (is_admin still in F9)
<hash> feat(auth): middleware redirects anon→login + logado→dashboard
<hash> feat(auth): wire /auth/callback to exchange code + redirect to safe next
<hash> feat(auth): wire /login Server shell with error banner + smoke test
<hash> test(auth): add smoke tests for LoginForm state machine
<hash> feat(auth): add LoginForm with idle/sending/sent state machine
<hash> feat(validators): add safeNext to prevent open-redirect via ?next= param
<hash> feat(validators): add Zod loginSchema with trim/lowercase + pt-BR errors
<hash> feat(format): add formatDataRelativa with Brasília TZ
<hash> feat(format): add iniciais helper with full unit coverage
<hash> feat(auth-dashboard): add Tailwind utilities for sidebar, panel, sign-out, btn-sm
f0854f2 docs: self-review fixes for feature 4 spec
df69a9e docs: add design spec for feature 4 (auth + dashboard)
... (older commits)
```

20 commits temáticos implementando a feature, sentados em cima dos 2 commits do spec. Pronto para review/merge.

---

## Done criteria recap (do spec §10)

- [x] `signInWithOtp` envia email com `emailRedirectTo` correto e metadata `full_name` (T6, T7)
- [x] Trigger `handle_new_user` cria row em `profiles` com `nome` (validado em smoke manual T21 Step 2)
- [x] `/auth/callback` faz exchange + redireciona pra `next` validado (T9)
- [x] Middleware redireciona conforme política (T10, smoke T21 Step 3)
- [x] `/login` mostra banner de erro com `?error=link-invalido` (T8)
- [x] `<LoginForm/>` cobre idle/sending/sent + cooldown 60s (T6, T7)
- [x] `/dashboard` mostra greeting + UserBadge + painel próximos jogos (T19, T20, smoke T21 Step 2)
- [x] Painel mostra top 5 ou empty state (T15, T20)
- [x] Sidebar fixa em ≥md, drawer em <md (T16, T17, T18, smoke T21 Step 5)
- [x] 6 itens disabled, sem href, com `aria-disabled` e `title` (T16)
- [x] Botão "Sair" → signOut + redirect (T16)
- [x] Layout `(admin)` redireciona anon (T11)
- [x] Todos os testes passam (T21 Step 1)
- [x] `pnpm typecheck` zero `any`/`as unknown` (T21 Step 1)
- [x] `pnpm lint` zero warnings (T21 Step 1)
- [x] Smoke manual: cadastro real, link, dashboard, sair, voltar (T21 Steps 2-3)
