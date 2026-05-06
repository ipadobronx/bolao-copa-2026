# Feature 16 — Dashboard inteligente baseado em estado do user

**Data:** 2026-05-06
**Status:** Aprovado para implementação
**Autor:** Brainstorm conduzido com Jonatas
**Próximo passo:** writing-plans → executing-plans em worktree separado (plano-alvo 700–800 linhas)

---

## 1. Contexto e motivação

Décima sexta feature da seção 5 do `CLAUDE.md`. F1–F15 mergeadas — sistema em produção em `https://malanacopa.com.br`. F15 entregou o redesign da landing "Mala na Copa". O `/dashboard` atual (entregue na F4) só mostra o painel "Próximos jogos · Copa 2026" e um header genérico — não responde ao estado real do user no funil (sem bilhete → comprou pendente → confirmou → Copa começou).

Esta feature reescreve `/dashboard` como Server Component que **discrimina o estado do user** e renderiza conteúdo apropriado pra cada situação:

- **Estado A** (sem bilhete) — hero card grande com CTA pra comprar.
- **Estado B** (pendente puro, sem confirmado) — alerta de PIX dominante.
- **Estado C** (≥1 confirmado, Copa não começou) — countdown + progresso de palpites.
- **Estado D** (≥1 confirmado, Copa em andamento) — pontos + posição + progresso, com tendência.

User com confirmado **e** pendente simultâneos (ex: comprando mais tabelas) cai em C/D com banner aditivo, **não** em B — Estado B só pra quem ainda não pagou nenhuma tabela.

---

## 2. Decisões registradas durante o brainstorming

| # | Pergunta | Escolha | Motivação |
|---|----------|---------|-----------|
| Q1 | Colisão "confirmado + pendente" | **C — pendente sobrescreve só se user não tem confirmado**. Senão entra como banner aditivo em C/D. | UX: esconder stats de quem já tem tabelas pagas é regressão. Brief literal "precisa pagar primeiro" só faz sentido pra primeiro PIX. |
| Q2a | Bônus contam no % palpites preenchidos | **Não.** Apenas os 104 jogos. | Bônus tem deadline único, ficam read-only depois — UX diferente. Mistura confunde. |
| Q2b | Denominador do % em Estado D (Copa em andamento) | **Fixo em 104 × N (N = bilhetes confirmados).** | Honesto, simples, brief literal. Em Estado C (onde o card mais importa) é a meta urgente; em D é o gauge de cobertura. |
| Q3 | Composição dos cards | **B — criar `DashboardStatCard` composicional novo, admin intocado.** | Zero risco de regressão em F9–F11. `.panel` class compartilhada já garante consistência visual. Hero (Estado A) e Pendente (Estado B) viram componentes próprios. |
| — | Variant do `DashboardPendentePix` | **Único componente, prop `variant: 'hero' \| 'banner'`.** | Economia de arquivo + força copy consistente. |

---

## 3. Estado discriminado e função pura de decisão

### 3.1 Tipo de saída

```ts
// lib/dashboard/estado.ts
export type PendenteInfo = {
  bilhete_id: string                  // alvo do CTA — pendente mais recente (max created_at)
  numero_bilhete: number              // do bilhete alvo
  valor_total_pendente: number        // SUM(valor_pago) de TODOS os pendentes do user
  qtd_pendentes: number               // count de pendentes
}

export type ProgressoInfo = {
  preenchidos: number                 // palpites do user em bilhetes confirmados
  total: number                       // bilhetes_confirmados.count × 104
  porcentagem: number                 // Math.round(preenchidos / total × 100); 0 se total = 0
  totalBilhetes: number               // count de confirmados
}

export type RankingUsuarioInfo = {
  melhor_bilhete_id: string
  melhor_numero_bilhete: number
  pontos_totais: number
  posicao: number
  total_bilhetes: number              // de ranking_usuarios.total_bilhetes
}

export type DashboardEstado =
  | { kind: 'sem-bilhete' }
  | { kind: 'pendente-puro';   pendente: PendenteInfo }
  | { kind: 'pre-copa';        pendente: PendenteInfo | null; copaInicio: Date; progresso: ProgressoInfo }
  | { kind: 'em-andamento';    pendente: PendenteInfo | null; rankingUsuario: RankingUsuarioInfo;
                               progresso: ProgressoInfo;
                               tendenciaPontos: number | null;     // null = sem snapshot; 0 = ━
                               tendenciaPosicao: number | null;
                               totalParticipantes: number }
```

