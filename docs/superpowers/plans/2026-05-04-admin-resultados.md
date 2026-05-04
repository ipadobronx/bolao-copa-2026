# Feature 10 — Admin: Entrada de Resultados + Recálculo de Pontos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar `/admin/jogos` com inserção de placares, resolução de placeholders de mata-mata, recálculo de pontos via Server Routes Node.js, e formulário de `copa_resultados` para bônus.

**Architecture:** Server Component busca todos os jogos + `copa_resultados` + seleções; passa para um Client Component que gerencia tabs/filtros/estado local. Mutações vão para Server Routes (`POST /api/admin/recalcular`, `PUT /api/admin/copa-resultados`, `PATCH /api/admin/jogos/[id]`) que usam `createSupabaseAdminClient()` com `service_role`. Recálculo global é assíncrono com fire-and-forget; observabilidade via tabela `recalculo_jobs` + Supabase Realtime no client.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase JS v2, Zod, Sonner (toasts), Lucide Icons, Tailwind v4.

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `supabase/migrations/20260504000000_recalculo_jobs.sql` | Criar | Tabela `recalculo_jobs` + RLS + Realtime |
| `lib/recalculo.ts` | Criar | Funções puras: `calcularUpdatesPalpites`, `calcularUpdateBonus` |
| `lib/__tests__/recalculo.test.ts` | Criar | Testes TDD de `lib/recalculo.ts` |
| `app/api/admin/recalcular/route.ts` | Criar | POST — tipo jogo/bonus/global + `processarGlobal` |
| `app/api/admin/copa-resultados/route.ts` | Criar | GET + PUT copa_resultados |
| `app/api/admin/jogos/[id]/route.ts` | Criar | PATCH — resolve placeholder (selecao_casa_id/fora_id) |
| `app/api/admin/recalculo-jobs/[id]/route.ts` | Criar | GET status do job + watchdog de timeout |
| `components/admin/PlaceholderSelect.tsx` | Criar | Select de seleção para resolver placeholder de mata-mata |
| `components/admin/JogoRow.tsx` | Criar | Linha editável de jogo (máquina de estados: grupo/mata-mata × pendente/placeholder/finalizado) |
| `components/admin/BonusForm.tsx` | Criar | Formulário copa_resultados com salvar por campo |
| `components/admin/RecalculoGlobalStatus.tsx` | Criar | Widget Realtime do job de recálculo global |
| `app/(admin)/admin/jogos/page.tsx` | Criar | Server Component — busca dados, determina tab inicial |
| `app/(admin)/admin/jogos/JogosClient.tsx` | Criar | Client Component — tabs, filtros, lista de JogoRow |
| `components/admin/AdminSidebar.tsx` | Modificar | Ativar link "Jogos & Resultados" (de span → Link) |
| `app/(admin)/admin/page.tsx` | Modificar | Adicionar `RecalculoGlobalStatus` na seção "Ações do sistema" |

---

## Task 1: Migration — tabela `recalculo_jobs`

**Files:**
- Create: `supabase/migrations/20260504000000_recalculo_jobs.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/20260504000000_recalculo_jobs.sql
-- F10: tabela de jobs para recálculo global assíncrono
-- Spec: docs/superpowers/specs/2026-05-04-admin-resultados-design.md §9

CREATE TABLE public.recalculo_jobs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  escopo            text        NOT NULL CHECK (escopo IN ('jogo', 'bonus', 'global')),
  jogo_id           smallint    REFERENCES public.jogos(id),
  bonus_tipos       text[],
  status            text        NOT NULL DEFAULT 'processando'
                                CHECK (status IN ('processando', 'concluido', 'erro')),
  total_processados int,
  erro_msg          text,
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz
);

ALTER TABLE public.recalculo_jobs ENABLE ROW LEVEL SECURITY;

-- Apenas admins autenticados podem ler; writes via service_role (sem policy = bloqueado)
CREATE POLICY "admins can read jobs"
  ON public.recalculo_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Habilita Realtime para feedback de progresso no client
ALTER PUBLICATION supabase_realtime ADD TABLE public.recalculo_jobs;
```

- [ ] **Step 2: Aplicar a migration localmente**

```bash
npx supabase db push
```

Esperado: linha `Applying migration 20260504000000_recalculo_jobs.sql... done`

- [ ] **Step 3: Verificar que a tabela existe**

```bash
npx supabase db diff --use-migra
```

Esperado: output vazio (schema está sincronizado).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260504000000_recalculo_jobs.sql
git commit -m "feat(F10): migration recalculo_jobs — tabela + RLS + Realtime"
```

---

## Task 2: `lib/recalculo.ts` — TDD

**Files:**
- Create: `lib/__tests__/recalculo.test.ts`
- Create: `lib/recalculo.ts`

- [ ] **Step 1: Escrever os testes (TDD — escreva ANTES da implementação)**

```ts
// lib/__tests__/recalculo.test.ts
import { describe, it, expect } from 'vitest'
import { calcularUpdatesPalpites, calcularUpdateBonus } from '../recalculo'
import type { CopaResultadosInput } from '../pontuacao'

const COPA: CopaResultadosInput = {
  campeao_id: 10,
  vice_id: 11,
  terceiro_id: 12,
  quarto_id: 13,
  artilheiro_nome: 'Mbappe',
  revelacao_id: 14,
}

// ────────────────────────────────────────────────────────────
// calcularUpdatesPalpites
// ────────────────────────────────────────────────────────────
describe('calcularUpdatesPalpites', () => {
  const jogoGrupos = { fase: 'grupos' as const, gols_casa: 2, gols_fora: 1 }
  const jogoFinal  = { fase: 'final' as const,  gols_casa: 2, gols_fora: 1 }

  it('placar exato → 10 pts', () => {
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 2, gols_fora: 1 }],
      jogoGrupos,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 10 }])
  })

  it('vencedor + saldo correto → 7 pts', () => {
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 3, gols_fora: 2 }],
      jogoGrupos,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 7 }])
  })

  it('só vencedor (saldo errado) → 5 pts', () => {
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 3, gols_fora: 1 }],
      jogoGrupos,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 5 }])
  })

  it('parcial — acertou gols_casa mas errou vencedor → 2 pts', () => {
    // Real: 2×1 (casa vence). Palpite: 2×3 (fora vence) — gols_casa bateu
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 2, gols_fora: 3 }],
      jogoGrupos,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 2 }])
  })

  it('erro total → 0 pts', () => {
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 0, gols_fora: 3 }],
      jogoGrupos,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 0 }])
  })

  it('fase final multiplica por 4 — exato → 40 pts', () => {
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 2, gols_fora: 1 }],
      jogoFinal,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 40 }])
  })

  it('múltiplos palpites calculados independentemente', () => {
    const r = calcularUpdatesPalpites(
      [
        { id: 'p1', gols_casa: 2, gols_fora: 1 }, // exato → 10
        { id: 'p2', gols_casa: 0, gols_fora: 3 }, // erro  →  0
      ],
      jogoGrupos,
    )
    expect(r).toEqual([
      { id: 'p1', pontos_calculados: 10 },
      { id: 'p2', pontos_calculados: 0 },
    ])
  })

  it('idempotência — rodar 2x produz mesmo resultado', () => {
    const input = [{ id: 'p1', gols_casa: 2, gols_fora: 1 }]
    expect(calcularUpdatesPalpites(input, jogoGrupos)).toEqual(
      calcularUpdatesPalpites(input, jogoGrupos),
    )
  })

  it('lista vazia → array vazio', () => {
    expect(calcularUpdatesPalpites([], jogoGrupos)).toEqual([])
  })
})

