# Setup do projeto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a runnable Next.js 14 + TypeScript + Tailwind v4 + Supabase application with linting, formatting, Vitest, env validation, auth-session middleware, route group layouts, and Radix primitives — delivered as 6 thematic, reviewable commits over `main`.

**Architecture:** Hybrid Supabase (CLI-managed migrations + cloud-only dev project, no local Docker stack). Three Supabase clients with distinct privileges (browser/server/admin) following the official `@supabase/ssr` pattern. App Router with route groups per audience (public/auth/dashboard/admin). Tailwind v4 with `@theme` directive consuming the prototype's CSS variables. Tailwind v4, ESLint v9 flat config, Vitest+jsdom for unit tests.

**Tech Stack:** Node 22 LTS, pnpm 9+, Next.js 14, TypeScript 5.7, Tailwind CSS v4, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Zod, Radix UI primitives, sonner, Vitest, ESLint v9, Prettier.

**Spec:** `docs/superpowers/specs/2026-04-29-setup-projeto-design.md` (commit `ea48477`).

**Pré-requisitos do desenvolvedor (verificar antes de começar):**

- [ ] Node 22 LTS instalado: `node --version` retorna `v22.x.x`
- [ ] pnpm instalado: `pnpm --version` retorna `9.x` ou superior (se faltar: `npm i -g pnpm`)
- [ ] Supabase CLI instalada: `supabase --version` retorna versão (se faltar: `npm i -g supabase` ou `scoop install supabase`)
- [ ] Estar em `C:\Users\abnet\Desktop\bolao` na branch `main`
- [ ] `git log --oneline` mostra exatamente um commit (`ea48477 chore: bootstrap repo with charter, prototype, and feature 1 spec`)

---

## Task 1: Scaffold Next.js 14 + TypeScript + Tailwind v4

**Objetivo:** repo com `pnpm dev` rodando e tipografia do protótipo aplicada na home.

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `postcss.config.mjs`
- Create: `.nvmrc`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/(public)/page.tsx`
- Modify: `.gitignore` (expandir)

### Steps

- [ ] **Step 1.1: Criar `.nvmrc`**

```bash
echo "22" > .nvmrc
```

- [ ] **Step 1.2: Criar `package.json` com deps e scripts**

```json
{
  "name": "bolao-copa-2026",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,css}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,css}\"",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "14.2.18",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.7.2"
  }
}
```

Notas:

- `next 14.2.18` é a última patch da linha 14 estável. Pin patch específico evita surpresas.
- React 18 (não 19) — Next 14 não suporta React 19 ainda.
- Eslint, Prettier, Vitest entram no Task 2. Supabase no Task 3. Radix no Task 6.

- [ ] **Step 1.3: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 1.4: Criar `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'rvprwtrcpdyoljlekxdx.supabase.co' }],
  },
};

export default nextConfig;
```

- [ ] **Step 1.5: Criar `postcss.config.mjs`**

```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

- [ ] **Step 1.6: Criar `app/globals.css` com tokens via `@theme`**

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

Por que `var(--font-bebas)` etc.? O `next/font/google` (no Step 1.7) gera CSS vars com nomes do tipo `--font-bebas` que apontam pra família randomizada self-hosted; o fallback literal cobre casos de teste/SSR.

- [ ] **Step 1.7: Criar `app/layout.tsx` com fontes do protótipo**

```tsx
import type { Metadata } from 'next';
import { Bebas_Neue, Archivo, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});

const archivo = Archivo({
  weight: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bolão Copa 2026',
  description: 'Bolão da Copa do Mundo FIFA 2026.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${bebasNeue.variable} ${archivo.variable} ${jetBrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 1.8: Criar `app/(public)/page.tsx` (placeholder home)**

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-display text-accent text-7xl tracking-wide">Bolão Copa 2026</h1>
      <p className="font-body text-text-secondary text-lg">
        Setup OK — landing page real entra na Feature 3.
      </p>
      <code className="text-text-muted font-mono text-sm">app/(public)/page.tsx</code>
    </main>
  );
}
```

Esse placeholder serve como smoke visual: se Bebas Neue, Archivo, JetBrains Mono e o token `--color-accent` aparecem corretamente, a config tá certa.

- [ ] **Step 1.9: Expandir `.gitignore`**

Substituir o conteúdo atual de `.gitignore` por:

```
# OS
.DS_Store
Thumbs.db
desktop.ini

# Editors
.vscode/
.idea/
*.swp

# Env (essencial — service_role key não pode vazar)
.env
.env.local
.env.*.local

# Supabase CLI artifacts
.supabase/
supabase/.temp/
supabase/.branches/

# Node / Next
node_modules/
.next/
out/
build/
dist/
*.tsbuildinfo
next-env.d.ts

# Test / coverage
coverage/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
```

