# Feature 10 — Admin: Entrada de Resultados + Recálculo de Pontos

**Data:** 2026-05-04
**Status:** Aprovado para implementação
**Autor:** Brainstorm conduzido com Jonatas
**Próximo passo:** writing-plans → executing-plans em worktree separado

---

## 1. Contexto e motivação

Décima feature da seção 5 do `CLAUDE.md`. F1–F9 mergeadas:

- **F1** — Setup Next.js 14, Tailwind v4, Supabase clients, middleware.
- **F2** — Schema (7 tabelas, 3 enums, RLS, view `ranking`, seed 48 seleções + 104 jogos).
- **F3** — Landing page.
- **F4** — Auth magic link + layout dashboard.
- **F5** — `lib/pontuacao.ts` puro com testes ≥ 95%.
- **F6** — Checkout PIX (Mercado Pago, webhook, polling, CashbackPicker).
- **F7** — Tela de palpites (104 jogos + 6 bônus, auto-save, countdown).
- **F8** — Ranking realtime (Supabase Realtime, `ranking_snapshots`).
- **F9** — Painel admin overview (KPIs, pagamentos, gráfico de vendas).

F10 entrega a página `/admin/jogos`: o admin insere placares, resolve placeholders de mata-mata, marca jogos como finalizados e dispara o recálculo de pontos via Server Route Node.js (não Edge Function — decisão pragmática documentada em §2). Também entrega o formulário de `copa_resultados` com recálculo de bônus.

---

## 2. Decisões tomadas durante o brainstorming

| # | Pergunta | Escolha | Motivação |
|---|----------|---------|-----------|
| Q1 | Placeholders de mata-mata | **Em escopo** — admin resolve `selecao_casa_id`/`selecao_fora_id` antes de inserir placar | Sem isso o sistema trava no 1º jogo de 16avos (27/06/2026) |
| Q2 | Trigger do recálculo | **Híbrido**: automático ao finalizar jogo + botão por jogo + botão global | Admin precisa poder corrigir placares; global é cinto-suspensório |
| Q3 | Bônus | **Em escopo**: formulário de `copa_resultados` + recálculo de bônus separados por campo alterado | Bônus usam a mesma lib; separar em F11 deixaria `pontos_calculados` zerado para bônus até lá |
| Q4 | Recálculo global | **Assíncrono**: tabela `recalculo_jobs` + fire-and-forget + Supabase Realtime | Volume (200k+ palpites) pode exceder timeouts sem async; observabilidade necessária |
| Q5 | Organização da tela | **Tabs por fase** (idêntico ao F7): Grupos / 16avos / … / Final / Bônus | Consistência com palpites; filtros por status + toggle "placeholder pendente" |
| Q6 | Arquitetura de recálculo | **Next.js Server Route** (Opção C) em vez de Supabase Edge Function | Dev solo no Windows — symlinks Deno geram fricção real; Node.js importa `lib/pontuacao.ts` diretamente; DRY preservado |

---

## 3. O que F10 entrega

**Entrega:**
- Página `/admin/jogos` com tabs por fase + filtros + linhas editáveis
- Resolução de placeholders de mata-mata (selects + atalho "Sugerir vencedor")
- Inserção de placar + marcar jogo como finalizado (automático dispara recálculo)
- Botão "Recalcular" por jogo (re-processa jogo já finalizado)
- Formulário `copa_resultados` na tab "Bônus" (campeão, vice, 3º, 4º, artilheiro, revelação)
- Recálculo de bônus por campo alterado + botão "Recalcular bônus"
- Botão "Recalcular tudo" no overview (`/admin`) — dispara recálculo global assíncrono
- Tabela `recalculo_jobs` + Realtime feedback de progresso no global
- Sidebar: "Jogos & Resultados" deixa de ser "em breve" e vira Link ativo
- `lib/recalculo.ts` — funções puras testáveis que mapeiam rows para UPDATE payloads

**Não entrega:**
- Integração API-Football (F12) — F10 é inserção manual
- Cashbacks (F11)
- Paginação da lista de jogos (104 jogos cabem em uma tab; mobile scroll)

---

## 4. Rotas e arquitetura de arquivos