// ────────────────────────────────────────────────────────────
// calcularUpdateBonus
// ────────────────────────────────────────────────────────────
describe('calcularUpdateBonus', () => {
  it('acertou campeão → 50 pts', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'campeao', selecao_id: 10 }],
      COPA,
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 50 }])
  })

  it('errou campeão → 0 pts', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'campeao', selecao_id: 5 }],
      COPA,
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 0 }])
  })

  it('artilheiro com acento normalizado → 25 pts', () => {
    // 'Mbappé' deve igualar 'Mbappe' após normalização
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'artilheiro', jogador_nome: 'Mbappé' }],
      COPA,
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 25 }])
  })

  it('resultado null no banco (vice não definido) → 0 pts', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'vice', selecao_id: 11 }],
      { ...COPA, vice_id: null },
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 0 }])
  })

  it('selecao_id null no bilhete → 0 pts', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'campeao', selecao_id: null }],
      COPA,
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 0 }])
  })

  it('jogador_nome null no bilhete → 0 pts', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'artilheiro', jogador_nome: null }],
      COPA,
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 0 }])
  })

  it('filtro de tipo — só recalcula campeão, ignora vice', () => {
    const rows = [
      { id: 'b1', tipo: 'campeao' as const, selecao_id: 10 },
      { id: 'b2', tipo: 'vice'   as const, selecao_id: 11 },
    ]
    const r = calcularUpdateBonus(rows, COPA, ['campeao'])
    expect(r).toHaveLength(1)
    expect(r[0]).toEqual({ id: 'b1', pontos_calculados: 50 })
  })

  it('filtro vazio → array vazio', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'campeao', selecao_id: 10 }],
      COPA,
      [],
    )
    expect(r).toEqual([])
  })

  it('sem filtro — processa todos os tipos', () => {
    const rows = [
      { id: 'b1', tipo: 'campeao'   as const, selecao_id: 10 },
      { id: 'b2', tipo: 'vice'      as const, selecao_id: 11 },
      { id: 'b3', tipo: 'revelacao' as const, selecao_id: 14 },
    ]
    const r = calcularUpdateBonus(rows, COPA)
    expect(r).toHaveLength(3)
    expect(r.find(x => x.id === 'b1')?.pontos_calculados).toBe(50) // campeão
    expect(r.find(x => x.id === 'b2')?.pontos_calculados).toBe(30) // vice
    expect(r.find(x => x.id === 'b3')?.pontos_calculados).toBe(15) // revelação
  })
})
```

- [ ] **Step 2: Rodar os testes para verificar que FALHAM**

```bash
npx vitest run lib/__tests__/recalculo.test.ts
```

Esperado: `FAIL — Cannot find module '../recalculo'`

- [ ] **Step 3: Implementar `lib/recalculo.ts`**

```ts
// lib/recalculo.ts
import { calcularPontosPalpite, calcularPontosBonus } from './pontuacao'
import type { FaseJogo, TipoBonus, CopaResultadosInput } from './pontuacao'

export type PalpiteRow = {
  id: string
  gols_casa: number
  gols_fora: number
}

export type JogoFinalizado = {
  fase: FaseJogo
  gols_casa: number
  gols_fora: number
}

export type BonusRow = {
  id: string
  tipo: TipoBonus
  selecao_id?: number | null
  jogador_nome?: string | null
}

export type UpdatePayload = {
  id: string
  pontos_calculados: number
}

export function calcularUpdatesPalpites(
  palpites: PalpiteRow[],
  jogo: JogoFinalizado,
): UpdatePayload[] {
  const jogoInput = {
    fase: jogo.fase,
    finalizado: true as const,
    gols_casa: jogo.gols_casa,
    gols_fora: jogo.gols_fora,
  }
  return palpites.map((p) => ({
    id: p.id,
    pontos_calculados: calcularPontosPalpite(
      { gols_casa: p.gols_casa, gols_fora: p.gols_fora },
      jogoInput,
    ).total,
  }))
}

export function calcularUpdateBonus(
  bonusRows: BonusRow[],
  resultados: CopaResultadosInput,
  filtroTipos?: TipoBonus[],
): UpdatePayload[] {
  const rows =
    filtroTipos !== undefined
      ? bonusRows.filter((b) => filtroTipos.includes(b.tipo))
      : bonusRows

  return rows.map((b) => {
    let pontos = 0
    if (b.tipo === 'artilheiro') {
      if (b.jogador_nome != null) {
        pontos = calcularPontosBonus(
          { tipo: 'artilheiro', jogador_nome: b.jogador_nome },
          resultados,
        ).pontos
      }
    } else if (b.selecao_id != null) {
      pontos = calcularPontosBonus(
        { tipo: b.tipo, selecao_id: b.selecao_id },
        resultados,
      ).pontos
    }
    return { id: b.id, pontos_calculados: pontos }
  })
}
```

- [ ] **Step 4: Rodar os testes para verificar que PASSAM**

```bash
npx vitest run lib/__tests__/recalculo.test.ts --reporter=verbose
```

Esperado: todos os 12 testes PASS. Cobertura: rodar com `--coverage` e verificar ≥ 95%.

```bash
npx vitest run lib/__tests__/recalculo.test.ts --coverage
```

- [ ] **Step 5: Commit**

```bash
git add lib/recalculo.ts lib/__tests__/recalculo.test.ts
git commit -m "feat(F10): lib/recalculo.ts puro — calcularUpdatesPalpites + calcularUpdateBonus (TDD)"
```

---

## Task 3: `POST /api/admin/recalcular` — tipo `'jogo'`

**Files:**
- Create: `app/api/admin/recalcular/route.ts`

**Padrão de auth** (igual ao `app/api/admin/ranking-snapshot/route.ts`):
1. `createSupabaseServerClient()` para verificar usuário autenticado
2. `supabase.from('profiles').select('is_admin')` para checar admin
3. `createSupabaseAdminClient()` para operações de dados

- [ ] **Step 1: Criar o arquivo com o schema Zod e o handler para tipo `'jogo'`**

```ts
// app/api/admin/recalcular/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { calcularUpdatesPalpites, calcularUpdateBonus } from '@/lib/recalculo'
import type { TipoBonus, CopaResultadosInput } from '@/lib/pontuacao'
import type { JogoFinalizado, PalpiteRow, BonusRow } from '@/lib/recalculo'

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const tiposBonusEnum = z.enum([
  'campeao', 'vice', 'terceiro', 'quarto', 'artilheiro', 'revelacao',
])

const bodySchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('jogo'),
    jogoId: z.number().int().positive(),
    gols_casa: z.number().int().min(0).optional(),
    gols_fora: z.number().int().min(0).optional(),
  }),
  z.object({
    tipo: z.literal('bonus'),
    bonusTipos: z.array(tiposBonusEnum).optional(),
  }),
  z.object({ tipo: z.literal('global') }),
])

// ─── Helper: verificar admin ──────────────────────────────────────────────────

async function verificarAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return { error: 'Acesso negado', status: 403 as const }

  return { admin: createSupabaseAdminClient() }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = await verificarAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { admin } = auth

  const raw = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const body = parsed.data

  // ── tipo: 'jogo' ──────────────────────────────────────────────────────────
  if (body.tipo === 'jogo') {
    const { jogoId, gols_casa, gols_fora } = body

    // 1. Se vieram gols, atualiza o jogo e marca como finalizado
    if (gols_casa !== undefined && gols_fora !== undefined) {
      const { error: jogoErr } = await admin
        .from('jogos')
        .update({ gols_casa, gols_fora, finalizado: true })
        .eq('id', jogoId)
      if (jogoErr) {
        return NextResponse.json({ error: jogoErr.message }, { status: 500 })
      }
    }

    // 2. Busca dados atuais do jogo (após possível UPDATE)
    const { data: jogoData, error: fetchJogoErr } = await admin
      .from('jogos')
      .select('fase, gols_casa, gols_fora, finalizado')
      .eq('id', jogoId)
      .single()

    if (fetchJogoErr || !jogoData) {
      return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })
    }
    if (!jogoData.finalizado) {
      return NextResponse.json({ error: 'Jogo não está finalizado' }, { status: 400 })
    }
    if (jogoData.gols_casa == null || jogoData.gols_fora == null) {
      return NextResponse.json({ error: 'Placar incompleto no banco' }, { status: 400 })
    }

    const jogo: JogoFinalizado = {
      fase: jogoData.fase as JogoFinalizado['fase'],
      gols_casa: jogoData.gols_casa,
      gols_fora: jogoData.gols_fora,
    }

    // 3. Busca IDs de bilhetes confirmados
    const { data: confirmedBilhetes } = await admin
      .from('bilhetes')
      .select('id')
      .eq('status_pagamento', 'confirmado')
    const confirmedIds = confirmedBilhetes?.map((b) => b.id) ?? []

    if (confirmedIds.length === 0) {
      return NextResponse.json({ total: 0 })
    }

    // 4. Busca palpites do jogo de bilhetes confirmados
    const { data: palpitesData, error: palpitesErr } = await admin
      .from('palpites')
      .select('id, gols_casa, gols_fora')
      .eq('jogo_id', jogoId)
      .in('bilhete_id', confirmedIds)

    if (palpitesErr) {
      return NextResponse.json({ error: palpitesErr.message }, { status: 500 })
    }

    const palpites: PalpiteRow[] = (palpitesData ?? []).map((p) => ({
      id: p.id,
      gols_casa: p.gols_casa,
      gols_fora: p.gols_fora,
    }))

    // 5. Calcula e aplica updates (idempotente via upsert)
    const updates = calcularUpdatesPalpites(palpites, jogo)
    if (updates.length > 0) {
      const { error: updateErr } = await admin
        .from('palpites')
        .upsert(updates, { onConflict: 'id' })
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ total: updates.length })
  }

  // ── tipo: 'bonus' e 'global' — implementados na Task 4 ───────────────────
  return NextResponse.json({ error: 'tipo não suportado ainda' }, { status: 501 })
}
```

- [ ] **Step 2: Testar manualmente com curl**

Primeiro certifique-se de estar autenticado como admin via o browser. Depois:

```bash
# Substitua COOKIE pelo valor do cookie de sessão do browser (DevTools → Application → Cookies)
curl -X POST http://localhost:3000/api/admin/recalcular \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project>-auth-token=<token>" \
  -d '{"tipo":"jogo","jogoId":1,"gols_casa":2,"gols_fora":1}'