- [ ] **Step 1.10: Instalar dependências**

Run:

```bash
pnpm install
```

Expected: termina sem erro. `pnpm-lock.yaml` é gerado. Pasta `node_modules/` é criada (gitignored).

Se aparecer erro `EPERM symlink` no Windows: ativar Developer Mode em Settings → For Developers, ou rodar terminal como admin.

- [ ] **Step 1.11: Validar typecheck**

Run:

```bash
pnpm typecheck
```

Expected: zero erros.

- [ ] **Step 1.12: Validar dev server**

Run (em background ou outro terminal):

```bash
pnpm dev
```

Expected:

- Console mostra `▲ Next.js 14.2.18` e `Local: http://localhost:3000`
- Sem erros de compilação
- Abrir `http://localhost:3000` no browser: vê "Bolão Copa 2026" em Bebas Neue na cor amarela `#facc15`, body Archivo, código em JetBrains Mono. Background `#0a0e1a` (escuro).

Parar o dev server (Ctrl+C) antes de seguir.

- [ ] **Step 1.13: Validar build**

Run:

```bash
pnpm build
```

Expected: build conclui com sucesso, lista a rota `/` no output.

- [ ] **Step 1.14: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.mjs postcss.config.mjs .nvmrc .gitignore app/
git commit -m "chore: scaffold Next.js 14 with TypeScript and Tailwind v4"
```

---

## Task 2: Configure linting, formatting, and Vitest with smoke test

**Objetivo:** ferramentas de qualidade rodando + um smoke test em verde via TDD.

**Files:**

- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `lib/utils.ts`
- Create: `lib/__tests__/utils.test.ts`
- Modify: `package.json` (adicionar deps + scripts de test)

### Steps

- [ ] **Step 2.1: Adicionar deps de qualidade ao `package.json`**

Atualizar `package.json` adicionando aos `dependencies` e `devDependencies`:

```json
{
  "dependencies": {
    "next": "14.2.18",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.2.0",
    "@tailwindcss/postcss": "^4.0.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.16.0",
    "eslint-config-next": "14.2.18",
    "jsdom": "^25.0.1",
    "prettier": "^3.4.2",
    "prettier-plugin-tailwindcss": "^0.6.9",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.7.2",
    "vite-tsconfig-paths": "^5.1.4",
    "vitest": "^2.1.8",
    "@vitest/ui": "^2.1.8"
  }
}
```

E adicionar aos `scripts`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:ui": "vitest --ui"
  }
}
```

(Mantém os scripts existentes do Step 1.2.)

- [ ] **Step 2.2: Instalar novas deps**

```bash
pnpm install
```

Expected: instala sem erro.

- [ ] **Step 2.3: Criar `eslint.config.mjs` (ESLint v9 flat config)**

```js
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
    ignores: ['.next/', 'node_modules/', 'supabase/', '*.config.*'],
  },
];
```

- [ ] **Step 2.4: Criar `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 2.5: Criar `.prettierignore`**

```
.next
node_modules
pnpm-lock.yaml
supabase/.temp
supabase/.branches
coverage
out
build
dist
```

- [ ] **Step 2.6: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e', 'supabase'],
  },
});
```

- [ ] **Step 2.7: Criar `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2.8 (TDD step 1): Escrever teste falhando antes da implementação**

Criar `lib/__tests__/utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (Tailwind class merger)', () => {
  it('merges classes', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('resolves tailwind conflicts (later wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('filters out falsy values', () => {
    expect(cn('px-2', false && 'py-1', null, undefined, 'text-sm')).toBe('px-2 text-sm');
  });
});
```

- [ ] **Step 2.9 (TDD step 2): Rodar teste e confirmar que falha**

Run:

```bash
pnpm test:run
```

Expected: `FAIL` com erro do tipo `Cannot find module '@/lib/utils'` ou import error. Isso confirma que o test runner está vivo e o módulo ainda não existe.

- [ ] **Step 2.10 (TDD step 3): Implementar `lib/utils.ts`**

Criar `lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2.11 (TDD step 4): Rodar teste e confirmar que passa**

Run:

```bash
pnpm test:run
```

Expected:

```
✓ lib/__tests__/utils.test.ts (3 tests)
  ✓ cn (Tailwind class merger)
    ✓ merges classes
    ✓ resolves tailwind conflicts (later wins)
    ✓ filters out falsy values

Test Files  1 passed (1)
Tests       3 passed (3)
```