```
app/
  (admin)/
    admin/
      page.tsx                   ← F9 (adiciona botão "Recalcular tudo" + widget RecalculoGlobalStatus)
      jogos/
        page.tsx                 ← Server Component: busca jogos + copa_resultados
        JogosClient.tsx          ← Client Component: tabs + filtros + estado da tela
    layout.tsx                   ← F9 (não muda)

  api/
    admin/
      recalcular/
        route.ts                 ← POST { tipo: 'jogo'|'bonus'|'global', jogoId?, bonusTipos? }
      copa-resultados/
        route.ts                 ← GET (retorna id=1) + PUT (salva + dispara recálculo bônus)
      jogos/
        [id]/
          route.ts               ← PATCH (resolve placeholder: selecao_casa_id/selecao_fora_id)
      recalculo-jobs/
        [id]/
          route.ts               ← GET status de job específico

components/admin/
  AdminSidebar.tsx               ← atualiza "Jogos & Resultados" de span para Link
  JogoRow.tsx                    ← linha de jogo com placar editável + ações
  PlaceholderSelect.tsx          ← select de seleção para resolver placeholder
  BonusForm.tsx                  ← formulário copa_resultados (tab Bônus)
  RecalculoGlobalStatus.tsx      ← Client: Realtime da tabela recalculo_jobs, mostra progresso

lib/
  pontuacao.ts                   ← F5, não muda
  recalculo.ts                   ← NOVO: mapeia rows para UPDATE payloads (sem I/O)
  __tests__/
    recalculo.test.ts            ← testes TDD de lib/recalculo.ts

supabase/migrations/
  20260504000000_recalculo_jobs.sql   ← tabela recalculo_jobs + RLS
```

---

## 5. Tela `/admin/jogos`

### 5.1 Tabs por fase

```
[Grupos] [16avos] [Oitavas] [Quartas] [Semis] [Disputa 3º] [Final] [Bônus]
```

**Tab inicial automática:**
- Se nenhum jogo finalizado ainda → "Grupos"
- Senão → fase da maioria dos jogos finalizados mais recentes (query no Server Component)

**Filtros no topo de cada tab (exceto Bônus):**

```
Status: [Todos ▼]  [Todos | Pendentes | Finalizados]
                                           [☑ Só com placeholder pendente]  ← apenas tabs mata-mata
```

O toggle "placeholder pendente" aparece apenas nas tabs `16avos` a `Final`. Filtra jogos onde `selecao_casa_id IS NULL OR selecao_fora_id IS NULL`.

**Ordenação:** `data_hora ASC` (próximo a finalizar fica no topo de "Pendentes").

### 5.2 Visual de cada `JogoRow`

```
#45 · 27/06 · 16:00 | 🇧🇷 Brasil  [2] × [1]  🇦🇷 Argentina | [✓ Finalizado]  [Recalcular]
#49 · 01/07 · 20:00 | [?] Venc. J45  [_] × [_]  [?] Venc. J46 | ⚠ Placeholder pendente  [Resolver] [Marcar finalizado ↓]
```

Colunas do layout (CSS Grid, mobile-first):

| Col | Conteúdo |
|-----|----------|
| Jogo | `#numero_jogo · DD/MM · HH:mm` |
| Casa | `[bandeira_emoji] Nome` (ou `[?] placeholder_casa`) |
| Placar | `[input] × [input]` (readonly se finalizado) |
| Fora | `[bandeira_emoji] Nome` (ou `[?] placeholder_fora`) |
| Status | pill: `Finalizado` (verde) / `Pendente` (cinza) / `Placeholder pendente` (amarelo) |
| Ações | botões contextuais (§5.3) |

Em mobile (< 768px): layout empilhado — placar centralizado, times acima e abaixo.

### 5.3 Estados e ações contextuais por jogo

**Jogo de grupo sem placeholder:**

| Estado | Ações visíveis |
|--------|----------------|
| Pendente | inputs de gols + `[Marcar finalizado]` (disabled se gols null) |
| Finalizado | gols readonly + `[Recalcular]` |

**Jogo de mata-mata com placeholder pendente:**

| Estado | Ações visíveis |
|--------|----------------|
| Placeholder pendente | `PlaceholderSelect` × 2 + botão `[Sugerir vencedor]` por lado + `[Salvar seleções]` |
| Seleções resolvidas, pendente | inputs de gols + `[Marcar finalizado]` |
| Finalizado | gols readonly + `[Recalcular]` |