```

Esperado: `{"total": N}` onde N é o número de palpites recalculados.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/recalcular/route.ts
git commit -m "feat(F10): POST /api/admin/recalcular tipo jogo"
```

---

## Task 4: `POST /api/admin/recalcular` — tipos `'bonus'` e `'global'`

**Files:**
- Modify: `app/api/admin/recalcular/route.ts`

Substitua o bloco `// ── tipo: 'bonus' e 'global' — implementados na Task 4` por:

- [ ] **Step 1: Implementar helper `recalcularBonus` (função interna ao arquivo)**

Adicione antes do `export async function POST`:

```ts
// ─── Helper: recalcular bônus de uma lista de tipos ──────────────────────────

async function recalcularBonus(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  bonusTipos?: TipoBonus[],
): Promise<{ total: number; error?: string }> {
  // 1. Copa resultados
  const { data: copaData } = await admin
    .from('copa_resultados')
    .select('campeao_id, vice_id, terceiro_id, quarto_id, artilheiro_nome, revelacao_id')
    .eq('id', 1)
    .single()

  if (!copaData) return { total: 0 }

  const resultados: CopaResultadosInput = {
    campeao_id: copaData.campeao_id,
    vice_id: copaData.vice_id,
    terceiro_id: copaData.terceiro_id,
    quarto_id: copaData.quarto_id,
    artilheiro_nome: copaData.artilheiro_nome,
    revelacao_id: copaData.revelacao_id,
  }

  // 2. IDs de bilhetes confirmados
  const { data: confirmedBilhetes } = await admin
    .from('bilhetes')
    .select('id')
    .eq('status_pagamento', 'confirmado')
  const confirmedIds = confirmedBilhetes?.map((b) => b.id) ?? []
  if (confirmedIds.length === 0) return { total: 0 }

  // 3. Busca bonus rows filtradas por tipo (se fornecido)
  let query = admin
    .from('palpites_bonus')
    .select('id, tipo, selecao_id, jogador_nome')
    .in('bilhete_id', confirmedIds)

  if (bonusTipos && bonusTipos.length > 0) {
    query = query.in('tipo', bonusTipos)
  }

  const { data: bonusData, error: bonusErr } = await query
  if (bonusErr) return { total: 0, error: bonusErr.message }

  const bonusRows: BonusRow[] = (bonusData ?? []).map((b) => ({
    id: b.id,
    tipo: b.tipo as TipoBonus,
    selecao_id: b.selecao_id,
    jogador_nome: b.jogador_nome,
  }))

  // 4. Calcula e aplica updates
  const updates = calcularUpdateBonus(bonusRows, resultados, bonusTipos)
  if (updates.length > 0) {
    const { error: updateErr } = await admin
      .from('palpites_bonus')
      .upsert(updates, { onConflict: 'id' })
    if (updateErr) return { total: 0, error: updateErr.message }
  }

  return { total: updates.length }
}
```

- [ ] **Step 2: Implementar helper `processarGlobal` (fire-and-forget)**

Adicione após `recalcularBonus`:

```ts
// ─── Helper: processamento global assíncrono ─────────────────────────────────

async function processarGlobal(
  jobId: string,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<void> {
  let total = 0

  try {
    // 1. IDs de bilhetes confirmados (busca uma vez, reutiliza)
    const { data: confirmedBilhetes } = await admin
      .from('bilhetes')
      .select('id')
      .eq('status_pagamento', 'confirmado')
    const confirmedIds = confirmedBilhetes?.map((b) => b.id) ?? []

    // 2. Todos os jogos finalizados
    const { data: jogosFinalizados } = await admin
      .from('jogos')
      .select('id, fase, gols_casa, gols_fora')
      .eq('finalizado', true)

    for (const jogo of jogosFinalizados ?? []) {
      if (jogo.gols_casa == null || jogo.gols_fora == null) continue

      const jogoInput: JogoFinalizado = {
        fase: jogo.fase as JogoFinalizado['fase'],
        gols_casa: jogo.gols_casa,
        gols_fora: jogo.gols_fora,
      }

      const { data: palpitesData } = await admin
        .from('palpites')
        .select('id, gols_casa, gols_fora')
        .eq('jogo_id', jogo.id)
        .in('bilhete_id', confirmedIds)

      const palpites: PalpiteRow[] = (palpitesData ?? []).map((p) => ({
        id: p.id,
        gols_casa: p.gols_casa,
        gols_fora: p.gols_fora,
      }))

      const updates = calcularUpdatesPalpites(palpites, jogoInput)
      if (updates.length > 0) {
        await admin.from('palpites').upsert(updates, { onConflict: 'id' })
        total += updates.length
      }
    }

    // 3. Recalcula todos os bônus
    const bonusResult = await recalcularBonus(admin)
    total += bonusResult.total

    // 4. Marca job como concluído
    await admin
      .from('recalculo_jobs')
      .update({ status: 'concluido', total_processados: total, finished_at: new Date().toISOString() })
      .eq('id', jobId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    await admin
      .from('recalculo_jobs')
      .update({ status: 'erro', erro_msg: msg, finished_at: new Date().toISOString() })
      .eq('id', jobId)
  }
}
```

- [ ] **Step 3: Substituir o bloco `501` no POST handler pelos casos 'bonus' e 'global'**

Substitua `return NextResponse.json({ error: 'tipo não suportado ainda' }, { status: 501 })` por:

```ts
  // ── tipo: 'bonus' ────────────────────────────────────────────────────────
  if (body.tipo === 'bonus') {
    const result = await recalcularBonus(admin, body.bonusTipos as TipoBonus[] | undefined)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ total: result.total })
  }

  // ── tipo: 'global' ───────────────────────────────────────────────────────
  if (body.tipo === 'global') {
    const { data: job, error: jobErr } = await admin
      .from('recalculo_jobs')
      .insert({ escopo: 'global', status: 'processando' })
      .select('id')
      .single()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Falha ao criar job' }, { status: 500 })
    }

    // Fire-and-forget: Vercel Fluid Compute mantém o processo vivo após o retorno
    processarGlobal(job.id, createSupabaseAdminClient()).catch((err) => {
      console.error('[recalcular-global] erro não capturado:', err)
    })

    return NextResponse.json({ jobId: job.id }, { status: 202 })
  }

  return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/recalcular/route.ts
git commit -m "feat(F10): POST /api/admin/recalcular tipos bonus + global (fire-and-forget)"
```

---

## Task 5: `GET + PUT /api/admin/copa-resultados` e rotas auxiliares

**Files:**
- Create: `app/api/admin/copa-resultados/route.ts`
- Create: `app/api/admin/jogos/[id]/route.ts`
- Create: `app/api/admin/recalculo-jobs/[id]/route.ts`

- [ ] **Step 1: Criar `app/api/admin/copa-resultados/route.ts`**