- [ ] **Step 2.12: Rodar lint**

Run:

```bash
pnpm lint
```

Expected: zero warnings, zero errors.

Se aparecer warning sobre arquivos de config (`*.config.*`), conferir o `ignores` no `eslint.config.mjs`.

- [ ] **Step 2.13: Rodar format check**

Run:

```bash
pnpm format
pnpm format:check
```

Expected (após `pnpm format`): "All matched files use Prettier code style!"

- [ ] **Step 2.14: Rodar typecheck**

Run:

```bash
pnpm typecheck
```

Expected: zero erros.

- [ ] **Step 2.15: Commit**

```bash
git add package.json pnpm-lock.yaml eslint.config.mjs .prettierrc.json .prettierignore vitest.config.ts vitest.setup.ts lib/
git commit -m "chore: configure linting, formatting, and Vitest"
```

---

## Task 3: Scaffold Supabase clients and migrations workflow

**Objetivo:** três clients tipados, env validado, Supabase CLI inicializada.

**Files:**

- Create: `lib/env.ts`
- Create: `lib/supabase/types.ts`
- Create: `lib/supabase/browser.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`
- Create: `.env.local.example`
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `.env.local` (gitignored — usuário preenche)
- Modify: `package.json` (add deps + `supabase:types` script)

### ⚠️ Manual step prerequisite

Antes de começar essa task:

1. Pegue a `service_role` key (formato `sb_secret_*`) no painel do Supabase Cloud:
   - Acesse `https://supabase.com/dashboard/project/rvprwtrcpdyoljlekxdx/settings/api`
   - Em "Project API Keys" → seção "Secret keys" → copie a `service_role`

**Nunca cole essa key em chat, em commits, ou em arquivos versionados.** Ela vai direto pro `.env.local` (gitignored) no Step 3.6.

### Steps

- [ ] **Step 3.1: Adicionar deps Supabase + Zod ao `package.json`**

Atualizar `dependencies`:

```json
{
  "dependencies": {
    "next": "14.2.18",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.46.1",
    "zod": "^3.23.8",
    "server-only": "^0.0.1"
  }
}
```

E adicionar ao `scripts`:

```json
{
  "scripts": {
    "supabase:types": "supabase gen types typescript --linked > lib/supabase/types.ts"
  }
}
```

- [ ] **Step 3.2: Instalar novas deps**

```bash
pnpm install
```

Expected: instala sem erro.

- [ ] **Step 3.3: Criar `lib/env.ts` (validação fail-fast com Zod)**

```ts
import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
```

- [ ] **Step 3.4: Criar `lib/supabase/types.ts` (placeholder vazio)**

```ts
// Placeholder. Substituído pelo output de `pnpm supabase:types` após
// `supabase link` e quando houver tabelas (a partir da Feature 2).
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
```

- [ ] **Step 3.5: Criar `.env.local.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxxxxxx

# Asaas (preencher na feature 6)
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=

# API-Football (preencher na feature 12)
API_FOOTBALL_KEY=

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 3.6 (manual): Criar `.env.local` real**

Copiar template:

```bash
cp .env.local.example .env.local
```

Editar `.env.local` (NÃO versionado) com os valores reais:

```
NEXT_PUBLIC_SUPABASE_URL=https://rvprwtrcpdyoljlekxdx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_3mYMhTjL_EZ_c1LCe3R5kA_EYAtSMi8
SUPABASE_SERVICE_ROLE_KEY=<cole aqui a key sb_secret_* do Supabase Cloud>
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
API_FOOTBALL_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 3.7: Criar `lib/supabase/browser.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
```

- [ ] **Step 3.8: Criar `lib/supabase/server.ts`**

```ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // chamado em RSC: middleware é quem renova a sessão
          }
        },
      },
    },
  );
}
```

- [ ] **Step 3.9: Criar `lib/supabase/admin.ts`**

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

export function createSupabaseAdminClient() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 3.10 (manual): Login na Supabase CLI**

Run:

```bash
supabase login
```

Expected: abre browser pra autenticação. Após autorizar, terminal mostra "You are now logged in."

Se já estiver logado de uma sessão anterior, retorna mensagem confirmando.

- [ ] **Step 3.11: Inicializar Supabase no projeto**

Run:

```bash
supabase init
```

Expected: cria `supabase/config.toml`. Se prompt perguntar "Generate VS Code settings for Deno?" → escolher **No** (não usamos Edge Functions ainda; quando precisar, adicionamos).

- [ ] **Step 3.12 (manual): Linkar com o projeto Supabase Cloud**

