# Bolão Copa 2026

Sistema de bolão da Copa do Mundo FIFA 2026.

## Pré-requisitos

- Node 22 LTS (ver `.nvmrc`)
- pnpm 9+
- Supabase CLI (`npm i -g supabase` ou via scoop/winget)
- Acesso ao projeto Supabase compartilhado (peça ao Jonatas pra te adicionar). Se preferir, crie seu próprio projeto e troque o `--project-ref` no passo 5.

## Setup local

1. Clone o repo e entre na pasta.
2. `pnpm install`
3. `cp .env.local.example .env.local` e preencha as keys do Supabase (a `service_role` é pegada no painel do Supabase, NUNCA cole em chat). Veja `.env.local.example` pra lista completa de variáveis (Asaas e API-Football são preenchidas nas Features 6 e 12).
4. `supabase login` (interativo, abre browser)
5. `supabase link --project-ref rvprwtrcpdyoljlekxdx`
6. `pnpm supabase:types` (popula `lib/supabase/types.ts`)
7. `pnpm dev`

## Scripts

- `pnpm dev` — Next dev server
- `pnpm build` — production build
- `pnpm lint` — ESLint
- `pnpm lint:fix` — ESLint com `--fix`
- `pnpm format` — Prettier (write)
- `pnpm format:check` — Prettier (check)
- `pnpm typecheck` — TypeScript sem emitir
- `pnpm test` — Vitest watch
- `pnpm test:run` — Vitest single run
- `pnpm test:ui` — Vitest com UI
- `pnpm supabase:types` — regenera `lib/supabase/types.ts` a partir do projeto linkado

## Documentação interna

- `CLAUDE.md` — charter do projeto
- `docs/prototype/` — protótipo HTML de referência
- `docs/superpowers/specs/` — design docs por feature
- `docs/superpowers/plans/` — planos de implementação por feature