```ts
// app/api/admin/copa-resultados/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { calcularUpdateBonus } from '@/lib/recalculo'
import type { TipoBonus } from '@/lib/pontuacao'
import type { BonusRow } from '@/lib/recalculo'

async function verificarAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 as const }
  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Acesso negado', status: 403 as const }
  return { admin: createSupabaseAdminClient() }
}

export async function GET() {
  const auth = await verificarAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.admin
    .from('copa_resultados')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

const CAMPO_PARA_TIPO: Record<string, TipoBonus> = {
  campeao_id:      'campeao',
  vice_id:         'vice',
  terceiro_id:     'terceiro',
  quarto_id:       'quarto',
  artilheiro_nome: 'artilheiro',
  revelacao_id:    'revelacao',
}

const putSchema = z.object({
  campeao_id:      z.number().int().positive().nullable().optional(),
  vice_id:         z.number().int().positive().nullable().optional(),
  terceiro_id:     z.number().int().positive().nullable().optional(),
  quarto_id:       z.number().int().positive().nullable().optional(),
  artilheiro_nome: z.string().min(1).nullable().optional(),
  revelacao_id:    z.number().int().positive().nullable().optional(),
  finalizada:      z.boolean().optional(),
})

export async function PUT(req: Request) {
  const auth = await verificarAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  const raw = await req.json().catch(() => null)
  const parsed = putSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const body = parsed.data

  // Se tentar marcar como finalizada, validar campos obrigatórios
  if (body.finalizada === true) {
    const { data: current } = await admin
      .from('copa_resultados').select('*').eq('id', 1).single()
    const merged = { ...current, ...body }
    if (!merged.campeao_id || !merged.vice_id || !merged.terceiro_id ||
        !merged.quarto_id  || !merged.artilheiro_nome) {
      return NextResponse.json(
        { error: 'Preencha campeão, vice, 3º, 4º e artilheiro antes de finalizar' },
        { status: 400 },
      )
    }
  }

  // Atualiza copa_resultados (trigger set_updated_at cuida do updated_at)
  const { error: updateErr } = await admin
    .from('copa_resultados')
    .update(body)
    .eq('id', 1)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Identifica quais tipos de bônus foram afetados
  const tiposAfetados = Object.keys(body)
    .filter((k) => k in CAMPO_PARA_TIPO && body[k as keyof typeof body] !== undefined)
    .map((k) => CAMPO_PARA_TIPO[k]) as TipoBonus[]

  if (tiposAfetados.length === 0) {
    return NextResponse.json({ updated: true, total_bonus_recalculados: 0 })
  }

  // Dispara recálculo dos tipos afetados via fetch interno
  let totalBonus = 0
  try {
    const { data: copaData } = await admin
      .from('copa_resultados').select('*').eq('id', 1).single()
    const { data: confirmedBilhetes } = await admin
      .from('bilhetes').select('id').eq('status_pagamento', 'confirmado')
    const confirmedIds = confirmedBilhetes?.map((b) => b.id) ?? []

    if (copaData && confirmedIds.length > 0) {
      const { data: bonusData } = await admin
        .from('palpites_bonus')
        .select('id, tipo, selecao_id, jogador_nome')
        .in('bilhete_id', confirmedIds)
        .in('tipo', tiposAfetados)

      const updates = calcularUpdateBonus(
        (bonusData ?? []).map((b): BonusRow => ({
          id: b.id,
          tipo: b.tipo as TipoBonus,
          selecao_id: b.selecao_id,
          jogador_nome: b.jogador_nome,
        })),
        {
          campeao_id: copaData.campeao_id,
          vice_id: copaData.vice_id,
          terceiro_id: copaData.terceiro_id,
          quarto_id: copaData.quarto_id,
          artilheiro_nome: copaData.artilheiro_nome,
          revelacao_id: copaData.revelacao_id,
        },
        tiposAfetados,
      )

      if (updates.length > 0) {
        await admin.from('palpites_bonus').upsert(updates, { onConflict: 'id' })
        totalBonus = updates.length
      }
    }
  } catch (e) {
    console.error('[copa-resultados PUT] erro no recálculo de bônus:', e)
  }

  return NextResponse.json({ updated: true, total_bonus_recalculados: totalBonus })
}
```

- [ ] **Step 2: Criar `app/api/admin/jogos/[id]/route.ts`**

```ts
// app/api/admin/jogos/[id]/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

async function verificarAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 as const }
  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Acesso negado', status: 403 as const }
  return { admin: createSupabaseAdminClient() }
}

const patchSchema = z.object({
  selecao_casa_id: z.number().int().positive().nullable().optional(),
  selecao_fora_id: z.number().int().positive().nullable().optional(),
}).refine(
  (d) => d.selecao_casa_id !== undefined || d.selecao_fora_id !== undefined,
  { message: 'Pelo menos um campo deve ser fornecido' },
)

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await verificarAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const jogoId = Number(params.id)
  if (!Number.isInteger(jogoId) || jogoId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const raw = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { error } = await auth.admin
    .from('jogos')
    .update(parsed.data)
    .eq('id', jogoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updated: true })
}
```

- [ ] **Step 3: Criar `app/api/admin/recalculo-jobs/[id]/route.ts`** (com watchdog de timeout)

```ts
// app/api/admin/recalculo-jobs/[id]/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const TIMEOUT_MINUTOS = 10

async function verificarAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 as const }
  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Acesso negado', status: 403 as const }
  return { admin: createSupabaseAdminClient() }
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await verificarAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  const { data: job, error } = await admin
    .from('recalculo_jobs')
    .select('id, status, total_processados, erro_msg, started_at, finished_at')
    .eq('id', params.id)
    .single()

  if (error || !job) return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })

  // Watchdog: se está processando há mais de TIMEOUT_MINUTOS → marca como erro
  if (job.status === 'processando') {
    const startedAt = new Date(job.started_at)
    const minutosDecorridos = (Date.now() - startedAt.getTime()) / 60_000
    if (minutosDecorridos > TIMEOUT_MINUTOS) {
      await admin
        .from('recalculo_jobs')
        .update({
          status: 'erro',
          erro_msg: `Timeout: processo não respondeu após ${TIMEOUT_MINUTOS} minutos`,
          finished_at: new Date().toISOString(),
        })
        .eq('id', params.id)
      return NextResponse.json({
        ...job,
        status: 'erro',
        erro_msg: `Timeout: processo não respondeu após ${TIMEOUT_MINUTOS} minutos`,
      })
    }
  }

  return NextResponse.json(job)
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/copa-resultados/route.ts \
        app/api/admin/jogos/[id]/route.ts \
        app/api/admin/recalculo-jobs/[id]/route.ts
git commit -m "feat(F10): rotas copa-resultados, jogos/[id] PATCH, recalculo-jobs/[id] GET + watchdog"
```

---

## Task 6: Componente `PlaceholderSelect`

**Files:**
- Create: `components/admin/PlaceholderSelect.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// components/admin/PlaceholderSelect.tsx
'use client'

type SelecaoBasica = {
  id: number
  nome: string
  bandeira_emoji: string
}

type Props = {
  value: number | null
  onChange: (id: number | null) => void
  selecoes: SelecaoBasica[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function PlaceholderSelect({
  value,
  onChange,
  selecoes,
  placeholder = 'Selecionar seleção…',
  disabled,
  className,
}: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      disabled={disabled}
      className={[
        'bg-bg-elevated border-border text-text-primary rounded-md border px-2 py-1.5',
        'font-body text-sm focus:border-accent focus:ring-accent/20 focus:outline-none focus:ring-2',
        'disabled:opacity-50',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <option value="">{placeholder}</option>
      {selecoes.map((s) => (
        <option key={s.id} value={s.id}>
          {s.bandeira_emoji} {s.nome}
        </option>
      ))}
    </select>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/PlaceholderSelect.tsx
git commit -m "feat(F10): componente PlaceholderSelect"
```

---

## Task 7: Componente `JogoRow`

**Files:**
- Create: `components/admin/JogoRow.tsx`

Este é o componente mais complexo de F10. Implementa uma máquina de estados com 5 configurações (grupo pendente / grupo finalizado / placeholder pendente / mata-mata pendente / mata-mata finalizado).

- [ ] **Step 1: Criar `components/admin/JogoRow.tsx`**

```tsx
// components/admin/JogoRow.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { PlaceholderSelect } from './PlaceholderSelect'

export type SelecaoBasica = {
  id: number
  nome: string
  bandeira_emoji: string
  codigo_iso: string
}

export type JogoComSelecoes = {
  id: number
  numero_jogo: number
  fase: string
  data_hora: string
  selecao_casa_id: number | null
  selecao_fora_id: number | null
  placeholder_casa: string | null
  placeholder_fora: string | null
  gols_casa: number | null
  gols_fora: number | null
  finalizado: boolean
  selecao_casa: SelecaoBasica | null
  selecao_fora: SelecaoBasica | null
}

type Props = {
  jogo: JogoComSelecoes
  selecoes: SelecaoBasica[]
  jogoByNumero: Map<number, JogoComSelecoes>
  onAtualizado: (jogoAtualizado: JogoComSelecoes) => void
}

const FASES_MATA_MATA = ['16avos', 'oitavas', 'quartas', 'semis', 'disputa_terceiro', 'final']

function formatDataHora(iso: string) {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')} · ${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`
}