### 5.4 PlaceholderSelect + atalho "Sugerir vencedor"

Componente `PlaceholderSelect` — select de todas as 48 seleções (nome + bandeira).

**Atalho "Sugerir vencedor do Jogo X":**

1. Parser extrai número de jogo do placeholder: `"Vencedor Jogo 45"` → `45`
2. Busca jogo 45 na lista já carregada no Client Component
3. Lógica de sugestão:
   - Jogo 45 não finalizado → botão disabled, tooltip: "Jogo 45 ainda não finalizado"
   - Jogo 45 finalizado, gols_casa > gols_fora → sugere `selecao_casa_id`
   - Jogo 45 finalizado, gols_fora > gols_casa → sugere `selecao_fora_id`
   - Jogo 45 finalizado, gols_casa === gols_fora → botão disabled, tooltip: "Jogo empatado após prorrogação — vencedor nos pênaltis, define manualmente"
4. Clique preenche o select mas **não salva automaticamente** — admin ainda clica "Salvar seleções"

**Salvar seleções:** `PATCH /api/admin/jogos/[id]` com `{ selecao_casa_id, selecao_fora_id }`. Não aciona recálculo (jogo ainda não finalizado).

**Validação ao clicar "Marcar finalizado":**
- `gols_casa` e `gols_fora` devem ser inteiros ≥ 0
- Para mata-mata: `selecao_casa_id` e `selecao_fora_id` devem ser não-null
- Se validação falha: botão permanece disabled com mensagem inline

### 5.5 Ação "Marcar finalizado"

1. Client: validação local (gols não null, seleções resolvidas se mata-mata)
2. `POST /api/admin/recalcular` com `{ tipo: 'jogo', jogoId, gols_casa, gols_fora }`
3. Server Route (§7.1): salva gols + `finalizado = true` + recalcula palpites do jogo
4. Spinner no botão durante a operação
5. Sucesso: toast `"Jogo #X finalizado — N palpites recalculados"`, linha muda para estado "Finalizado"
6. Erro: toast de erro com mensagem

### 5.6 Tab "Bônus"

Renderiza `BonusForm` com o formulário de `copa_resultados`. Ver §6.

---

## 6. Formulário `copa_resultados` (tab Bônus)

### 6.1 Layout do `BonusForm`

```
┌── Resultados finais da Copa ────────────────────────────────┐
│  Campeão    [select seleção ▼]                  [Salvar]    │
│  Vice       [select seleção ▼]                  [Salvar]    │
│  3º lugar   [select seleção ▼]                  [Salvar]    │
│  4º lugar   [select seleção ▼]                  [Salvar]    │
│  Artilheiro [text input — nome do jogador]      [Salvar]    │
│  Revelação  [select seleção ▼] (opcional)       [Salvar]    │
│                                                             │
│  [☐ Copa finalizada]  ← habilita só quando obrigatórios ok │
│                                                             │
│  [Recalcular todos os bônus]                                │
└─────────────────────────────────────────────────────────────┘
```

Cada campo tem botão "Salvar" individual — admin preenche conforme Copa avança, não precisa preencher tudo de uma vez. Campos vazios = null no banco (nenhum bilhete marca ponto para esse tipo).

### 6.2 Fluxo de salvar um campo

1. Admin preenche campo + clica "Salvar" (ex: Campeão → Brasil)
2. `PUT /api/admin/copa-resultados` com `{ campeao_id: 10 }` (apenas o campo alterado)
3. Server Route: `UPDATE copa_resultados SET campeao_id = 10 WHERE id = 1`
4. Em seguida, dispara recálculo dos bônus do tipo alterado: chama internamente a lógica de recálculo com `bonusTipos: ['campeao']`
5. Toast: `"Campeão salvo — N bilhetes com bônus recalculados"`

### 6.3 Flag `copa_resultados.finalizada`

Checkbox "Copa finalizada" — habilitado apenas quando:
- `campeao_id IS NOT NULL`
- `vice_id IS NOT NULL`
- `terceiro_id IS NOT NULL`
- `quarto_id IS NOT NULL`
- `artilheiro_nome IS NOT NULL`
- (revelacao_id pode ser null)

