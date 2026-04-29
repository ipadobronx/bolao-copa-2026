# Feature 1 — Setup do projeto

**Data:** 2026-04-29
**Status:** Aprovado para implementação
**Autor:** Brainstorm conduzido com Jonatas
**Próximo passo:** writing-plans → executing-plans em worktree separado

---

## 1. Contexto e motivação

Primeira feature da seção 5 do `CLAUDE.md`. O repositório está vazio exceto por:

- `CLAUDE.md` (charter do projeto)
- `docs/prototype/bolao-copa-2026.html` (protótipo visual de referência)

Esta feature scaffolda toda a base sobre a qual as próximas 13 features vão construir: framework, tipagem, estilo, clients de banco, middleware de auth, estrutura de rotas, ferramentas de teste, lint, format, env vars validadas. A entrega é um repositório que **roda** (`pnpm dev`), **builda** (`pnpm build`), **lint+typecheck+test passam**, e cuja arquitetura é coerente com as decisões editoriais do `CLAUDE.md`.

Esta feature **não** entrega:

- Schema do banco (feature 2)
- UI real da landing (feature 3)
- Fluxo de auth (feature 4)
- Lógica de pontuação (feature 5)
- Asaas, API-Football, Playwright, CI, husky — adiados pra features que justifiquem.

---

## 2. Decisões consolidadas no brainstorming

| # | Pergunta | Escolha | Motivação |
|---|----------|---------|-----------|
| Q1 | Gerenciador de pacotes | **pnpm** | Determinístico, rápido, store global; melhor durante TDD |
| Q2 | Versão do Tailwind | **v4** | Config em CSS via `@theme` casa com tokens do protótipo (CSS-vars-first); elimina duplicação `:root` ↔ `tailwind.config.ts` |
| Q3 | Stack Supabase em dev | **Híbrido (CLI + cloud, sem Docker)** | Migrations versionadas como arquivos; dev aponta direto pro projeto Supabase Cloud |
| Q4 | UI primitives | **Radix puro pros 6 primitivos com a11y + custom Tailwind pros simples + sonner** | Mantém fidelidade ao protótipo; só importa biblioteca onde acessibilidade compensa |
| Q5 | Projeto Supabase | **Existente: `rvprwtrcpdyoljlekxdx`** | URL e anon key fornecidas pelo usuário; service_role key será preenchida diretamente em `.env.local` |
| Q6 | Hooks/CI/smoke test | **Setup mínimo viável** | Sem husky, sem lint-staged, sem GitHub Actions; um único smoke test pra validar Vitest. CI entra na feature 5 quando há regra crítica pra proteger |
| — | Versão do Next.js | **14** | Mantém literalmente o que está no `CLAUDE.md`; sem upgrade unilateral |
| — | Estratégia de execução | **B — commits temáticos sequenciais** | 6 commits revisáveis, cada um com critério de pronto independente |

---

## 3. Arquitetura

### 3.1 Stack final de dependências

**Runtime / framework:**

- Node 22 LTS (pinado em `.nvmrc` e `package.json#engines`)
- Next.js 14 (App Router, Server Components por padrão)
- TypeScript ~5.7 com `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`

**Dependencies (runtime):**

```
next, react, react-dom,
@supabase/supabase-js, @supabase/ssr,
zod, sonner, lucide-react, clsx, tailwind-merge,
@radix-ui/react-dialog, @radix-ui/react-dropdown-menu,
@radix-ui/react-tabs, @radix-ui/react-tooltip, @radix-ui/react-popover
```

**devDependencies:**

```
typescript, @types/node, @types/react, @types/react-dom,
eslint, eslint-config-next,
@typescript-eslint/parser, @typescript-eslint/eslint-plugin,
@eslint/eslintrc,
prettier, prettier-plugin-tailwindcss,
tailwindcss, @tailwindcss/postcss,
vitest, @vitest/ui, @vitejs/plugin-react, vite-tsconfig-paths,
@testing-library/react, @testing-library/jest-dom, jsdom
```

**Não-deps (instaladas separadamente):**

- Supabase CLI — instalada globalmente pelo desenvolvedor (`npm i -g supabase`, scoop, ou winget)

### 3.2 Layout de pastas