function extrairNumeroJogo(placeholder: string | null): number | null {
  if (!placeholder) return null
  const match = placeholder.match(/\d+/)
  return match ? Number(match[0]) : null
}

export function JogoRow({ jogo, selecoes, jogoByNumero, onAtualizado }: Props) {
  const [golsCasa, setGolsCasa] = useState(jogo.gols_casa?.toString() ?? '')
  const [golsFora, setGolsFora] = useState(jogo.gols_fora?.toString() ?? '')
  const [selecaoCasaId, setSelecaoCasaId] = useState<number | null>(jogo.selecao_casa_id)
  const [selecaoForaId, setSelecaoForaId] = useState<number | null>(jogo.selecao_fora_id)
  const [loadingFinalizar, setLoadingFinalizar] = useState(false)
  const [loadingRecalcular, setLoadingRecalcular] = useState(false)
  const [loadingSelecoes, setLoadingSelecoes] = useState(false)

  const isMataMatata = FASES_MATA_MATA.includes(jogo.fase)
  const placeholderCasaPendente = isMataMatata && jogo.selecao_casa_id === null
  const placeholderForaPendente = isMataMatata && jogo.selecao_fora_id === null
  const temPlaceholderPendente = placeholderCasaPendente || placeholderForaPendente

  const golsCasaNum = golsCasa === '' ? null : Number(golsCasa)
  const golsForaNum = golsFora === '' ? null : Number(golsFora)
  const podeFinalizarGols =
    golsCasaNum !== null && !isNaN(golsCasaNum) && golsCasaNum >= 0 &&
    golsForaNum !== null && !isNaN(golsForaNum) && golsForaNum >= 0
  const podeFinalizarSelecoes = !isMataMatata || (selecaoCasaId !== null && selecaoForaId !== null)
  const podeFinalizar = podeFinalizarGols && podeFinalizarSelecoes && !temPlaceholderPendente

  // ── Sugerir vencedor do jogo referenciado ──────────────────────────────────
  function sugerirVencedor(placeholder: string | null): { selecaoId: number | null; tooltip: string } {
    const num = extrairNumeroJogo(placeholder)
    if (!num) return { selecaoId: null, tooltip: 'Placeholder inválido' }
    const ref = jogoByNumero.get(num)
    if (!ref) return { selecaoId: null, tooltip: `Jogo ${num} não encontrado` }
    if (!ref.finalizado) return { selecaoId: null, tooltip: `Jogo ${num} ainda não finalizado` }
    if (ref.gols_casa === null || ref.gols_fora === null) {
      return { selecaoId: null, tooltip: `Jogo ${num} sem placar` }
    }
    if (ref.gols_casa > ref.gols_fora) {
      return { selecaoId: ref.selecao_casa_id, tooltip: `Vencedor Jogo ${num}` }
    }
    if (ref.gols_fora > ref.gols_casa) {
      return { selecaoId: ref.selecao_fora_id, tooltip: `Vencedor Jogo ${num}` }
    }
    return {
      selecaoId: null,
      tooltip: `Jogo ${num} empatado (pênaltis) — define manualmente`,
    }
  }

  // ── Salvar seleções (resolve placeholder) ──────────────────────────────────
  async function handleSalvarSelecoes() {
    setLoadingSelecoes(true)
    try {
      const res = await fetch(`/api/admin/jogos/${jogo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selecao_casa_id: selecaoCasaId, selecao_fora_id: selecaoForaId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro ao salvar')
      }
      const selCasa = selecoes.find((s) => s.id === selecaoCasaId) ?? null
      const selFora = selecoes.find((s) => s.id === selecaoForaId) ?? null
      onAtualizado({
        ...jogo,
        selecao_casa_id: selecaoCasaId,
        selecao_fora_id: selecaoForaId,
        selecao_casa: selCasa,
        selecao_fora: selFora,
      })
      toast.success('Seleções salvas')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar seleções')
    } finally {
      setLoadingSelecoes(false)
    }
  }

  // ── Marcar como finalizado ─────────────────────────────────────────────────
  async function handleFinalizar() {
    if (!podeFinalizar) return
    setLoadingFinalizar(true)
    try {
      const res = await fetch('/api/admin/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'jogo',
          jogoId: jogo.id,
          gols_casa: golsCasaNum,
          gols_fora: golsForaNum,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao finalizar')
      toast.success(`Jogo #${jogo.numero_jogo} finalizado — ${data.total} palpites recalculados`)
      onAtualizado({
        ...jogo,
        gols_casa: golsCasaNum,
        gols_fora: golsForaNum,
        finalizado: true,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao finalizar jogo')
    } finally {
      setLoadingFinalizar(false)
    }
  }

  // ── Recalcular (jogo já finalizado) ───────────────────────────────────────
  async function handleRecalcular() {
    setLoadingRecalcular(true)
    try {
      const res = await fetch('/api/admin/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'jogo', jogoId: jogo.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao recalcular')
      toast.success(`Jogo #${jogo.numero_jogo} — ${data.total} palpites recalculados`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao recalcular')
    } finally {
      setLoadingRecalcular(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const nomeCasa = jogo.selecao_casa?.nome ?? jogo.placeholder_casa ?? '?'
  const nomeForaa = jogo.selecao_fora?.nome ?? jogo.placeholder_fora ?? '?'
  const bandeiraC = jogo.selecao_casa?.bandeira_emoji ?? '🏳'
  const bandeiraF = jogo.selecao_fora?.bandeira_emoji ?? '🏳'

  return (
    <div className="border-border grid grid-cols-[auto_1fr_auto_1fr_auto_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0 md:gap-4">
      {/* Jogo + data */}
      <div className="font-mono text-text-muted min-w-[90px] text-xs">
        <div className="text-text-primary font-semibold">#{jogo.numero_jogo}</div>
        <div>{formatDataHora(jogo.data_hora)}</div>
      </div>

      {/* Time casa */}
      <div className="flex items-center gap-1.5 text-sm">
        {placeholderCasaPendente ? (
          <PlaceholderSelect
            value={selecaoCasaId}
            onChange={setSelecaoCasaId}
            selecoes={selecoes}
            placeholder={jogo.placeholder_casa ?? 'Casa'}
            className="w-full max-w-[160px]"
          />
        ) : (
          <span>{bandeiraC} {nomeCasa}</span>
        )}
        {placeholderCasaPendente && (() => {
          const sug = sugerirVencedor(jogo.placeholder_casa)
          return (
            <button
              onClick={() => sug.selecaoId && setSelecaoCasaId(sug.selecaoId)}
              disabled={!sug.selecaoId}
              title={sug.tooltip}
              className="text-accent disabled:text-text-muted text-xs underline disabled:no-underline"
            >
              Sugerir
            </button>
          )
        })()}
      </div>

      {/* Placar */}
      <div className="flex items-center gap-1">
        {jogo.finalizado ? (
          <span className="font-mono text-text-primary text-sm">
            {jogo.gols_casa} × {jogo.gols_fora}
          </span>
        ) : (
          <>
            <input
              type="number"
              min={0}
              max={30}
              value={golsCasa}
              onChange={(e) => setGolsCasa(e.target.value)}
              disabled={temPlaceholderPendente}
              className="border-border bg-bg-elevated font-mono text-text-primary w-10 rounded border p-1 text-center text-sm disabled:opacity-40"
              placeholder="–"
            />
            <span className="text-text-muted text-sm">×</span>
            <input
              type="number"
              min={0}
              max={30}
              value={golsFora}
              onChange={(e) => setGolsFora(e.target.value)}
              disabled={temPlaceholderPendente}
              className="border-border bg-bg-elevated font-mono text-text-primary w-10 rounded border p-1 text-center text-sm disabled:opacity-40"
              placeholder="–"
            />
          </>
        )}
      </div>

      {/* Time fora */}
      <div className="flex items-center justify-end gap-1.5 text-sm">
        {placeholderForaPendente ? (
          <>
            {placeholderForaPendente && (() => {
              const sug = sugerirVencedor(jogo.placeholder_fora)
              return (
                <button
                  onClick={() => sug.selecaoId && setSelecaoForaId(sug.selecaoId)}
                  disabled={!sug.selecaoId}
                  title={sug.tooltip}
                  className="text-accent disabled:text-text-muted text-xs underline disabled:no-underline"
                >
                  Sugerir
                </button>
              )
            })()}
            <PlaceholderSelect
              value={selecaoForaId}
              onChange={setSelecaoForaId}
              selecoes={selecoes}
              placeholder={jogo.placeholder_fora ?? 'Fora'}
              className="w-full max-w-[160px]"
            />
          </>
        ) : (
          <span>{nomeForaa} {bandeiraF}</span>
        )}
      </div>

      {/* Status pill */}
      <div>
        {jogo.finalizado ? (
          <span className="pill success text-xs">Finalizado</span>
        ) : temPlaceholderPendente ? (
          <span className="pill warning text-xs">Placeholder pendente</span>
        ) : (
          <span className="pill text-xs">Pendente</span>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2">
        {temPlaceholderPendente && (
          <button
            onClick={handleSalvarSelecoes}
            disabled={loadingSelecoes || (selecaoCasaId === null && selecaoForaId === null)}
            className="btn-sm"
          >
            {loadingSelecoes ? '…' : 'Salvar seleções'}
          </button>
        )}
        {!jogo.finalizado && !temPlaceholderPendente && (
          <button
            onClick={handleFinalizar}
            disabled={!podeFinalizar || loadingFinalizar}
            className="btn-sm"
            title={!podeFinalizar ? 'Preencha o placar' : undefined}
          >
            {loadingFinalizar ? '…' : 'Marcar finalizado'}
          </button>
        )}
        {jogo.finalizado && (
          <button
            onClick={handleRecalcular}
            disabled={loadingRecalcular}
            className="btn-sm flex items-center gap-1"
            title="Recalcular pontos deste jogo"
          >
            <RefreshCw size={12} className={loadingRecalcular ? 'animate-spin' : ''} />
            {loadingRecalcular ? '…' : 'Recalcular'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/JogoRow.tsx
git commit -m "feat(F10): componente JogoRow — máquina de estados + sugestão de vencedor"
```

---

## Task 8: Componente `BonusForm`

**Files:**
- Create: `components/admin/BonusForm.tsx`

- [ ] **Step 1: Criar `components/admin/BonusForm.tsx`**

```tsx
// components/admin/BonusForm.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import type { SelecaoBasica } from './JogoRow'

type CopaResultados = {
  id: number
  campeao_id: number | null
  vice_id: number | null
  terceiro_id: number | null
  quarto_id: number | null
  artilheiro_nome: string | null
  revelacao_id: number | null
  finalizada: boolean
}

type Props = {
  copaResultados: CopaResultados
  selecoes: SelecaoBasica[]
}

type BonusCampo =
  | { label: string; key: 'campeao_id' | 'vice_id' | 'terceiro_id' | 'quarto_id' | 'revelacao_id'; tipo: 'selecao'; obrigatorio: boolean }
  | { label: string; key: 'artilheiro_nome'; tipo: 'texto'; obrigatorio: boolean }

const CAMPOS: BonusCampo[] = [
  { label: 'Campeão',    key: 'campeao_id',   tipo: 'selecao', obrigatorio: true  },
  { label: 'Vice',       key: 'vice_id',       tipo: 'selecao', obrigatorio: true  },
  { label: '3º lugar',   key: 'terceiro_id',   tipo: 'selecao', obrigatorio: true  },
  { label: '4º lugar',   key: 'quarto_id',     tipo: 'selecao', obrigatorio: true  },
  { label: 'Artilheiro', key: 'artilheiro_nome', tipo: 'texto', obrigatorio: true  },
  { label: 'Revelação',  key: 'revelacao_id',  tipo: 'selecao', obrigatorio: false },
]

export function BonusForm({ copaResultados: initial, selecoes }: Props) {
  const [copa, setCopa] = useState<CopaResultados>(initial)
  const [loadingCampo, setLoadingCampo] = useState<string | null>(null)
  const [loadingRecalcular, setLoadingRecalcular] = useState(false)
  const [loadingFinalizar, setLoadingFinalizar] = useState(false)

  const obrigatoriosPreenchidos =
    copa.campeao_id !== null &&
    copa.vice_id !== null &&
    copa.terceiro_id !== null &&
    copa.quarto_id !== null &&
    copa.artilheiro_nome !== null

  async function salvarCampo(campo: BonusCampo, valor: number | string | null) {
    setLoadingCampo(campo.key)
    try {
      const res = await fetch('/api/admin/copa-resultados', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo.key]: valor }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')
      setCopa((prev) => ({ ...prev, [campo.key]: valor }))
      toast.success(`${campo.label} salvo — ${data.total_bonus_recalculados} bilhetes recalculados`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setLoadingCampo(null)
    }
  }

  async function handleRecalcularTodos() {
    setLoadingRecalcular(true)
    try {
      const res = await fetch('/api/admin/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'bonus' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro')
      toast.success(`Bônus recalculados — ${data.total} bilhetes atualizados`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao recalcular')
    } finally {
      setLoadingRecalcular(false)
    }
  }

  async function handleFinalizar(checked: boolean) {
    setLoadingFinalizar(true)
    try {
      const res = await fetch('/api/admin/copa-resultados', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalizada: checked }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro')
      setCopa((prev) => ({ ...prev, finalizada: checked }))
      toast.success(checked ? 'Copa marcada como finalizada' : 'Copa reaberta')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoadingFinalizar(false)
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="text-text-primary text-sm font-semibold">Resultados finais da Copa</span>
      </div>
      <div className="divide-border divide-y p-4">
        {CAMPOS.map((campo) => {
          const isLoading = loadingCampo === campo.key
          return (
            <div key={campo.key} className="flex items-center gap-3 py-3">
              <label className="text-text-muted w-28 flex-shrink-0 text-sm">
                {campo.label}
                {!campo.obrigatorio && (
                  <span className="text-text-muted ml-1 text-xs">(opcional)</span>
                )}
              </label>
              {campo.tipo === 'selecao' ? (
                <FieldSelecao
                  campo={campo as Extract<BonusCampo, { tipo: 'selecao' }>}
                  copa={copa}
                  selecoes={selecoes}
                  isLoading={isLoading}
                  onSalvar={salvarCampo}
                />
              ) : (
                <FieldTexto
                  campo={campo as Extract<BonusCampo, { tipo: 'texto' }>}
                  copa={copa}
                  isLoading={isLoading}
                  onSalvar={salvarCampo}
                />
              )}
            </div>
          )
        })}

        <div className="flex items-center gap-3 py-3">
          <label className="text-text-muted w-28 flex-shrink-0 text-sm">Copa finalizada</label>
          <input
            type="checkbox"
            checked={copa.finalizada}
            disabled={!obrigatoriosPreenchidos || loadingFinalizar}
            onChange={(e) => handleFinalizar(e.target.checked)}
            className="accent-accent h-4 w-4 disabled:opacity-50"
            title={!obrigatoriosPreenchidos ? 'Preencha todos os campos obrigatórios antes' : undefined}
          />
          {!obrigatoriosPreenchidos && (
            <span className="text-text-muted text-xs">Preencha campeão, vice, 3º, 4º e artilheiro antes</span>
          )}
        </div>

        <div className="pt-3">
          <button
            onClick={handleRecalcularTodos}
            disabled={loadingRecalcular}
            className="btn-sm flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={loadingRecalcular ? 'animate-spin' : ''} />
            {loadingRecalcular ? 'Recalculando…' : 'Recalcular todos os bônus'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-componentes de campo ───────────────────────────────────────────────────

function FieldSelecao({
  campo,
  copa,
  selecoes,
  isLoading,
  onSalvar,
}: {
  campo: Extract<BonusCampo, { tipo: 'selecao' }>
  copa: CopaResultados
  selecoes: SelecaoBasica[]
  isLoading: boolean
  onSalvar: (campo: BonusCampo, valor: number | null) => void
}) {
  const [local, setLocal] = useState<number | null>((copa[campo.key] as number | null) ?? null)

  return (
    <>
      <select
        value={local ?? ''}
        onChange={(e) => setLocal(e.target.value ? Number(e.target.value) : null)}
        className="border-border bg-bg-elevated text-text-primary flex-1 rounded border px-2 py-1.5 text-sm"
      >
        <option value="">— não definido —</option>
        {selecoes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.bandeira_emoji} {s.nome}
          </option>
        ))}
      </select>
      <button
        onClick={() => onSalvar(campo, local)}
        disabled={isLoading || local === ((copa[campo.key] as number | null) ?? null)}
        className="btn-sm"
      >
        {isLoading ? '…' : 'Salvar'}
      </button>
    </>
  )
}

function FieldTexto({
  campo,
  copa,
  isLoading,
  onSalvar,
}: {
  campo: Extract<BonusCampo, { tipo: 'texto' }>
  copa: CopaResultados
  isLoading: boolean
  onSalvar: (campo: BonusCampo, valor: string | null) => void
}) {
  const [local, setLocal] = useState<string>((copa[campo.key] as string | null) ?? '')

  return (
    <>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Nome do jogador"
        className="border-border bg-bg-elevated text-text-primary flex-1 rounded border px-2 py-1.5 text-sm"
      />
      <button
        onClick={() => onSalvar(campo, local.trim() || null)}
        disabled={isLoading || local.trim() === ((copa[campo.key] as string | null) ?? '')}
        className="btn-sm"
      >
        {isLoading ? '…' : 'Salvar'}
      </button>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/BonusForm.tsx
git commit -m "feat(F10): componente BonusForm — copa_resultados com salvar por campo"
```

---

## Task 9: Componente `RecalculoGlobalStatus`

**Files:**
- Create: `components/admin/RecalculoGlobalStatus.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// components/admin/RecalculoGlobalStatus.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

type JobStatus = {
  id: string
  status: 'processando' | 'concluido' | 'erro'
  total_processados: number | null
  erro_msg: string | null
  started_at: string
  finished_at: string | null
}

const TIMEOUT_AVISO_MS = 10 * 60 * 1000 // 10 min

export function RecalculoGlobalStatus() {
  const [jobAtual, setJobAtual] = useState<JobStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createSupabaseBrowserClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  function limparSubscription() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  function iniciarMonitoramento(jobId: string) {
    limparSubscription()

    const channel = supabase
      .channel(`recalculo-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'recalculo_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const job = payload.new as JobStatus
          setJobAtual(job)
          if (job.status === 'concluido') {
            toast.success(`Recálculo concluído — ${job.total_processados ?? 0} palpites processados`)
            limparSubscription()
          } else if (job.status === 'erro') {
            toast.error(`Erro no recálculo: ${job.erro_msg}`)
            limparSubscription()
          }
        },
      )
      .subscribe()
    channelRef.current = channel

    // Polling de fallback a cada 5s por até 15min
    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/admin/recalculo-jobs/${jobId}`)
      if (!res.ok) return
      const job: JobStatus = await res.json()
      setJobAtual(job)
      if (job.status !== 'processando') {
        limparSubscription()
        if (job.status === 'concluido') {
          toast.success(`Recálculo concluído — ${job.total_processados ?? 0} palpites processados`)
        } else {
          toast.error(`Erro no recálculo: ${job.erro_msg}`)
        }
      }
    }, 5_000)
  }

  useEffect(() => () => limparSubscription(), [])

  async function handleRecalcularTudo() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'global' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao iniciar')
      const job: JobStatus = {
        id: data.jobId,
        status: 'processando',
        total_processados: null,
        erro_msg: null,
        started_at: new Date().toISOString(),
        finished_at: null,
      }
      setJobAtual(job)
      iniciarMonitoramento(data.jobId)
      toast.info('Recálculo global iniciado em background…')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao iniciar recálculo global')
    } finally {
      setLoading(false)
    }
  }

  const travado =
    jobAtual?.status === 'processando' &&
    Date.now() - new Date(jobAtual.started_at).getTime() > TIMEOUT_AVISO_MS

  return (
    <div className="space-y-3">
      <div>
        <button
          onClick={handleRecalcularTudo}
          disabled={loading || jobAtual?.status === 'processando'}
          className="btn-sm flex items-center gap-1.5"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Iniciando…' : 'Recalcular tudo'}
        </button>
        <p className="text-text-muted mt-1 text-xs">
          Reprocessa todos os palpites e bônus em background.
        </p>
      </div>

      {jobAtual && (
        <div className="bg-bg-base border-border rounded-lg border p-3 text-sm">
          {jobAtual.status === 'processando' && (
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-accent animate-spin" />
              <span className="text-text-primary">Em andamento…</span>
              {travado && (
                <span className="text-warning flex items-center gap-1 text-xs">
                  <AlertCircle size={12} />
                  Pode ter travado
                </span>
              )}
            </div>
          )}
          {jobAtual.status === 'concluido' && (
            <div className="text-success">
              ✓ {jobAtual.total_processados ?? 0} palpites recalculados
              {jobAtual.finished_at && (
                <span className="text-text-muted ml-2 text-xs">
                  em {new Date(jobAtual.finished_at).toLocaleTimeString('pt-BR')}
                </span>
              )}
            </div>
          )}
          {jobAtual.status === 'erro' && (
            <div className="text-danger flex items-center gap-1.5">
              <AlertCircle size={14} />
              Erro: {jobAtual.erro_msg}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/RecalculoGlobalStatus.tsx
git commit -m "feat(F10): componente RecalculoGlobalStatus — Realtime + polling fallback + watchdog UI"
```

---

## Task 10: Página `/admin/jogos` — Server Component + Client Component

**Files:**
- Create: `app/(admin)/admin/jogos/page.tsx`
- Create: `app/(admin)/admin/jogos/JogosClient.tsx`

- [ ] **Step 1: Criar `app/(admin)/admin/jogos/page.tsx`** (Server Component)

```tsx
// app/(admin)/admin/jogos/page.tsx
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { JogosClient } from './JogosClient'
import type { JogoComSelecoes, SelecaoBasica } from '@/components/admin/JogoRow'

const FASES_ORDEM = ['grupos', '16avos', 'oitavas', 'quartas', 'semis', 'disputa_terceiro', 'final']

export default async function AdminJogosPage() {
  const admin = createSupabaseAdminClient()

  const [jogosRes, selecoesRes, copaRes] = await Promise.all([
    admin
      .from('jogos')
      .select(`
        id, numero_jogo, fase, data_hora,
        selecao_casa_id, selecao_fora_id,
        placeholder_casa, placeholder_fora,
        gols_casa, gols_fora, finalizado,
        selecao_casa:selecoes!selecao_casa_id(id, nome, bandeira_emoji, codigo_iso),
        selecao_fora:selecoes!selecao_fora_id(id, nome, bandeira_emoji, codigo_iso)
      `)
      .order('data_hora', { ascending: true }),
    admin
      .from('selecoes')
      .select('id, nome, bandeira_emoji, codigo_iso')
      .order('nome', { ascending: true }),
    admin
      .from('copa_resultados')
      .select('*')
      .eq('id', 1)
      .maybeSingle(),
  ])

  const jogos = (jogosRes.data ?? []) as unknown as JogoComSelecoes[]
  const selecoes = (selecoesRes.data ?? []) as SelecaoBasica[]
  const copaResultados = copaRes.data ?? {
    id: 1, campeao_id: null, vice_id: null, terceiro_id: null,
    quarto_id: null, artilheiro_nome: null, revelacao_id: null,
    finalizada: false,
  }

  // Tab inicial: fase do próximo jogo não finalizado (cronológico)
  const proximoJogo = jogos.find((j) => !j.finalizado)
  const initialTab = (proximoJogo?.fase ?? 'grupos') as typeof FASES_ORDEM[number]

  return (
    <section>
      <div className="mb-8">
        <h1 className="font-display text-text-primary text-4xl tracking-wide">
          Jogos <span className="text-danger">& Resultados</span>
        </h1>
        <p className="text-text-muted mt-1 text-sm">Copa 2026 · Inserção de placares e recálculo de pontos</p>
      </div>
      <JogosClient
        jogos={jogos}
        selecoes={selecoes}
        copaResultados={copaResultados}
        initialTab={initialTab}
      />
    </section>
  )
}
```

- [ ] **Step 2: Criar `app/(admin)/admin/jogos/JogosClient.tsx`** (Client Component)

```tsx
// app/(admin)/admin/jogos/JogosClient.tsx
'use client'

import { useMemo, useState } from 'react'
import { BonusForm } from '@/components/admin/BonusForm'
import { JogoRow } from '@/components/admin/JogoRow'
import type { JogoComSelecoes, SelecaoBasica } from '@/components/admin/JogoRow'

type CopaResultados = {
  id: number
  campeao_id: number | null
  vice_id: number | null
  terceiro_id: number | null
  quarto_id: number | null
  artilheiro_nome: string | null
  revelacao_id: number | null
  finalizada: boolean
}

type Props = {
  jogos: JogoComSelecoes[]
  selecoes: SelecaoBasica[]
  copaResultados: CopaResultados
  initialTab: string
}

const TABS = [
  { id: 'grupos',           label: 'Grupos' },
  { id: '16avos',           label: '16avos' },
  { id: 'oitavas',          label: 'Oitavas' },
  { id: 'quartas',          label: 'Quartas' },
  { id: 'semis',            label: 'Semis' },
  { id: 'disputa_terceiro', label: 'Disputa 3º' },
  { id: 'final',            label: 'Final' },
  { id: 'bonus',            label: 'Bônus' },
]

const FASES_MATA_MATA = ['16avos', 'oitavas', 'quartas', 'semis', 'disputa_terceiro', 'final']

type StatusFiltro = 'todos' | 'pendentes' | 'finalizados'

export function JogosClient({ jogos: initialJogos, selecoes, copaResultados, initialTab }: Props) {
  const [jogos, setJogos] = useState<JogoComSelecoes[]>(initialJogos)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos')
  const [soPlaceholder, setSoPlaceholder] = useState(false)

  const jogoByNumero = useMemo(
    () => new Map(jogos.map((j) => [j.numero_jogo, j])),
    [jogos],
  )

  function handleAtualizado(atualizado: JogoComSelecoes) {
    setJogos((prev) => prev.map((j) => (j.id === atualizado.id ? atualizado : j)))
  }

  const isMataMatataTab = FASES_MATA_MATA.includes(activeTab)

  const jogosFiltrados = useMemo(() => {
    return jogos
      .filter((j) => j.fase === activeTab)
      .filter((j) => {
        if (statusFiltro === 'pendentes') return !j.finalizado
        if (statusFiltro === 'finalizados') return j.finalizado
        return true
      })
      .filter((j) => {
        if (!soPlaceholder) return true
        return j.selecao_casa_id === null || j.selecao_fora_id === null
      })
  }, [jogos, activeTab, statusFiltro, soPlaceholder])

  return (
    <div>
      {/* Tabs */}
      <div className="border-border mb-6 flex overflow-x-auto border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setStatusFiltro('todos')
              setSoPlaceholder(false)
            }}
            className={[
              'flex-shrink-0 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-primary',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'bonus' ? (
        <BonusForm copaResultados={copaResultados} selecoes={selecoes} />
      ) : (
        <>
          {/* Filtros */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex rounded-md border border-border overflow-hidden">
              {(['todos', 'pendentes', 'finalizados'] as StatusFiltro[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFiltro(f)}
                  className={[
                    'px-3 py-1.5 text-xs capitalize transition-colors',
                    statusFiltro === f
                      ? 'bg-accent text-bg-base font-semibold'
                      : 'bg-bg-elevated text-text-muted hover:text-text-primary',
                  ].join(' ')}
                >
                  {f}
                </button>
              ))}
            </div>
            {isMataMatataTab && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={soPlaceholder}
                  onChange={(e) => setSoPlaceholder(e.target.checked)}
                  className="accent-accent h-4 w-4"
                />
                <span className="text-text-muted">Só com placeholder pendente</span>
              </label>
            )}
          </div>

          {/* Lista */}
          <div className="panel">
            {jogosFiltrados.length === 0 ? (
              <p className="text-text-muted p-6 text-center text-sm">Nenhum jogo nesta fase/filtro.</p>
            ) : (
              jogosFiltrados.map((jogo) => (
                <JogoRow
                  key={jogo.id}
                  jogo={jogo}
                  selecoes={selecoes}
                  jogoByNumero={jogoByNumero}
                  onAtualizado={handleAtualizado}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar que a página carrega sem erros TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/jogos/page.tsx app/\(admin\)/admin/jogos/JogosClient.tsx
git commit -m "feat(F10): página /admin/jogos — Server Component + tabs + filtros + JogoRow"
```

---

## Task 11: Atualizar Sidebar e Overview

**Files:**
- Modify: `components/admin/AdminSidebar.tsx`
- Modify: `app/(admin)/admin/page.tsx`

- [ ] **Step 1: Ler `components/admin/AdminSidebar.tsx` na íntegra antes de editar**

Execute:
```bash
cat components/admin/AdminSidebar.tsx
```

Identifique:
1. O item "Overview" (ativo) — copie exatamente sua estrutura de JSX
2. O item "Jogos & Resultados" (como span/desabilitado)

A alteração é: substituir o item de "Jogos & Resultados" de `<span>` para `<Link href="/admin/jogos">` seguindo **exatamente** o mesmo padrão do item "Overview" ativo. Remova qualquer badge "em breve" e a classe de opacidade.

Exemplo do padrão esperado (ajuste ao código real que você ler):
```tsx
// Antes (span inativo):
<span className="sidebar-item opacity-50 cursor-not-allowed">
  <Swords className="sidebar-icon" />
  Jogos & Resultados
  <span className="badge">em breve</span>
</span>

// Depois (Link ativo, mesma estrutura do Overview):
<Link
  href="/admin/jogos"
  className={`sidebar-item${pathname.startsWith('/admin/jogos') ? ' active' : ''}`}
>
  <Swords className="sidebar-icon" />
  Jogos & Resultados
</Link>
```

> O código exato depende do que você encontrar no arquivo. Siga o padrão do "Overview".

- [ ] **Step 2: Abrir `app/(admin)/admin/page.tsx` e adicionar o widget de recálculo global**

Localize a seção "Ações do sistema" que já tem `<SnapshotRanking />`. Adicione o `RecalculoGlobalStatus` logo abaixo, com separador:

```tsx
import { RecalculoGlobalStatus } from '@/components/admin/RecalculoGlobalStatus'

// ... dentro do JSX, após <SnapshotRanking />:
<div className="border-border mt-6 border-t pt-6">
  <p className="text-text-primary mb-3 text-sm font-semibold">Recálculo global de pontos</p>
  <RecalculoGlobalStatus />
</div>
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add components/admin/AdminSidebar.tsx app/\(admin\)/admin/page.tsx
git commit -m "feat(F10): sidebar ativa Jogos & Resultados + widget RecalculoGlobalStatus no overview"
```

---

## Task 12: Teste de fumaça end-to-end e cobertura final

- [ ] **Step 1: Subir o servidor de desenvolvimento**

```bash
npm run dev
```

- [ ] **Step 2: Testar o fluxo completo como admin**

Acesse `http://localhost:3000/admin/jogos` como usuário admin.

Checklist:
- [ ] Sidebar mostra "Jogos & Resultados" como link ativo (não mais "em breve")
- [ ] A página carrega as 8 tabs (Grupos → Final + Bônus)
- [ ] Tab inicial é a fase do próximo jogo não finalizado
- [ ] Filtro de status funciona (Todos / Pendentes / Finalizados)
- [ ] Para uma tab de mata-mata: toggle "Só com placeholder pendente" aparece
- [ ] Em um jogo de grupo: inputs de gols aparecem, botão "Marcar finalizado" fica disabled com gols vazios
- [ ] Preencher gols e clicar "Marcar finalizado": spinner aparece, toast de sucesso mostra número de palpites, linha vira "Finalizado" com gols readonly
- [ ] Jogo finalizado: botão "Recalcular" aparece, toast de sucesso ao clicar
- [ ] Tab "Bônus": formulário de copa_resultados aparece com campos por tipo
- [ ] Salvar um campo de bônus: toast com `N bilhetes recalculados`
- [ ] Overview `/admin`: botão "Recalcular tudo" aparece na seção "Ações do sistema"
- [ ] Clicar "Recalcular tudo": toast "Recálculo global iniciado em background", widget mostra spinner

- [ ] **Step 3: Rodar todos os testes**

```bash
npx vitest run --reporter=verbose
```

Esperado: todos os testes passam, incluindo `lib/__tests__/recalculo.test.ts`.

- [ ] **Step 4: Verificar cobertura de `lib/recalculo.ts` ≥ 95%**

```bash
npx vitest run lib/__tests__/recalculo.test.ts --coverage
```

Verifique as linhas de `lib/recalculo.ts` no relatório. Se < 95%, adicione casos de teste para as branches não cobertas.

- [ ] **Step 5: Verificar TypeScript zero erros**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit final de feature**

```bash
git add -A
git commit -m "feat(F10): admin jogos + recálculo de pontos — feature completa"
```

---

## Referências

- Spec: `docs/superpowers/specs/2026-05-04-admin-resultados-design.md`
- Lib de pontuação: `lib/pontuacao.ts`
- Padrão de auth de API routes: `app/api/admin/ranking-snapshot/route.ts`
- Padrão de Server Component admin: `app/(admin)/admin/page.tsx`
- Sidebar existente: `components/admin/AdminSidebar.tsx`