### 3.2 Lógica de decisão (cascata)

```ts
function determinarEstadoDashboard(input): DashboardEstado {
  const tem_confirmado = input.bilhetes.some(b => b.effective_status === 'confirmado')
  const tem_pendente   = input.bilhetes.some(b => b.effective_status === 'pendente')
  const copa_comecou   = input.jogosFinalizadosCount > 0

  if (!tem_confirmado && !tem_pendente)  return { kind: 'sem-bilhete' }
  if (!tem_confirmado &&  tem_pendente)  return { kind: 'pendente-puro', pendente: ... }
  if ( tem_confirmado && !copa_comecou)  return { kind: 'pre-copa',     pendente: ... ?? null, ... }
  return { kind: 'em-andamento', pendente: ... ?? null, rankingUsuario: ..., ... }
}
```

`effective_status` vem de `bilhetes_view` (já existe da F6) — pendente expirado já é `expirado`, não polui o cálculo.

### 3.3 Edge graceful: `ranking_usuarios` vazio com `tem_confirmado=true`

Possível em janela de race entre INSERT do bilhete e materialização da view. Decisão: degrada pra `pre-copa` (sem stats de pontos/posição). Comentário inline na função.

---

## 4. Data fetching — Server Component

`Promise.all` com 5 queries; uma 6ª condicional pra snapshot quando `kind === 'em-andamento'`. Uma 7ª pra `totalParticipantes` (só roda em em-andamento).

```ts
const [bilhetesRes, rankingRes, palpitesCountRes, jogosFutRes, jogoFinRes] = await Promise.all([
  // 1. Bilhetes do user com effective_status (estado + cálculo de pendente)
  supabase.from('bilhetes_view')
    .select('id, numero_bilhete, valor_pago, mp_payment_id, effective_status, created_at')
    .eq('user_id', user.id),

  // 2. Linha do user em ranking_usuarios (1 row ou 0)
  supabase.from('ranking_usuarios')
    .select('melhor_bilhete_id, melhor_numero_bilhete, pontos_totais, posicao, total_bilhetes')
    .eq('user_id', user.id)
    .maybeSingle(),

  // 3. Count de palpites do user (RPC nova)
  supabase.rpc('count_palpites_confirmados', { uid: user.id }),

  // 4. Próximos 5 jogos não finalizados (mesma query do dashboard atual)
  supabase.from('jogos').select('id, data_hora, fase, placeholder_casa, placeholder_fora, casa:selecoes!selecao_casa_id(nome, bandeira_emoji), fora:selecoes!selecao_fora_id(nome, bandeira_emoji)')
    .gt('data_hora', new Date().toISOString())
    .order('data_hora', { ascending: true })
    .limit(5),

  // 5. Detector "Copa começou" — count exact com head=true (zero data shipping)
  supabase.from('jogos').select('id', { head: true, count: 'exact' }).eq('finalizado', true),
])

// Pós-fase (somente se em-andamento): 2 queries adicionais em paralelo
let tendenciaPontos = null, tendenciaPosicao = null, totalParticipantes = 0
if (kind === 'em-andamento') {
  const [snapRes, totalRes] = await Promise.all([
    supabase.from('ranking_snapshots').select('posicao, pontos_totais')
      .eq('user_id', user.id).order('snapshot_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('ranking_usuarios').select('user_id', { head: true, count: 'exact' }),
  ])
  if (snapRes.data) {
    tendenciaPontos  = rankingUsuario.pontos_totais - snapRes.data.pontos_totais
    tendenciaPosicao = snapRes.data.posicao - rankingUsuario.posicao  // invertida: < posicao = melhor
  }
  totalParticipantes = totalRes.count ?? 0
}
```

### 4.1 RPC nova: `count_palpites_confirmados`

```sql
-- supabase/migrations/20260506000000_f16_count_palpites.sql
CREATE OR REPLACE FUNCTION public.count_palpites_confirmados(uid uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT COUNT(p.id)::int
  FROM palpites p
  JOIN bilhetes b ON b.id = p.bilhete_id
  WHERE b.user_id = uid AND b.status_pagamento = 'confirmado'
$$;

GRANT EXECUTE ON FUNCTION public.count_palpites_confirmados(uuid) TO authenticated;
```

