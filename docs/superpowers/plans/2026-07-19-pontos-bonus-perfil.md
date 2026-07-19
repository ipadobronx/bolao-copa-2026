# Pontos ganhos nos palpites de bônus (perfil público) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar, no modal de perfil público do ranking, quantos pontos cada palpite de bônus rendeu (+50 acerto em amarelo, +0 erro em cinza, sem badge quando o resultado oficial ainda não saiu).

**Architecture:** Um helper puro em `lib/ranking/pontosBonus.ts` decide se o badge aparece (`number | null`); a rota `/api/perfil/[bilheteId]` passa a devolver `pontos` por bônus usando esse helper + uma leitura de `copa_resultados`; o `PerfilModal` só renderiza o que vier. Spec: `docs/superpowers/specs/2026-07-19-pontos-bonus-perfil-design.md`.

**Tech Stack:** Next.js 14 App Router, Supabase (client server-side, RLS), Vitest + Testing Library.

**Contexto do banco:** `copa_resultados` (id=1) tem `campeao_id/vice_id/terceiro_id/quarto_id/artilheiro_nome` preenchidos e `revelacao_id` **null** hoje. `palpites_bonus.pontos_calculados` já está recalculado. RLS: `copa_resultados` tem SELECT liberado pra `anon, authenticated` (policy `copa_resultados_select_all`), então a rota lê com o client normal.

---

### Task 1: Helper puro `pontosBonusExibicao`

Regra: badge só existe se o resultado oficial daquele tipo já está definido. `pontos_calculados` null com resultado definido vira 0 (palpite errado).

**Files:**
- Create: `lib/ranking/pontosBonus.ts`
- Test: `lib/ranking/__tests__/pontosBonus.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/ranking/__tests__/pontosBonus.test.ts
import { describe, it, expect } from 'vitest'
import { pontosBonusExibicao } from '../pontosBonus'

const oficial = {
  campeao_id: 1,
  vice_id: 2,
  terceiro_id: 3,
  quarto_id: 4,
  artilheiro_nome: 'Kylian Mbappé',
  revelacao_id: null,
}

describe('pontosBonusExibicao', () => {
  it('retorna os pontos quando o resultado oficial do tipo está definido', () => {
    expect(pontosBonusExibicao('campeao', 50, oficial)).toBe(50)
    expect(pontosBonusExibicao('vice', 0, oficial)).toBe(0)
    expect(pontosBonusExibicao('artilheiro', 25, oficial)).toBe(25)
  })

  it('trata pontos_calculados null como 0 quando o resultado está definido', () => {
    expect(pontosBonusExibicao('quarto', null, oficial)).toBe(0)
  })

  it('retorna null quando o resultado oficial do tipo ainda não saiu', () => {
    expect(pontosBonusExibicao('revelacao', 0, oficial)).toBeNull()
    expect(pontosBonusExibicao('revelacao', null, oficial)).toBeNull()
  })

  it('retorna null quando copa_resultados não existe', () => {
    expect(pontosBonusExibicao('campeao', 50, null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ranking/__tests__/pontosBonus.test.ts`
Expected: FAIL — `Cannot find module '../pontosBonus'` (ou equivalente).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ranking/pontosBonus.ts
import type { TipoBonus } from '@/lib/pontuacao'

/** Campos de copa_resultados relevantes pra exibição de pontos de bônus. */
export type CopaResultadosOficial = {
  campeao_id: number | null
  vice_id: number | null
  terceiro_id: number | null
  quarto_id: number | null
  artilheiro_nome: string | null
  revelacao_id: number | null
}

const CAMPO_OFICIAL: Record<TipoBonus, keyof CopaResultadosOficial> = {
  campeao: 'campeao_id',
  vice: 'vice_id',
  terceiro: 'terceiro_id',
  quarto: 'quarto_id',
  artilheiro: 'artilheiro_nome',
  revelacao: 'revelacao_id',
}

/**
 * Pontos a exibir no badge de um palpite de bônus no perfil público.
 * null = resultado oficial daquele tipo ainda não definido → não mostra badge.
 */
