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