`SECURITY INVOKER` + RLS em `palpites` e `bilhetes` já fecha o acesso. RLS atual permite o user ler seus próprios `palpites` e `bilhetes`, então a RPC retorna o count correto sem bypass.

### 4.2 Cálculo de `progresso` e `pendente`

```ts
const confirmados = bilhetes.filter(b => b.effective_status === 'confirmado')
const pendentesArr = bilhetes.filter(b => b.effective_status === 'pendente')

const progresso: ProgressoInfo = {
  preenchidos: palpitesCount,
  total: confirmados.length * 104,
  porcentagem: confirmados.length === 0 ? 0 : Math.round(palpitesCount / (confirmados.length * 104) * 100),
  totalBilhetes: confirmados.length,
}

const pendente: PendenteInfo | null = pendentesArr.length === 0 ? null : (() => {
  const sorted = [...pendentesArr].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  const alvo = sorted[0]!
  return {
    bilhete_id: alvo.id,
    numero_bilhete: alvo.numero_bilhete,
    valor_total_pendente: pendentesArr.reduce((s, b) => s + (b.valor_pago ?? 0), 0),
    qtd_pendentes: pendentesArr.length,
  }
})()
```

---

## 5. Componentes

### 5.1 Árvore (resumida)

```
app/(dashboard)/dashboard/page.tsx                  ← Server, force-dynamic, switch por estado
components/dashboard/
  DashboardStatCard.tsx                             ← composicional via children
  DashboardEmptyHero.tsx                            ← Estado A
  DashboardPendentePix.tsx                          ← Estado B / banner C/D (variant prop)
  CardPontos.tsx                                    ← wrapper de DashboardStatCard
  CardPosicao.tsx
  CardProgresso.tsx                                 ← inclui barra de progresso
  CardCountdown.tsx
  TrendIndicator.tsx                                ← ▲▼━ inline
  DashboardHeader.tsx                               ← MODIFICADO: aceita prop subtitle
lib/dashboard/
  estado.ts                                         ← determinarEstadoDashboard (puro)
  estado.test.ts
  countdown.ts                                      ← formatDiasHoras(de, ate) → { dias, horas }
  countdown.test.ts
supabase/migrations/
  20260506000000_f16_count_palpites.sql             ← RPC nova
```

### 5.2 Mudanças em arquivos existentes

| Arquivo | Mudança |
|---|---|
| `app/(dashboard)/dashboard/page.tsx` | Reescrita completa — fetches, `determinarEstadoDashboard`, switch por kind. |
| `components/dashboard/DashboardHeader.tsx` | Aceita prop `subtitle: string` em vez de hardcodar copy. |
| `components/dashboard/ProximosJogosPanel.tsx` | Sem mudanças — reusa as-is. |

### 5.3 Subtitle por estado

| Estado | Subtitle do `DashboardHeader` |
|---|---|
| `sem-bilhete` | "Sua primeira tabela te espera" |
| `pendente-puro` | "Você tem um pagamento pendente" |
| `pre-copa` | `\`Faltam ${dias} dias pra Copa começar\`` (ou "Copa começa hoje!" se `dias === 0`) |
| `em-andamento` | "Copa em andamento — vê seu desempenho" |

### 5.4 `DashboardStatCard` (assinatura)

```tsx
type DashboardStatCardProps = {
  label: string
  icon: React.ReactNode                              // Lucide Icon (size-5 esperado)
  colorClass: 'green' | 'yellow' | 'blue' | 'red'    // mesmas paletas do KpiCard
  children: React.ReactNode
}
```

Mesma `.panel` class do KpiCard (admin) e ProximosJogosPanel — consistência visual via tokens, não acoplamento de código.

**Mapeamento de cor por card (sugestão):**

| Card | `colorClass` | Ícone Lucide |
|---|---|---|
| `CardPontos` | `'yellow'` | `<Trophy>` |
| `CardPosicao` | `'blue'` | `<TrendingUp>` |
| `CardProgresso` | `'green'` | `<CheckCircle2>` |
| `CardCountdown` | `'red'` | `<Clock>` |

### 5.5 `TrendIndicator`

```tsx
type TrendIndicatorProps = { delta: number; unit?: 'pts' | 'pos' }
// delta > 0 → ▲ verde + número (ex: "▲ 5 pts" ou "▲ 3")
// delta < 0 → ▼ vermelho + Math.abs(número)
// delta = 0 → ━ cinza, sem número
// Não renderiza nada se delta === null no caller (responsabilidade do caller, prop é number).
```