Run:

```bash
supabase link --project-ref rvprwtrcpdyoljlekxdx
```

Expected: pede a senha do banco (a que você definiu na criação do projeto Supabase Cloud). Após aceitar:

- Cria `supabase/.temp/`
- Mostra "Finished supabase link."

⚠️ Se você não souber/lembrar a senha do banco: regere em `https://supabase.com/dashboard/project/rvprwtrcpdyoljlekxdx/settings/database` (botão "Reset database password"). **Salve a nova senha em local seguro.**

- [ ] **Step 3.13 (manual): Gerar types do Supabase**

Run:

```bash
pnpm supabase:types
```

Expected: `lib/supabase/types.ts` é sobrescrito com types reais do schema. Como ainda não há tabelas (feature 2 que cria), o output vai ser parecido com o placeholder mas com algumas extensões internas do Supabase. **OK que sobrescreva o placeholder** — se algo der errado e o `pnpm typecheck` quebrar nos próximos steps, restaure o conteúdo do Step 3.4.

Se o comando falhar com "no project linked": refazer Step 3.12.

- [ ] **Step 3.14: Validar typecheck**

Run:

```bash
pnpm typecheck
```

Expected: zero erros. `lib/env.ts` consegue parsear (porque `.env.local` tá preenchido), e os 3 clients compilam usando os types gerados.

⚠️ Se aparecer erro do tipo `Property 'getAll' does not exist on type ReadonlyRequestCookies`, você está numa versão de Next anterior à 15 onde `cookies()` não retorna Promise. Confirme `next@14.2.18` no `package.json` — o `await cookies()` é compatível com 14.2+.

- [ ] **Step 3.15: Validar dev server**

Run:

```bash
pnpm dev
```

Expected: sobe sem erros. Sem chamada real ao Supabase ainda (nenhuma página importa os clients), mas o build de runtime tem que validar que `lib/env.ts` parseia corretamente.

Se aparecer erro `❌ Invalid environment variables`: revisar `.env.local` — todas as 4 vars (URL, ANON_KEY, SERVICE_ROLE_KEY, SITE_URL) precisam estar preenchidas. Parar dev server.

- [ ] **Step 3.16: Commit**

```bash
git add package.json pnpm-lock.yaml lib/env.ts lib/supabase/ .env.local.example supabase/
git commit -m "chore: scaffold Supabase clients and migrations workflow"
```

⚠️ Confirmar que `.env.local` NÃO está no commit:

```bash
git log --stat -1 | grep -i "env.local$" && echo "ALERTA: .env.local commitado!" || echo "OK: .env.local não foi commitado"
```

Expected: `OK: .env.local não foi commitado`. Se aparecer "ALERTA": **NÃO PUSHE**, rode `git reset HEAD~1`, confirme `.gitignore` cobre `.env.local`, refaça o commit.

---

## Task 4: Add Next.js middleware for auth session refresh

**Objetivo:** middleware renova sessão Supabase em toda request relevante.

**Files:**

- Create: `middleware.ts` (root)
- Create: `lib/supabase/middleware.ts`

### Steps

- [ ] **Step 4.1: Criar `lib/supabase/middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() valida JWT no servidor (vs getSession que só lê cookie)
  await supabase.auth.getUser();

  return response;
}
```

- [ ] **Step 4.2: Criar `middleware.ts` (root)**

Caminho: `middleware.ts` na raiz do projeto (não em `app/`, não em `lib/`).

```ts
import type { NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 4.3: Validar typecheck**

Run:

```bash
pnpm typecheck
```

Expected: zero erros.

- [ ] **Step 4.4: Validar dev server e middleware**

Run:

```bash
pnpm dev
```

Expected: sobe sem erros. No console, request a `/` deve passar pelo middleware (Next 14 não loga isso explicitamente em dev, mas verificamos via cookies no próximo step).

- [ ] **Step 4.5 (manual): Verificar cookies de sessão**

Com dev server rodando, abrir `http://localhost:3000` no browser. Abrir DevTools → Application → Cookies → localhost.

Expected: existe pelo menos um cookie iniciando com `sb-rvprwtrcpdyoljlekxdx-auth-token` (será vazio/anônimo, mas o cookie é setado).

Se nenhum cookie aparece: pode ser que o matcher esteja excluindo `/`. Conferir o `config.matcher` em `middleware.ts` — a regex deve casar com `/`.

Parar o dev server (Ctrl+C).

- [ ] **Step 4.6: Validar build**

Run:

```bash
pnpm build
```

Expected: build conclui. No output, lista o middleware como `ƒ Middleware`.