```
bolao/
├── app/
│   ├── (public)/
│   │   ├── layout.tsx
│   │   └── page.tsx                    # placeholder pra feature 3
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx              # placeholder
│   │   └── auth/callback/route.ts      # placeholder; handler real na feature 4
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   └── dashboard/page.tsx          # placeholder
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   └── admin/page.tsx              # placeholder
│   ├── api/                            # vazio nesta feature
│   ├── layout.tsx                      # root: <html>, fontes, <Toaster/>, metadata
│   ├── globals.css                     # tokens via @theme + base
│   ├── not-found.tsx
│   └── error.tsx
├── lib/
│   ├── supabase/
│   │   ├── browser.ts
│   │   ├── server.ts
│   │   ├── admin.ts
│   │   ├── middleware.ts
│   │   └── types.ts                    # placeholder; feature 2 substitui
│   ├── env.ts                          # parse de process.env via Zod
│   ├── utils.ts                        # cn() helper
│   └── __tests__/
│       └── utils.test.ts               # smoke test
├── components/                         # vazio; populado feature-a-feature
├── supabase/                           # gerenciado pelo Supabase CLI
│   ├── config.toml                     # gerado por `supabase init`
│   ├── migrations/                     # vazio nesta feature
│   └── seed.sql                        # vazio nesta feature
├── docs/
│   ├── prototype/                      # já existe
│   └── superpowers/{specs,plans}/      # specs e planos de feature
├── public/                             # vazio nesta feature
├── middleware.ts
├── next.config.mjs
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
├── .prettierrc.json
├── .prettierignore
├── vitest.config.ts
├── vitest.setup.ts
├── .env.local                          # gitignored
├── .env.local.example                  # versionado
├── .nvmrc
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── README.md
└── CLAUDE.md                           # já existe
```

**Decisões importantes:**

- Route groups `(public)/(auth)/(dashboard)/(admin)` agrupam layouts mas **não viram URL**.
- Não há `tailwind.config.ts`: Tailwind v4 dispensa.
- Não há `components/ui/`: sem shadcn, primitivos Radix são wrappados feature-a-feature.
- `lib/supabase/admin.ts` é marcado com `import 'server-only';` no topo — bundle quebra se o client tentar importar.

### 3.3 Clients Supabase e middleware

#### `lib/supabase/browser.ts`

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

Uso: Client Components que precisam de Realtime, ações triggered no browser. Sessão em cookies, todas queries passam por RLS.

#### `lib/supabase/server.ts`

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
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // chamado em RSC: middleware é quem renova a sessão
          }
        },
      },
    },
  );
}
```

Uso: RSCs, Server Actions, Route Handlers. Anon key + RLS — age "como o usuário logado".

#### `lib/supabase/admin.ts`

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

export function createSupabaseAdminClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

Uso: webhook do Asaas, recálculo de pontos, jobs admin. **Bypass de RLS** — usar com cuidado. `persistSession: false` é crítico em serverless.

#### `lib/supabase/middleware.ts`

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
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida JWT no servidor (vs getSession que só lê cookie)
  await supabase.auth.getUser();

  return response;
}
```

#### `middleware.ts` (root)

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

**Lógica de redirect (não-logado → login, logado → dashboard) NÃO entra aqui.** Fica pra feature 4. Esta feature só renova sessão.

### 3.4 Configurações de tooling

#### `tsconfig.json`

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

#### `eslint.config.mjs` (ESLint v9 flat config)

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

#### `.prettierrc.json`

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

#### `.prettierignore`

```
.next
node_modules
pnpm-lock.yaml
supabase/.temp
supabase/.branches
```

#### `app/globals.css`

```css
@import "tailwindcss";

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
  --color-brasil-yellow: #FEDF00;

  --font-display: "Bebas Neue", sans-serif;
  --font-body: "Archivo", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
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

#### `postcss.config.mjs`

```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

#### `next.config.mjs`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'rvprwtrcpdyoljlekxdx.supabase.co' },
    ],
  },
};

export default nextConfig;
```

#### `vitest.config.ts`

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

#### `vitest.setup.ts`

```ts
import '@testing-library/jest-dom/vitest';
```

#### `.nvmrc`

```
22
```

### 3.5 Env vars

#### `.env.local.example` (versionado)

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

#### `lib/env.ts`

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

Asaas e API-Football ficam fora do schema por enquanto. Adicioná-los antes da feature deles vai forçar `pnpm dev` a falhar — comportamento desejado, mas só na hora certa.

### 3.6 Utils e smoke test

#### `lib/utils.ts`

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

#### `lib/__tests__/utils.test.ts`

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

### 3.7 Scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,css}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,css}\"",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "test:ui": "vitest --ui",
    "supabase:types": "supabase gen types typescript --linked > lib/supabase/types.ts"
  }
}
```

### 3.8 README mínimo

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
3. `cp .env.local.example .env.local` e preencha as keys do Supabase.
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

---

## 4. Plano de commits (sequência de execução)