export function pontosBonusExibicao(
  tipo: TipoBonus,
  pontosCalculados: number | null,
  oficial: CopaResultadosOficial | null,
): number | null {
  if (!oficial || oficial[CAMPO_OFICIAL[tipo]] == null) return null
  return pontosCalculados ?? 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ranking/__tests__/pontosBonus.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/ranking/pontosBonus.ts lib/ranking/__tests__/pontosBonus.test.ts
git commit -m "feat(ranking): helper pontosBonusExibicao (badge de pontos por bônus)"
```

---

### Task 2: API `/api/perfil/[bilheteId]` devolve `pontos` por bônus

Sem teste automatizado de rota (o projeto não tem infra de teste pra route handlers; a lógica condicional está coberta pelo Task 1). Verificação por typecheck + teste manual no Task 4.

**Files:**
- Modify: `app/api/perfil/[bilheteId]/route.ts`

- [ ] **Step 1: Atualizar tipos e select dos bônus**

No topo do arquivo, trocar o tipo `BonusSel` e adicionar o import do helper:

```ts
import { pontosBonusExibicao, type CopaResultadosOficial } from '@/lib/ranking/pontosBonus'

type BonusSel = { nome: string; bandeira: string; pontos: number | null } | null
```

Trocar o bloco de busca/montagem dos bônus (do comentário `// bônus (6 tipos)` até o fim do `for`) por:

```ts
  // bônus (6 tipos) — RLS já libera pós-início
  const { data: bonus } = await supabase
    .from('palpites_bonus')
    .select(
      'tipo, jogador_nome, pontos_calculados, selecao:selecoes!selecao_id(nome, bandeira_emoji)',
    )
    .eq('bilhete_id', params.bilheteId)
    .in('tipo', ['campeao', 'vice', 'terceiro', 'quarto', 'artilheiro', 'revelacao'])

  // resultados oficiais — decide se o badge de pontos aparece (RLS: select liberado)
  const { data: oficial } = await supabase
    .from('copa_resultados')
    .select('campeao_id, vice_id, terceiro_id, quarto_id, artilheiro_nome, revelacao_id')
    .eq('id', 1)
    .maybeSingle<CopaResultadosOficial>()

  const selOf = (b: { selecao: unknown; pontos_calculados: number | null; tipo: string }): BonusSel => {
    const s = (Array.isArray(b.selecao) ? b.selecao[0] : b.selecao) as
      | { nome: string; bandeira_emoji: string }
      | null
      | undefined
    if (!s) return null
    return {
      nome: s.nome,
      bandeira: s.bandeira_emoji,
      pontos: pontosBonusExibicao(
        b.tipo as Parameters<typeof pontosBonusExibicao>[0],
        b.pontos_calculados,
        oficial ?? null,
      ),
    }
  }
  let campeao: BonusSel = null
  let vice: BonusSel = null
  let terceiro: BonusSel = null
  let quarto: BonusSel = null
  let revelacao: BonusSel = null
  let artilheiro: { nome: string; pontos: number | null } | null = null
  for (const b of bonus ?? []) {
    if (b.tipo === 'campeao') campeao = selOf(b)
    else if (b.tipo === 'vice') vice = selOf(b)
    else if (b.tipo === 'terceiro') terceiro = selOf(b)
    else if (b.tipo === 'quarto') quarto = selOf(b)
    else if (b.tipo === 'revelacao') revelacao = selOf(b)
    else if (b.tipo === 'artilheiro' && b.jogador_nome != null)
      artilheiro = {
        nome: b.jogador_nome,
        pontos: pontosBonusExibicao('artilheiro', b.pontos_calculados, oficial ?? null),
      }
  }
```

O `return NextResponse.json({...})` no fim do arquivo não muda (os nomes `campeao`, `vice`, ..., `artilheiro` continuam os mesmos — só o shape interno mudou).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erros (se acusar erro no `PerfilModal.tsx` por causa do shape novo de `artilheiro`, é esperado — será corrigido no Task 3; nesse caso, confirmar que os únicos erros são no PerfilModal).

- [ ] **Step 3: Commit**

```bash
git add "app/api/perfil/[bilheteId]/route.ts"
git commit -m "feat(perfil): API devolve pontos ganhos por palpite de bônus"
```

---

### Task 3: Badge de pontos no `PerfilModal`

**Files:**
- Modify: `components/ranking/PerfilModal.tsx`
- Test: `components/ranking/__tests__/PerfilModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Acrescentar ao final do `describe` em `components/ranking/__tests__/PerfilModal.test.tsx`:

```tsx
  it('mostra pontos dos bônus: acerto amarelo, erro cinza, pendente sem badge', async () => {
    mockFetch({
      campeao: { nome: 'Espanha', bandeira: '🇪🇸', pontos: 50 },
      vice: { nome: 'França', bandeira: '🇫🇷', pontos: 0 },
      terceiro: null,
      quarto: null,
      revelacao: { nome: 'Noruega', bandeira: '🇳🇴', pontos: null },
      artilheiro: { nome: 'Mbappe', pontos: 25 },
      numero: 118, pontos: 681, posicao: 1, exatos: 14, forma: [],
      tabelas: [], totalTabelas: 0, palpites: [],
    })
    render(<PerfilModal entry={entry} total={100} onClose={() => {}} />)
    expect(await screen.findByText('Espanha')).toBeInTheDocument()
    // acertos em amarelo
    expect(screen.getByText('+50').className).toContain('text-accent')
    expect(screen.getByText('+25').className).toContain('text-accent')
    // erro em cinza
    expect(screen.getByText('+0').className).toContain('text-text-muted')
    // revelação pendente: nome aparece, badge não — total de badges = 3 (+50, +0, +25)
    expect(screen.getByText('Noruega')).toBeInTheDocument()
    expect(screen.getAllByText(/^\+\d+$/)).toHaveLength(3)
    // artilheiro (agora objeto) renderiza o nome
    expect(screen.getByText('Mbappe')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/ranking/__tests__/PerfilModal.test.tsx`
Expected: o teste novo FALHA (não encontra `+50`); os 6 antigos passam.

- [ ] **Step 3: Implementar no PerfilModal**

Em `components/ranking/PerfilModal.tsx`:

(a) Atualizar os types (linhas 12 e 20):

```ts
type BonusSel = { nome: string; bandeira: string; pontos: number | null } | null
```

e dentro de `PerfilData`:

```ts
  artilheiro: { nome: string; pontos: number | null } | null
```

(b) Adicionar o componente de badge (antes de `export function PerfilModal`):

```tsx
function BadgePontos({ pontos }: { pontos: number | null }) {
  if (pontos == null) return null
  return (
    <span
      className={`ml-auto shrink-0 font-mono text-xs ${
        pontos > 0 ? 'font-bold text-accent' : 'text-text-muted'
      }`}
    >
      +{pontos}
    </span>
  )
}
```

(c) Nas linhas de bônus de seleção (map de `bonusSelecoes`), acrescentar o badge após o `<strong>`:

```tsx
                    {bonusSelecoes.map(([icon, label, sel]) => (
                      <div key={label} className="flex items-center gap-2 text-sm">
                        <span aria-hidden="true">{icon}</span>
                        <span className="w-20 shrink-0 text-xs text-text-muted">{label}</span>
                        {sel ? (
                          <>
                            <BandeiraImg emoji={sel.bandeira} nome={sel.nome} size={16} />
                            <strong className="truncate">{sel.nome}</strong>
                            <BadgePontos pontos={sel.pontos} />
                          </>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </div>
                    ))}
```

(d) Linha do artilheiro (era `data?.artilheiro` string, virou objeto):

```tsx
                    <div className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true">⚽</span>
                      <span className="w-20 shrink-0 text-xs text-text-muted">Artilheiro</span>
                      {data?.artilheiro ? (
                        <>
                          <strong className="truncate">{data.artilheiro.nome}</strong>
                          <BadgePontos pontos={data.artilheiro.pontos} />
                        </>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </div>
```

(e) Linha da revelação, mesmo padrão:

```tsx
                    <div className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true">🌟</span>
                      <span className="w-20 shrink-0 text-xs text-text-muted">Revelação</span>
                      {data?.revelacao ? (
                        <>
                          <BandeiraImg emoji={data.revelacao.bandeira} nome={data.revelacao.nome} size={16} />
                          <strong className="truncate">{data.revelacao.nome}</strong>
                          <BadgePontos pontos={data.revelacao.pontos} />
                        </>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/ranking/__tests__/PerfilModal.test.tsx`
Expected: PASS (7 testes, incluindo os 6 antigos).

- [ ] **Step 5: Commit**

```bash
git add components/ranking/PerfilModal.tsx components/ranking/__tests__/PerfilModal.test.tsx
git commit -m "feat(perfil): badge de pontos ganhos em cada palpite de bônus"
```

---

### Task 4: Verificação final

**Files:** nenhum novo.

- [ ] **Step 1: Suite completa + typecheck + lint**

Run: `npx vitest run && npx tsc --noEmit && npx next lint`
Expected: tudo verde, 0 erros.

- [ ] **Step 2: Verificação manual**

Run: `npm run dev` e abrir `http://localhost:3000/ranking`, clicar num apostador.
Expected no modal: 🏆 com `+50` amarelo (quem pôs Espanha), erros com `+0` cinza, e a linha Revelação **sem** badge. Conferir o card do próprio Antônio (#118): Espanha +50, França +0, Inglaterra +15, Argentina +0, Mbappe +25, Noruega sem badge.

- [ ] **Step 3: Push (deploy Vercel via branch atual)**

O trabalho está na branch `feat/retrospectiva-mala-na-copa`; produção sai da `main`. Fazer o merge/PR conforme o fluxo do projeto (superpowers:finishing-a-development-branch) — decidir com o usuário se vai de PR ou cherry-pick, já que a branch atual carrega também os assets da retrospectiva.