- [ ] **Step 4.7: Commit**

```bash
git add middleware.ts lib/supabase/middleware.ts
git commit -m "chore: add Next.js middleware for auth session refresh"
```

---

## Task 5: Scaffold app route groups and base layouts

**Objetivo:** estrutura de rotas (`/`, `/login`, `/dashboard`, `/admin`) com layouts diferenciados, mais páginas de erro globais.

**Files:**

- Create: `app/(public)/layout.tsx`
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/auth/callback/route.ts`
- Create: `app/(dashboard)/layout.tsx`
- Create: `app/(dashboard)/dashboard/page.tsx`
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/admin/page.tsx`
- Create: `app/not-found.tsx`
- Create: `app/error.tsx`

### Steps

- [ ] **Step 5.1: Criar `app/(public)/layout.tsx`**

```tsx
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border border-b px-6 py-4">
        <span className="font-display text-2xl tracking-wide">
          BOLÃO <span className="text-accent">2026</span>
        </span>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-border text-text-muted border-t px-6 py-4 text-center font-mono text-xs">
        Bolão Copa 2026 — placeholder de footer (real na Feature 3)
      </footer>
    </div>
  );
}
```

- [ ] **Step 5.2: Criar `app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5.3: Criar `app/(auth)/login/page.tsx`**

```tsx
export default function LoginPage() {
  return (
    <section className="border-border bg-bg-card rounded-lg border p-8">
      <h1 className="font-display text-3xl tracking-wide">Entrar</h1>
      <p className="font-body text-text-secondary mt-2 text-sm">
        Placeholder. Magic link entra na Feature 4.
      </p>
    </section>
  );
}
```

- [ ] **Step 5.4: Criar `app/(auth)/auth/callback/route.ts` (placeholder)**

```ts
import { NextResponse } from 'next/server';

export async function GET() {
  // Handler real entra na Feature 4 (auth).
  // Por enquanto só responde 501 pra não confundir com sucesso.
  return NextResponse.json(
    { error: 'auth callback not implemented yet — see Feature 4' },
    { status: 501 },
  );
}
```

- [ ] **Step 5.5: Criar `app/(dashboard)/layout.tsx`**

```tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="border-border hidden w-64 border-r p-6 md:block">
        <span className="font-display text-xl tracking-wide">DASHBOARD</span>
        <p className="text-text-muted mt-2 font-mono text-xs">sidebar real na Feature 4</p>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5.6: Criar `app/(dashboard)/dashboard/page.tsx`**

```tsx
export default function DashboardPage() {
  return (
    <section>
      <h1 className="font-display text-4xl tracking-wide">Meu painel</h1>
      <p className="font-body text-text-secondary mt-2 text-sm">
        Placeholder. Conteúdo real entra na Feature 4.
      </p>
    </section>
  );
}
```

- [ ] **Step 5.7: Criar `app/(admin)/layout.tsx`**

```tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
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

- [ ] **Step 5.8: Criar `app/(admin)/admin/page.tsx`**

```tsx
export default function AdminPage() {
  return (
    <section>
      <h1 className="font-display text-4xl tracking-wide">Painel admin</h1>
      <p className="font-body text-text-secondary mt-2 text-sm">
        Placeholder. KPIs e gráficos entram nas Features 9-11.
      </p>
    </section>
  );
}
```

- [ ] **Step 5.9: Criar `app/not-found.tsx`**

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

- [ ] **Step 5.10: Criar `app/error.tsx`**

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
        className="border-border-strong font-body text-text-primary hover:border-accent hover:text-accent rounded-md border px-4 py-2 text-sm"
      >
        Tentar novamente
      </button>
    </main>
  );
}
```

- [ ] **Step 5.11: Validar typecheck**

Run:

```bash
pnpm typecheck
```

Expected: zero erros.

- [ ] **Step 5.12: Validar build (lista todas as rotas)**

Run:

```bash
pnpm build
```

Expected: o output do `next build` lista (em qualquer ordem):

```
Route (app)
○ /                          (estático)
○ /admin                     (estático)
ƒ /auth/callback             (dinâmico — Route Handler)
○ /dashboard                 (estático)
○ /login                     (estático)
○ /_not-found                (estático)
ƒ Middleware
```

Confere visualmente que todas as 5 rotas (sem contar `/_not-found`) estão na lista.

- [ ] **Step 5.13 (manual): Validar rotas em dev**

Run:

```bash
pnpm dev
```

Visitar no browser, confirmando que cada uma renderiza:

- `http://localhost:3000/` → "Bolão Copa 2026" + header público
- `http://localhost:3000/login` → "Entrar" centralizado
- `http://localhost:3000/dashboard` → "Meu painel" com sidebar
- `http://localhost:3000/admin` → "Painel admin" com header vermelho
- `http://localhost:3000/rota-que-nao-existe` → 404 estilizado
- `http://localhost:3000/auth/callback` → JSON `{"error":"auth callback not implemented yet — see Feature 4"}` com status 501

Parar dev server.

- [ ] **Step 5.14: Commit**

```bash
git add app/
git commit -m "chore: scaffold app route groups and base layouts"
```

---

## Task 6: Add Radix primitives, sonner, and finalize README

**Objetivo:** primitivos disponíveis pras próximas features + Toaster montado + documentação mínima.

**Files:**

- Modify: `package.json` (deps Radix + sonner)
- Modify: `app/layout.tsx` (montar `<Toaster/>`)
- Create: `README.md`

### Steps

- [ ] **Step 6.1: Adicionar deps Radix + sonner ao `package.json`**

Atualizar `dependencies`:

```json
{
  "dependencies": {
    "next": "14.2.18",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.46.1",
    "zod": "^3.23.8",
    "server-only": "^0.0.1",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-tabs": "^1.1.1",
    "@radix-ui/react-tooltip": "^1.1.4",
    "@radix-ui/react-popover": "^1.1.2",
    "lucide-react": "^0.460.0",
    "sonner": "^1.7.0"
  }
}
```

- [ ] **Step 6.2: Instalar novas deps**

```bash
pnpm install
```

Expected: instala sem erro.

- [ ] **Step 6.3: Modificar `app/layout.tsx` pra montar `<Toaster/>`**

Substituir o conteúdo de `app/layout.tsx` por:

```tsx
import type { Metadata } from 'next';
import { Bebas_Neue, Archivo, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});

const archivo = Archivo({
  weight: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bolão Copa 2026',
  description: 'Bolão da Copa do Mundo FIFA 2026.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${bebasNeue.variable} ${archivo.variable} ${jetBrainsMono.variable}`}
    >
      <body>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: 'font-body',
            },
          }}
        />
      </body>
    </html>
  );
}
```

- [ ] **Step 6.4: Criar `README.md`**

```markdown
# Bolão Copa 2026

Sistema de bolão da Copa do Mundo FIFA 2026.

## Pré-requisitos

- Node 22 LTS (ver `.nvmrc`)
- pnpm 9+
- Supabase CLI (`npm i -g supabase` ou via scoop/winget)

## Setup local

1. Clone o repo e entre na pasta.
2. `pnpm install`
3. `cp .env.local.example .env.local` e preencha as keys do Supabase (a `service_role` é pegada no painel do Supabase, NUNCA pasta em chat).
4. `supabase login` (interativo, abre browser)
5. `supabase link --project-ref rvprwtrcpdyoljlekxdx`
6. `pnpm supabase:types` (popula `lib/supabase/types.ts`)
7. `pnpm dev`

## Scripts

- `pnpm dev` — Next dev server
- `pnpm build` — production build
- `pnpm lint` — ESLint
- `pnpm format` — Prettier
- `pnpm typecheck` — TypeScript sem emitir
- `pnpm test` — Vitest watch
- `pnpm test:run` — Vitest single run

## Documentação interna

- `CLAUDE.md` — charter do projeto
- `docs/prototype/` — protótipo HTML de referência
- `docs/superpowers/specs/` — design docs por feature
- `docs/superpowers/plans/` — planos de implementação por feature
```

- [ ] **Step 6.5: Validar typecheck**

Run:

```bash
pnpm typecheck
```

Expected: zero erros.

- [ ] **Step 6.6: Validar lint**

Run:

```bash
pnpm lint
```

Expected: zero warnings, zero errors.

- [ ] **Step 6.7: Validar testes (smoke test continua passando)**

Run:

```bash
pnpm test:run
```

Expected: 3 testes passando (`cn` test).

- [ ] **Step 6.8: Validar build com Toaster**

Run:

```bash
pnpm build
```

Expected: build conclui. O `Toaster` aparece como componente client (sonner é client-only) mas é renderizado dentro do server component root layout — Next 14 lida com isso corretamente.

- [ ] **Step 6.9 (manual): Smoke visual do Toaster (opcional)**

O Toaster aparece no DOM mas só é visível quando algo dispara `toast(...)`. Validação real fica pra Feature 4 (auth → toast de "magic link enviado").

Validação leve aqui: rodar `pnpm dev`, abrir `http://localhost:3000`, abrir DevTools → Elements → procurar pelo elemento `<ol data-sonner-toaster>` ou `<section data-sonner-toaster>` no final do `<body>`. Se ele existe, o Toaster está montado corretamente.