| # | Mensagem | Conteúdo | Critério de pronto |
|---|---|---|---|
| 1 | `chore: scaffold Next.js 14 with TypeScript and Tailwind v4` | `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `app/{layout,page,globals.css}`, `app/(public)/page.tsx` placeholder, fontes via `next/font`, tokens `@theme`, `.nvmrc`, `.gitignore` expandido | `pnpm dev` sobe; página inicial usa Bebas Neue/Archivo; `pnpm typecheck` passa |
| 2 | `chore: configure linting, formatting, and Vitest` | `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `vitest.setup.ts`, `lib/utils.ts`, `lib/__tests__/utils.test.ts` | `pnpm lint`, `pnpm format:check`, `pnpm test:run` passam |
| 3 | `chore: scaffold Supabase clients and migrations workflow` | `lib/supabase/{browser,server,admin,types}.ts`, `lib/env.ts`, `.env.local.example`, `supabase/config.toml` (via `supabase init`) | `pnpm typecheck` passa com env preenchido; `lib/supabase/types.ts` é placeholder vazio (`export type Database = { public: { Tables: {} } }`) |
| 4 | `chore: add Next.js middleware for auth session refresh` | `middleware.ts` (root), `lib/supabase/middleware.ts` | `pnpm dev` sobe sem erros; request a `/` retorna 200; cookie de sessão é setado no response (validação manual) |
| 5 | `chore: scaffold app route groups and base layouts` | `app/(public)/layout.tsx`, `app/(auth)/{layout.tsx,login/page.tsx,auth/callback/route.ts}`, `app/(dashboard)/{layout.tsx,dashboard/page.tsx}`, `app/(admin)/{layout.tsx,admin/page.tsx}`, `app/{not-found,error}.tsx` | `pnpm build` produz todas as rotas; todas retornam 200 em dev |
| 6 | `chore: add Radix primitives and sonner` | Instala 6 packages Radix + sonner, `<Toaster/>` em `app/layout.tsx`, README finalizado | `pnpm typecheck` + `pnpm lint` + `pnpm test:run` todos verdes |

**Nota sobre git init:** o repositório recebeu `git init` durante a fase de brainstorming (pra commitar este spec antes da implementação começar). Um `.gitignore` mínimo foi criado nesse ponto cobrindo apenas:

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
```

O commit 1 expande pra cobrir `.next/`, `node_modules/`, `*.tsbuildinfo`, `coverage/`, `next-env.d.ts`, etc.

---

## 5. Critério de pronto da feature

- [ ] `pnpm install` roda limpo
- [ ] `pnpm dev` sobe sem warning de env var ausente (com `.env.local` preenchido)
- [ ] `pnpm build` produz bundle sem erro
- [ ] `pnpm typecheck` passa com zero erros
- [ ] `pnpm lint` passa com zero warnings
- [ ] `pnpm test:run` passa (smoke test verde)
- [ ] Todas as rotas placeholder respondem 200 (`/`, `/login`, `/dashboard`, `/admin`)
- [ ] Tipografia do protótipo aplicada (visual rápido na home: Bebas Neue, Archivo)
- [ ] `git log --oneline` mostra 6 commits temáticos limpos

---

## 6. Steps manuais que o desenvolvedor executa

Não dá pra automatizar via tool de agente:

1. `supabase login` — abre browser pra auth, gera token local.
2. Pegar a `service_role` key no painel do Supabase Cloud → cola direto em `.env.local`. **Nunca pasta no chat.**
3. (Após commit 3) `supabase link --project-ref rvprwtrcpdyoljlekxdx` — pede senha do banco; gera `.supabase/` localmente.
4. (Após commit 3) `pnpm supabase:types` — popula `lib/supabase/types.ts` (vai retornar `{}` enquanto não houver tabelas, mas valida que o link funcionou).

---

## 7. Riscos e pontos cegos

- **Windows + symlinks do pnpm:** se aparecer `EPERM symlink` durante `pnpm install`, ativar Developer Mode no Windows ou rodar terminal como admin.
- **Tailwind v4 + IDE:** o IntelliSense do Tailwind pro VSCode precisa do plugin v0.10+ pra entender `@theme`. Não bloqueia, mas avisa se autocomplete não funcionar.
- **`getUser()` no middleware** faz round-trip ao Supabase Auth a cada request. OK em dev; em prod pode ser otimizado depois com cache de cookie ou matcher mais restrito.
- **Service role key não foi colada em chat** (correto). Precisa estar em `.env.local` antes do commit 4 (middleware), senão `lib/env.ts` falha. Marcado como step manual #2.
- **`ASAAS_*` e `API_FOOTBALL_KEY`** não estão no schema do `lib/env.ts` por enquanto. Quando feature 6 / 12 entrarem, adicionar ao schema vai forçar `pnpm dev` a falhar até serem preenchidas — comportamento desejado.

---

## 8. O que esta feature NÃO entrega (ano-de-âncora pra evitar scope creep)

- Schema/migrations do banco → feature 2
- Landing page real → feature 3
- Auth (magic link, callback, redirects) → feature 4
- Lógica de pontuação → feature 5
- Asaas SDK + checkout → feature 6
- API-Football client → feature 12
- Playwright → feature 6 ou 7 (quando houver fluxo real)
- husky / lint-staged → escolha Q6
- GitHub Actions CI → feature 5 (quando houver regra crítica)
- shadcn/ui → escolha Q4
- Wrappers UI sobre Radix (`components/ui/`) → entram feature-a-feature, conforme cada feature precise