Salvar `finalizada = true` não dispara nenhuma ação extra (todos os recálculos já ocorreram individualmente).

### 6.4 Botão "Recalcular todos os bônus"

`POST /api/admin/recalcular` com `{ tipo: 'bonus' }` (sem filtro → recalcula todos os 6 tipos).

Síncrono, spinner até terminar. Toast com total de bilhetes processados.

---

## 7. API Routes

### 7.1 `POST /api/admin/recalcular`

```ts
// Corpo do request
type RecalcularBody =
  | { tipo: 'jogo'; jogoId: number; gols_casa: number; gols_fora: number }
  | { tipo: 'jogo'; jogoId: number }                 // re-recálculo (placar já no banco)
  | { tipo: 'bonus'; bonusTipos?: TipoBonus[] }       // null → todos os tipos
  | { tipo: 'global' }
```

**Guard (todas as routes):** `createSupabaseServerClient` para verificar auth do usuário → `supabaseAdmin` para checar `profiles.is_admin`. Retorna 403 se não for admin. Mesmo padrão do `layout.tsx` de F9.

**Tipo `'jogo'` (com gols_casa/gols_fora):**
1. Validar body com Zod
2. `UPDATE jogos SET gols_casa, gols_fora, finalizado = true, updated_at = now() WHERE id = jogoId`
3. `SELECT id, gols_casa, gols_fora FROM palpites JOIN bilhetes ON bilhete_id = bilhetes.id WHERE jogo_id = jogoId AND status_pagamento = 'confirmado'`
4. `SELECT fase, gols_casa, gols_fora FROM jogos WHERE id = jogoId`
5. `calcularUpdatesPalpites(palpites, jogo)` → array de `{ id, pontos_calculados }`
6. Bulk UPDATE via `supabaseAdmin.from('palpites').upsert(updates)` (upsert por id preserva idempotência)
7. Return `{ total: updates.length }`

**Tipo `'jogo'` (sem gols — re-recálculo):**
- Pula o UPDATE de jogos, vai direto para SELECT + recálculo
- Jogo deve estar `finalizado = true`, senão retorna 400

**Tipo `'bonus'`:**
1. `SELECT id, campeao_id, vice_id, terceiro_id, quarto_id, artilheiro_nome, revelacao_id FROM copa_resultados WHERE id = 1`
2. `SELECT id, tipo, selecao_id, jogador_nome FROM palpites_bonus WHERE tipo = ANY(bonusTipos) JOIN bilhetes ON ... WHERE status_pagamento = 'confirmado'`
3. `calcularUpdateBonus(bonusRows, resultados, bonusTipos)` → array de `{ id, pontos_calculados }`
4. Bulk UPDATE `palpites_bonus`
5. Return `{ total }`

**Tipo `'global'`:**
1. `INSERT INTO recalculo_jobs (escopo, status) VALUES ('global', 'processando') RETURNING id`
2. Return `{ jobId }` com status 202 imediatamente
3. Fire-and-forget com Vercel Fluid Compute:
   ```ts
   processarGlobal(jobId, adminClient).catch(err =>
     adminClient.from('recalculo_jobs')
       .update({ status: 'erro', erro_msg: err.message, finished_at: new Date() })
       .eq('id', jobId)
   )
   return NextResponse.json({ jobId }, { status: 202 })
   ```
4. `processarGlobal`: itera todos os jogos finalizados → recalcula palpites de cada um → recalcula todos os bônus → UPDATE `recalculo_jobs` com `status: 'concluido', total_processados, finished_at`

**Idempotência:** upsert por `id` garante que rodar 2x produz o mesmo resultado.

### 7.2 `GET /api/admin/copa-resultados`

Retorna linha `id = 1` da tabela `copa_resultados`. Guard admin.

### 7.3 `PUT /api/admin/copa-resultados`

Body: `Partial<{ campeao_id, vice_id, terceiro_id, quarto_id, artilheiro_nome, revelacao_id, finalizada }>`.

1. Valida body com Zod (tipos corretos, ids existem em `selecoes`)
2. Extrai quais campos foram alterados que afetam bônus
3. `UPDATE copa_resultados SET ... WHERE id = 1`
4. Dispara recálculo dos tipos afetados (mesma lógica de `tipo: 'bonus'` com `bonusTipos` filtrado)
5. Return `{ updated: true, total_bonus_recalculados }`