Parar dev server.

- [ ] **Step 6.10: Commit final**

```bash
git add package.json pnpm-lock.yaml app/layout.tsx README.md
git commit -m "chore: add Radix primitives and sonner"
```

---

## Final Acceptance Criteria

Após o último commit, confirmar a feature inteira:

- [ ] **A.1: `pnpm install` roda limpo**
  - Run: `pnpm install`
  - Expected: termina sem erro

- [ ] **A.2: `pnpm dev` sobe sem warning**
  - Run: `pnpm dev`
  - Expected: console mostra "Ready" sem erros de env var; abrir `/` no browser confirma a tipografia do protótipo

- [ ] **A.3: `pnpm build` produz bundle**
  - Run: `pnpm build`
  - Expected: build conclui; lista 5 rotas + middleware

- [ ] **A.4: `pnpm typecheck` zero erros**
  - Run: `pnpm typecheck`
  - Expected: termina silenciosamente (zero output além de coleta de progresso)

- [ ] **A.5: `pnpm lint` zero warnings**
  - Run: `pnpm lint`
  - Expected: "No ESLint warnings or errors"

- [ ] **A.6: `pnpm test:run` passa**
  - Run: `pnpm test:run`
  - Expected: 1 file, 3 tests, all pass

- [ ] **A.7: Todas as rotas placeholder respondem**
  - `/` → 200, header público, hero do protótipo
  - `/login` → 200, "Entrar" centralizado
  - `/dashboard` → 200, "Meu painel" com sidebar
  - `/admin` → 200, "Painel admin" com header de admin
  - `/auth/callback` → 501 (placeholder esperado)
  - `/rota-inexistente` → 404 estilizado

- [ ] **A.8: Tipografia do protótipo aplicada na home**
  - Bebas Neue no h1, Archivo no body, JetBrains Mono no `<code>`, accent `#facc15` no h1, background `#0a0e1a`

- [ ] **A.9: `git log --oneline` mostra 7 commits limpos**
  - Run: `git log --oneline`
  - Expected:
    ```
    <hash7> chore: add Radix primitives and sonner
    <hash6> chore: scaffold app route groups and base layouts
    <hash5> chore: add Next.js middleware for auth session refresh
    <hash4> chore: scaffold Supabase clients and migrations workflow
    <hash3> chore: configure linting, formatting, and Vitest
    <hash2> chore: scaffold Next.js 14 with TypeScript and Tailwind v4
    ea48477 chore: bootstrap repo with charter, prototype, and feature 1 spec
    ```

- [ ] **A.10: `.env.local` NUNCA foi commitado**
  - Run: `git log --all --full-history -- .env.local`
  - Expected: output vazio. Se aparecer commit: parar tudo, refazer com `git rebase -i` e remover.

---

## Notas pro próximo desenvolvedor (Feature 2)

- **`lib/supabase/types.ts` ainda é placeholder.** Após a Feature 2 criar tabelas, rodar `pnpm supabase:types` regenera o arquivo e os 3 clients passam a ter autocomplete real.
- **`server-only` package** já está instalado (Step 3.1). Se a Feature 2 ou superior criar funções server-side novas, marcar com `import 'server-only';` segue sendo a convenção.
- **`app/api/`** está vazio. Webhooks (Asaas — Feature 6) e cron (API-Football — Feature 12) entram aqui.
- **`supabase/migrations/`** está vazio. Feature 2 popula com a primeira migration (`001_initial_schema.sql`).
- **CI ainda não existe.** Feature 5 (lógica de pontuação) é a primeira que justifica adicionar GitHub Actions, conforme decisão Q6.
- **Atualização do CLAUDE.md sobre Tailwind:** ✅ resolvido (esta feature já corrigiu §2 do `CLAUDE.md`).

---

## Amendments aplicadas durante a execução

Esta seção registra as divergências entre o que o plano original prescrevia e o que foi efetivamente implementado, todas autorizadas pelo usuário inline durante a execução. Quando você for ler este plano como referência pra entender o estado do código, **as amendments abaixo prevalecem**.

### Amendment 1 — ESLint v8 + legacy `.eslintrc.json` (Task 2)

- **Plano original:** ESLint v9 com flat config (`eslint.config.mjs`), `@eslint/eslintrc` em devDeps.
- **Implementação:** ESLint `^8.57.0` com legacy `.eslintrc.json`, sem `@eslint/eslintrc`.
- **Motivo:** `eslint-config-next@14.2.18` peer-depende de ESLint v8 e usa APIs (`context.getScope`) removidas na v9. Como CLAUDE.md fixa Next 14, ESLint v9 não é viável.
- **Commit:** `96612b0`