### 5.6 `lib/dashboard/countdown.ts`

```ts
export function formatDiasHoras(de: Date, ate: Date): { dias: number; horas: number } {
  const ms = +ate - +de
  if (ms <= 0) return { dias: 0, horas: 0 }
  const horasTotal = Math.floor(ms / (1000 * 60 * 60))
  return { dias: Math.floor(horasTotal / 24), horas: horasTotal % 24 }
}
```

Sem live update — Server Component re-renderiza ao próximo nav. Aceitável: mobile-first, user volta pro dashboard ocasionalmente, não fica travado nele.

---

## 6. Layout por estado (markup essencial)

### 6.1 Estado A (`sem-bilhete`)

```tsx
<DashboardHeader nome={...} subtitle="Sua primeira tabela te espera" />
<DashboardEmptyHero />
{/* sem ProximosJogos, sem cards */}
```

`DashboardEmptyHero` — full-width, borda em destaque, glow `bg-accent/5 blur-3xl` de fundo, `<Lock className="size-16 text-accent">` centralizado, headline `font-display text-3xl md:text-5xl`, subtext `text-text-secondary max-w-md`, CTA `<Link href="/comprar">Comprar tabela →</Link>` (`btn btn-primary`).

### 6.2 Estado B (`pendente-puro`)

```tsx
<DashboardHeader subtitle="Você tem um pagamento pendente" />
<DashboardPendentePix variant="hero" pendente={pendente} />
<ProximosJogosPanel jogos={jogos} />
```

`DashboardPendentePix variant='hero'` — panel `border-accent/60 bg-accent/5 p-8 md:p-10`, ícone `<AlertTriangle>` + "Você tem PIX pendente", `font-display text-2xl md:text-3xl` com valor BRL destacado em `text-accent`, subtext "Em até 30 minutos pra não perder sua tabela", linha `font-mono text-xs` "Bilhete #N" (+ "· X tabelas pendentes" se `qtd_pendentes > 1`), CTA `<Link href={\`/comprar/${pendente.bilhete_id}/pix\`}>Pagar agora →</Link>`.

### 6.3 Estado C (`pre-copa`)

```tsx
<DashboardHeader subtitle={dias === 0 ? "Copa começa hoje!" : `Faltam ${dias} dias pra Copa começar`} />
{pendente && <DashboardPendentePix variant="banner" pendente={pendente} />}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
  <CardCountdown copaInicio={copaInicio} />
  <CardProgresso progresso={progresso} />
</div>
<ProximosJogosPanel jogos={jogos} />
{progresso.porcentagem < 100 && (
  <Link href="/palpites" className="text-accent hover:underline text-sm inline-flex items-center gap-1 mt-4">
    Fazer palpites →
  </Link>
)}
```

`DashboardPendentePix variant='banner'` — slim, 1 linha, panel `border-accent/60 bg-accent/5 px-5 py-3 hover:bg-accent/10`, AlertTriangle + "PIX de **R$ X** pendente" + "(N tabelas)" condicional, link inteiro clicável apontando pro `/comprar/[id]/pix`.

### 6.4 Estado D (`em-andamento`)

```tsx
<DashboardHeader subtitle="Copa em andamento — vê seu desempenho" />
{pendente && <DashboardPendentePix variant="banner" pendente={pendente} />}
<div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
  <CardPontos pontos={r.pontos_totais} numeroBilhete={r.melhor_numero_bilhete}
              totalBilhetes={r.total_bilhetes} tendencia={tendenciaPontos} />
  <CardPosicao posicao={r.posicao} totalParticipantes={totalParticipantes} tendencia={tendenciaPosicao} />
  <CardProgresso progresso={progresso} />
</div>
<ProximosJogosPanel jogos={jogos} />
<div className="flex flex-wrap gap-4 mt-4">
  <Link href="/ranking" className="text-accent hover:underline text-sm">Ver ranking completo →</Link>
  {progresso.porcentagem < 100 && (
    <Link href="/palpites" className="text-accent hover:underline text-sm">Fazer palpites →</Link>
  )}
</div>
```

`CardPontos` exemplo de wrapper:

```tsx
<DashboardStatCard label="Pontuação" icon={<Trophy className="size-5" />} colorClass="yellow">
  <div className="flex items-baseline gap-2">
    <span className="font-display text-4xl tracking-wide">{pontos}</span>
    {tendencia !== null && <TrendIndicator delta={tendencia} unit="pts" />}
  </div>
  <div className="text-text-muted text-xs mt-1 font-mono">
    Bilhete #{numeroBilhete}{totalBilhetes > 1 ? ' · sua melhor tabela' : ''}
  </div>
</DashboardStatCard>
```

`CardProgresso` inclui barra: `<div className="bg-bg-elevated h-2 rounded-full overflow-hidden mt-3"><div style={{ width: \`${progresso.porcentagem}%\` }} className="bg-accent h-full transition-[width]" /></div>` + subtext `font-mono` "150/312 palpites preenchidos · 3 tabelas" (sufixo "· N tabelas" só se `totalBilhetes > 1`).

---

## 7. Edge cases (tabela completa)

| Cenário | Comportamento |
|---|---|
| User não autenticado | Middleware redireciona pra `/login` (já existe). Page faz `getUser()` defensivo, `redirect('/login')` se null. |
| `ranking_usuarios` vazio mesmo com confirmado | Trata como `pre-copa` (graceful degrade). Comentário inline na função. |
| `progresso.porcentagem = 0%` | Card renderiza "0%" com barra zerada. |
| `progresso.total = 0` (sem confirmados) | CardProgresso não renderiza — só aparece em pre-copa/em-andamento que exigem confirmado. |
| Múltiplos pendentes | `pendente.bilhete_id = max(created_at)`; `valor_total_pendente = SUM`; `qtd_pendentes = count`. Banner/hero adaptam plural. |
| Pendente expira durante visualização | Page `force-dynamic`; próximo nav captura `effective_status = 'expirado'`. |
| `tendencia = 0` (mesma posição/pontos) | Renderiza `━` cinza neutro. Distinto de `null`. |
| `tendencia = null` (sem snapshot) | `TrendIndicator` não renderiza. |
| `total_bilhetes = 1` | `CardPontos` omite "· sua melhor tabela"; `CardProgresso` omite "· N tabelas". |
| Erro em qualquer query | Fallback graceful (`bilhetes ?? []`, `ranking ?? null`). Erro fatal cai no error boundary do Next. |
| Copa em andamento mas user só pendente | `kind = 'pendente-puro'`, mesma UI Estado B. ProximosJogosPanel mostra próximos não finalizados. |
| Copa terminou (todos jogos finalizados) | ProximosJogosPanel mostra empty state existente. Cards continuam exibindo pontos finais. |

### 7.1 Origem da tendência

Compara com **snapshot mais recente** do user (qualquer período), `ranking_snapshots ORDER BY snapshot_at DESC LIMIT 1`. Se admin nunca tirou snapshot, `tendencia = null` → indicador não renderiza. Se admin esqueceu uma rodada, comparação fica "stale" (compara com período mais antigo). Trade-off aceito — F8 estabeleceu snapshot como gatilho manual via F9.

---

## 8. Estratégia de testes (light, sem TDD agressivo)

| Arquivo | Cobertura |
|---|---|
| `lib/dashboard/estado.test.ts` | 4 estados base + colisão "confirmado + pendente em pre-copa" + colisão em "em-andamento" + edge "ranking_usuarios vazio com confirmado" + cálculo de pendente com múltiplos (alvo correto, soma correta, qtd correta) |
| `lib/dashboard/countdown.test.ts` | Mesmo dia (zero), 1 hora, 30 dias, datas no passado (retorna 0/0), atravessar meia-noite |

**Sem testes de smoke pros componentes UI.** São condicionais puros sem lógica complexa. QA visual no preview deploy da Vercel cobre regressão.

---

## 9. O que NÃO entra nesta feature

- Live countdown (relógio JS atualizando segundo a segundo) → server-render basta.
- Realtime subscription pra atualizar cards quando ranking muda (a `/ranking` da F8 já faz isso). Dashboard refresh-on-nav é suficiente.
- Card de bônus preenchidos (algo como "Bônus: 4/6") → fora do escopo, brief diz "104 jogos" e nada mais.
- Tendência por período específico ("desde a rodada 2") → comparação simples com snapshot mais recente.
- CTA "Comprar mais tabela" no header em Estado D → user usa sidebar (`/comprar` já existe).

---

## 10. Critérios de pronto