**Validação de `finalizada = true`:**
```ts
if (body.finalizada === true) {
  // verifica que campeao_id, vice_id, terceiro_id, quarto_id, artilheiro_nome não são null
  // em copa_resultados atualizado; retorna 400 se faltar
}
```

### 7.4 `PATCH /api/admin/jogos/[id]`

Body: `{ selecao_casa_id?: number; selecao_fora_id?: number }`.

Atualiza apenas as seleções do jogo (resolve placeholder). Não finaliza o jogo, não recalcula. Guard admin.

### 7.5 `GET /api/admin/recalculo-jobs/[id]`

Retorna `{ id, status, total_processados, erro_msg, started_at, finished_at }`. Guard admin. Usado como fallback se Realtime falhar.

---

## 8. `lib/recalculo.ts` — funções puras

Módulo sem I/O. Recebe dados já buscados, retorna arrays de UPDATE payloads. Toda a lógica testável.

```ts
import { calcularPontosPalpite, calcularPontosBonus } from './pontuacao'
import type { FaseJogo, TipoBonus, CopaResultadosInput } from './pontuacao'

// Palpite row (subset do banco)
export type PalpiteRow = {
  id: string
  gols_casa: number
  gols_fora: number
}

// Jogo row (subset do banco, jogo finalizado)
export type JogoFinalizado = {
  fase: FaseJogo
  gols_casa: number
  gols_fora: number
}

// Bonus row (subset do banco)
export type BonusRow = {
  id: string
  tipo: TipoBonus
  selecao_id?: number | null
  jogador_nome?: string | null
}

// Payload para UPDATE
export type UpdatePayload = {
  id: string
  pontos_calculados: number
}

/** Mapeia palpites de um jogo finalizado para UPDATE payloads. */
export function calcularUpdatesPalpites(
  palpites: PalpiteRow[],
  jogo: JogoFinalizado,
): UpdatePayload[]

/** Mapeia bonus rows para UPDATE payloads dado copa_resultados.
 *  filtroTipos: undefined → todos; [] → nenhum; ['campeao'] → só campeão. */
export function calcularUpdateBonus(
  bonusRows: BonusRow[],
  resultados: CopaResultadosInput,
  filtroTipos?: TipoBonus[],
): UpdatePayload[]
```

---

## 9. `recalculo_jobs` — migration e RLS

```sql
-- supabase/migrations/20260504000000_recalculo_jobs.sql

CREATE TABLE public.recalculo_jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  escopo          text        NOT NULL CHECK (escopo IN ('jogo', 'bonus', 'global')),
  jogo_id         smallint    REFERENCES public.jogos(id),
  bonus_tipos     text[],
  status          text        NOT NULL DEFAULT 'processando'
                              CHECK (status IN ('processando', 'concluido', 'erro')),
  total_processados int,
  erro_msg        text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

ALTER TABLE public.recalculo_jobs ENABLE ROW LEVEL SECURITY;

-- Service_role (API routes) pode escrever; admins autenticados podem ler
CREATE POLICY "admins can read jobs" ON public.recalculo_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
-- Inserts/updates exclusivamente via service_role (sem policy INSERT/UPDATE = bloqueado para anon/authenticated)

-- Habilita Realtime na tabela para feedback de progresso
ALTER PUBLICATION supabase_realtime ADD TABLE public.recalculo_jobs;
```

---

## 10. `RecalculoGlobalStatus` — widget no overview

Client Component que subscreve via Supabase Realtime na tabela `recalculo_jobs` (filtrado por `escopo = 'global'`). Exibido na seção "Ações do sistema" do `/admin`, abaixo do `SnapshotRanking` já existente.

```
┌── Recálculo global ─────────────────────────────────────────┐
│  [Recalcular tudo]                                          │
│                                                             │
│  Último job: 04/05 14:32 — ✅ 1.847 palpites + bônus        │
│  (ou)                                                       │
│  ⏳ Em andamento... iniciado há 12s                         │
└─────────────────────────────────────────────────────────────┘
```