### Amendment 2 — `vitest.config.mts` (Task 2)

- **Plano original:** `vitest.config.ts` (extensão `.ts`).
- **Implementação:** `vitest.config.mts` (extensão `.mts`).
- **Motivo:** `vite-tsconfig-paths@5.1.4` é ESM-only. Vitest carrega arquivos `.ts` em modo CJS quando `package.json` não tem `"type": "module"` (e o projeto Next 14 não tem). `.mts` força loader ESM.
- **Commit:** `96612b0`

### Amendment 3 — Cookie callback typing (Tasks 3 e 4)

- **Plano original:** `setAll: (toSet) => { ... }` em `lib/supabase/server.ts` e `lib/supabase/middleware.ts`.
- **Implementação:** `setAll: (toSet: CookieToSet[]) => { ... }` com `type CookieToSet = Parameters<SetAllCookies>[0][number]` importado de `@supabase/ssr`.
- **Motivo:** `createServerClient` é overloaded entre `CookieMethodsServer` e `CookieMethodsServerDeprecated`; TS não propaga o tipo do callback sob `strict + noImplicitAny`. Extrair o tipo via `Parameters<...>` mantém o código alinhado com a tipagem pública do `@supabase/ssr`.
- **Commits:** `bcc0866` (Task 3 inicial), `7e9b7e4` (refactor pra `Parameters<>`), `3938800` (Task 4 já com o pattern).

### Amendment 4 — Middleware resiliência + matcher (Task 4)

- **Plano original:** `await supabase.auth.getUser();` direto, sem try/catch. Matcher cobria todas as rotas exceto static assets.
- **Implementação:** `getUser()` envolto em `try/catch` (erros transientes não 500 a request); matcher exclui também `/api/`.
- **Motivo:** Audiência mobile-first com conectividade flutuante; webhooks/cron handlers em `/api/` não usam sessão Supabase.
- **Commit:** `04a518b`

### Amendment 5 — Public layout `<main>` landmark (Task 5)

- **Plano original:** `<div className="flex-1">{children}</div>` em `app/(public)/layout.tsx`.
- **Implementação:** `<main className="flex-1">{children}</main>`.
- **Motivo:** Consistência com os outros 3 layouts de grupo + landmark de acessibilidade.
- **Commit:** `02a1185`

### Amendment 6 — Toaster mobile-first (Task 6)

- **Plano original:** `<Toaster position="top-right" ... />`.
- **Implementação:** `<Toaster position="top-center" ... />`.
- **Motivo:** Sonner 1.x não auto-stretch toasts `top-right` em mobile (375px viewport); CLAUDE.md §1/§2 mandam mobile-first.
- **Commit:** `14586fc`

### Amendment 7 — `lib/env.ts` mensagem de erro

- **Plano original:** `throw new Error('Invalid environment variables')`.
- **Implementação:** mensagem inclui field errors serializados + ponteiro pra `.env.local.example`.
- **Motivo:** Sobrevive em CI runners que swalow `console.error` e dá ao novo contribuidor uma pista acionável.
- **Commit:** `7e9b7e4`

### Amendment 8 — `<Database>` generic em middleware

- **Plano original:** `createServerClient(...)` sem generic em `lib/supabase/middleware.ts`.
- **Implementação:** `createServerClient<Database>(...)` (consistente com browser/server/admin).
- **Motivo:** Simetria entre os 4 clients; permite consumer code futuro consumir tipos do schema.
- **Commit:** docs: deste mesmo commit ou o anterior na sequência (verificar `git log`).

---

## Histórico de commits (10)

```
14586fc refactor: mobile-first toaster position and README polish
cb78b5f chore: add Radix primitives and sonner
02a1185 refactor: promote (public) layout wrapper to <main> landmark
0caff8a chore: scaffold app route groups and base layouts
04a518b refactor: harden middleware against transient errors and skip /api/
3938800 chore: add Next.js middleware for auth session refresh
7e9b7e4 refactor: tighten Supabase cookie typing and env error message
bcc0866 chore: scaffold Supabase clients and migrations workflow
96612b0 chore: configure linting, formatting, and Vitest
eeba805 chore: scaffold Next.js 14 with TypeScript and Tailwind v4
```

Os 6 `chore:` correspondem 1:1 aos 6 tasks do plano. Os 4 `refactor:` resolveram concerns levantados em code reviews (1 e 2 estágios) durante a execução.