- [ ] `lib/dashboard/estado.ts` cobre os 4 estados + colisões; testes verdes.
- [ ] `lib/dashboard/countdown.ts` cobre os 5 casos + testes verdes.
- [ ] RPC `count_palpites_confirmados` deployada via migration; respeita RLS (user só lê próprios palpites).
- [ ] `/dashboard` Server Component faz fetch em `Promise.all` (5 queries base + 2 condicionais em em-andamento).
- [ ] `DashboardHeader` aceita prop `subtitle: string`; copy varia por estado conforme tabela §5.3.
- [ ] Estado A renderiza `DashboardEmptyHero` full-width (sem ProximosJogos, sem cards).
- [ ] Estado B renderiza `DashboardPendentePix variant='hero'` + ProximosJogos.
- [ ] Estado C renderiza CardCountdown + CardProgresso em grid `grid-cols-1 sm:grid-cols-2`; banner pendente se aplicável.
- [ ] Estado D renderiza CardPontos + CardPosicao + CardProgresso em grid `grid-cols-2 md:grid-cols-3`; banner pendente se aplicável.
- [ ] Tendência: `delta > 0 → ▲ verde`; `< 0 → ▼ vermelho`; `= 0 → ━ cinza`; `null → não renderiza`.
- [ ] CTAs `/palpites` e `/ranking` aparecem condicionalmente (palpites só se progresso < 100%).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:run` passam.
- [ ] Smoke manual no preview deploy: criar user novo (Estado A), comprar 1 tabela em PIX (Estado B), confirmar (Estado C), simular admin marcando 1 jogo finalizado (Estado D).

---

## 11. Riscos e mitigações

### 11.1 RPC nova introduz overhead em cada request do dashboard

**Risco:** `count_palpites_confirmados` faz JOIN entre `palpites` e `bilhetes`. Com 2k bilhetes confirmados e 200k+ palpites, query pode ficar lenta.

**Mitigação:** índice já existe em `palpites.bilhete_id` (PK + FK), `bilhetes.user_id` (índice da F2). Query plan: filter bilhetes por user_id (alta seletividade), então JOIN. Em prod com 2k bilhetes e até 60 palpites por user, < 50ms tranquilo. Monitorar via `EXPLAIN ANALYZE` quando crescer.

### 11.2 Estado D quebra se snapshot for inválido (NULL ou colunas faltando)

**Risco:** se admin re-cria a tabela e tira snapshot incompleto, columns null podem dar `NaN` na tendência.

**Mitigação:** `maybeSingle()` + checagem explícita `if (snapRes.data)` antes de calcular. Se snapshot existe mas pontos_totais/posicao são null, tratamos como `tendencia = null`. Cobertura no teste de estado.

### 11.3 Race entre INSERT em palpites e refresh da view ranking_usuarios

**Risco:** user acabou de palpitar, `ranking_usuarios` ainda não materializou. View é live (não materialized view), então deveria atualizar imediatamente. Verificado.

**Mitigação:** view é `WITH (security_invoker = false)` mas não é MATERIALIZED — query roda live. Sem cache. Risco real é zero.

### 11.4 Múltiplos pendentes apontando pra mp_payment_ids diferentes

**Risco:** user iniciou 2 compras separadas (cada uma com mp_payment_id próprio). CTA aponta pro mais recente, mas o outro fica "esquecido".

**Mitigação:** mostra `qtd_pendentes` no banner ("3 tabelas pendentes"). User vai pra `/comprar/[id]/pix` do mais recente; após pagar/expirar esse, próximo dashboard refresh mostra o próximo pendente. Loop natural. Documentar no copy futura se virar problema (UX dimensionada pra 1-2 pendentes simultâneos no mundo real).

### 11.5 Total participantes inflando rapidamente

**Risco:** Estado D Card 2 mostra "#42 de 1.234 participantes". Query `count: 'exact'` em `ranking_usuarios` pode ficar cara em prod com 2k+ users.

**Mitigação:** `count: 'exact'` em view simples é fast — Postgres conta linhas materializadas. Se virar problema, cachear via `unstable_cache(60s)` ou usar uma RPC com `pg_stat_user_tables.n_live_tup`. Aceitar overhead inicial.

---

## 12. Próximos passos

1. **Self-review** desta spec (placeholders, contradições, ambiguidade, escopo).
2. **Aprovação do user** sobre a spec escrita.
3. **Invocar `writing-plans`** pra gerar plano de implementação (alvo: 700–800 linhas).
4. **Worktree separado** + execução via `executing-plans` com checkpoints.

---

**Vamos sempre à luta.** ⚽🏆