**Fluxo:**
1. Admin clica "Recalcular tudo"
2. `POST /api/admin/recalcular` `{ tipo: 'global' }` → retorna `{ jobId }` (202)
3. Componente inicia subscription Realtime em `recalculo_jobs` filtrada por `id = jobId`
4. Quando `status` muda para `'concluido'`: toast `"Recálculo concluído — N palpites processados"`
5. Quando `status` muda para `'erro'`: toast de erro com `erro_msg`
6. Fallback: se Realtime não chegar em 30s, faz GET polling no `/api/admin/recalculo-jobs/[id]`

---

## 11. Sidebar: habilitar "Jogos & Resultados"

Em `components/admin/AdminSidebar.tsx` (F9), o item "Jogos & Resultados" está renderizado como `<span>` com badge "em breve". F10 o converte para `<Link href="/admin/jogos">` ativo. Remove o badge.

---

## 12. Botão "Recalcular tudo" no overview

Adicionado à seção "Ações do sistema" de `app/(admin)/admin/page.tsx` como Server Component prop para o Client Component `RecalculoGlobalStatus`. Não quebra o Server Component puro — apenas inclui o Client Component.

---

## 13. TDD — cobertura obrigatória

`lib/recalculo.ts` é a camada testável. Testes em `lib/__tests__/recalculo.test.ts`.

**Casos obrigatórios para `calcularUpdatesPalpites`:**

| Caso | palpite | jogo (fase grupos, gols_casa=2, gols_fora=1) | esperado |
|------|---------|----------------------------------------------|---------|
| Placar exato | 2×1 | 2×1 | 10 pts |
| Vencedor + saldo | 3×2 | 2×1 | 7 pts |
| Só vencedor | 3×1 | 2×1 | 5 pts |
| Parcial | 1×3 | 2×1 (`gols_casa=2`) | 2 pts |
| Erro | 0×3 | 2×1 | 0 pts |
| Fase final (×4) | 2×1 | final, 2×1 | 40 pts |
| Idempotência | roda 2x | mesmo jogo | mesmo resultado |
| Lista vazia | [] | qualquer | [] |

**Casos obrigatórios para `calcularUpdateBonus`:**

| Caso | bonus | resultados | filtro | esperado |
|------|-------|------------|--------|---------|
| Acertou campeão | `{ tipo: 'campeao', selecao_id: 10 }` | `campeao_id: 10` | — | 50 pts |
| Errou campeão | `{ tipo: 'campeao', selecao_id: 5 }` | `campeao_id: 10` | — | 0 pts |
| Artilheiro com acento | `{ tipo: 'artilheiro', jogador_nome: 'Mbappé' }` | `artilheiro_nome: 'mbappe'` | — | 25 pts |
| Resultado null | `{ tipo: 'vice', selecao_id: 7 }` | `vice_id: null` | — | 0 pts |
| Filtro de tipo | campeao + vice | ambos acertos | `['campeao']` | só campeão recalculado |
| Filtro vazio | qualquer | qualquer | `[]` | [] |

---

## 14. Segurança

- Guard `is_admin` em **todas** as API routes (GET, POST, PUT, PATCH) — mesma lógica do layout F9
- `supabaseAdmin` (service_role) usado apenas dentro dos Route Handlers — nunca exposto ao client
- Validação Zod em todos os bodies de entrada antes de tocar o banco
- Coluna `gols_casa`/`gols_fora` da tabela `jogos` tem `CHECK (gols >= 0)` (F2) — defesa em profundidade
- `recalculo_jobs`: writes exclusivos via service_role (sem policy INSERT/UPDATE para authenticated)

---

## 15. Contrato com F11

- F11 (cashbacks) usa `admin/cashbacks` na sidebar — já está mapeado como "em breve" em F9
- F10 não toca em `bilhetes.cashback_pago` nem em exposição financeira — escopo de F11
- A view `ranking` (F5) é recalculada dinamicamente sobre `pontos_calculados` — após F10 popular os valores, o ranking reflete automaticamente sem migration adicional

---

## 16. Dependências novas

- Nenhuma dependência npm nova: `lib/pontuacao.ts` é suficiente, Supabase Realtime já está configurado desde F8
- Migration: `20260504000000_recalculo_jobs.sql` (nova tabela + RLS + Realtime)
