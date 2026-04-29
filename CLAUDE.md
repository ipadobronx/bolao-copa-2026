# Project Charter — Bolão Copa 2026

> **Para o agente:** Este é o documento de contexto do projeto. Ele NÃO contém specs de implementação nem planos de sprint — esses serão gerados feature-a-feature via skill `brainstorming` do Superpowers, salvos em `docs/superpowers/specs/` e `docs/superpowers/plans/`.
>
> **Hierarquia de instruções (do mais alto pro mais baixo):**
>
> 1. Instruções diretas do usuário nesta sessão
> 2. Este `CLAUDE.md`
> 3. Skills do Superpowers
>
> **Quando o usuário pedir "vamos fazer a feature X":** invoque a skill `brainstorming`. Não pule pra implementação. Não invoque `frontend-design` ou outras skills de implementação antes do design ser aprovado pelo usuário.

---

## 1. Visão do produto

Sistema web de bolão da Copa do Mundo 2026 (FIFA, 11/06/2026 a 19/07/2026, sediada em EUA, México e Canadá; 48 seleções, 104 jogos).

**Modelo de negócio:**

- R$ 20,00 por tabela (1 tabela = 1 conjunto de palpites)
- Prêmio total R$ 10.000, dividido entre os 10 primeiros do ranking
- Promoção cashback: comprou ≥ R$ 100 → escolhe 1 seleção; se ela for campeã, recebe 100% do valor pago de volta
- **Regra crítica de proteção:** limite de 20 apostadores por seleção no cashback (sem isso, o produto pode quebrar financeiramente)

**Volume esperado:** 500 a 2.000 tabelas (R$ 10k a R$ 40k arrecadado).

**Público-alvo:** apostadores casuais brasileiros, mobile-first, pagamento via PIX.

**Dono do produto:** Jonatas (dev) e José Anaíde (sócio).

---

## 2. Decisões já tomadas (não são pra brainstormar de novo)

Estas decisões estão consolidadas. Se o usuário pedir uma feature, assuma estas premissas e **não** abra brainstorming sobre elas a menos que o usuário levante explicitamente:

### Stack

- **Frontend:** Next.js 14 (App Router, TypeScript estrito, Server Components por padrão), Tailwind CSS, Lucide Icons.
- **Backend:** Supabase (Postgres + Auth + Realtime + Edge Functions + Storage). RLS habilitado em TODAS as tabelas. Auth via OTP por email (magic link).
- **Pagamentos:** Asaas (PIX). Sandbox em dev, produção depois.
- **Resultados ao vivo:** API-Football (api-football.com).
- **Deploy:** Vercel (frontend) + Supabase Cloud (banco/functions).
- **WhatsApp:** Evolution API self-hosted (escopo opcional, fase 2).

### Design system (mantém o do protótipo)

- Tema dark com accent amarelo (`#facc15`).
- Tipografia: Bebas Neue (display), Archivo (body), JetBrains Mono (números/datas).
- CSS variables e config Tailwind no `app/globals.css` e `tailwind.config.ts`.
- **Referência visual obrigatória:** `docs/prototype/bolao-copa-2026.html` — todo componente visual deve ser fiel a essa fonte.

### Arquitetura de rotas (Next.js App Router)

```
app/
  (public)/        → landing, regras, FAQ
  (auth)/          → login, callback
  (dashboard)/     → área logada do apostador
  (admin)/         → painel admin
  api/             → webhooks, cron
```

### Decisões editoriais

- **Mobile-first sempre.** ~85% dos apostadores vão usar celular.
- **Auto-save em palpites** (sem botão "salvar" — debounce 1s).
- **Toasts pra feedback** (lib `sonner`).
- **Validação dupla:** Zod no client e no server.

---

## 3. Regras de negócio críticas

Estas regras devem virar testes automatizados sempre que tocadas. Qualquer feature que mexa com elas precisa de cobertura de TDD obrigatória.

### 3.1 Pontuação dos palpites

**Fase de grupos (multiplicador 1×):**

- Placar exato → 10 pts
- Vencedor + saldo de gols correto → 7 pts
- Apenas vencedor (ou empate) → 5 pts
- Acertou número de gols de UM dos times (sem acertar resultado) → +2 bônus

**Multiplicadores por fase de mata-mata:**

- 16avos → ×1.5
- Oitavas → ×2
- Quartas → ×2.5
- Semis → ×3
- Disputa de 3º → ×2
- Final → ×4

**Pontuação final aplicada:** `Math.round(pontosBase × multiplicador)`.

**Bônus (preenchidos antes da Copa):**

- Campeão: 50 pts
- Vice: 30 pts
- 3º lugar: 15 pts
- 4º lugar: 15 pts
- Artilheiro: 25 pts
- Revelação (admin define): 15 pts

### 3.2 Distribuição de prêmios

Total: R$ 10.000.

- 1º → R$ 5.000
- 2º → R$ 2.500
- 3º → R$ 1.500
- 4º a 10º → R$ 1.000 dividido igualmente (~R$ 142,86 cada)

### 3.3 Cashback (proteção do caixa)

- Apenas para compras com `valor_pago >= 100.00`.
- Limite **rígido** de 20 apostadores por seleção. Atingiu o limite → seleção sai da lista.
- Cashback é pago apenas se a seleção escolhida for campeã (id == `copa_resultados.campeao_id`).
- Valor do cashback = `valor_pago` do bilhete (100%).

### 3.4 Janela de palpites

- Palpite só pode ser inserido/editado se `jogo.data_hora > now()`.
- Trigger no banco bloqueia escrita após o início do jogo (defesa em profundidade junto com validação no app).
- Bilhete precisa estar com `status_pagamento = 'confirmado'` pra aceitar palpites.

---

## 4. Modelo de dados (referência)

Schema mestre do Supabase. Quando criar a feature de migrations, use isto como referência. **Toda tabela DEVE ter RLS habilitado.**

```sql
-- Profiles (extends auth.users)
profiles (id uuid PK ref auth.users, nome, email, telefone, cpf, is_admin bool)

-- Seleções da Copa (48 registros)
selecoes (id, nome, codigo_iso, bandeira_emoji, grupo char(1))

-- Jogos (104 registros: 72 grupos + 32 mata-mata)
jogos (id, numero_jogo, fase enum, data_hora, selecao_casa_id, selecao_fora_id,
       placeholder_casa, placeholder_fora, gols_casa, gols_fora, finalizado, external_id)

-- Bilhetes (cada R$20 = 1 bilhete)
bilhetes (id uuid PK, user_id, numero_bilhete serial, status_pagamento enum,
          valor_pago, asaas_payment_id, selecao_cashback_id, cashback_pago,
          pago_em, expira_em)

-- Palpites
palpites (id uuid PK, bilhete_id, jogo_id, gols_casa, gols_fora,
          pontos_calculados, UNIQUE(bilhete_id, jogo_id))

-- Bônus (campeão, vice, artilheiro, etc)
palpites_bonus (id uuid PK, bilhete_id, tipo enum, selecao_id, jogador_nome,
                pontos_calculados, UNIQUE(bilhete_id, tipo))

-- Resultados oficiais (1 registro, atualizado pelo admin)
copa_resultados (id=1, campeao_id, vice_id, terceiro_id, quarto_id,
                 artilheiro_nome, revelacao_id, finalizada bool)

-- View: ranking calculado dinamicamente
ranking (bilhete_id, numero_bilhete, user_id, nome, pontos_totais,
         acertos_exatos, acertos_parciais, posicao)
```

**Triggers obrigatórios:**

- `handle_new_user`: cria profile auto ao criar user no auth
- `prevent_palpite_after_start`: bloqueia palpite se `jogo.data_hora <= now()`

**Enums:**

- `fase_jogo`: 'grupos', '16avos', 'oitavas', 'quartas', 'semis', 'disputa_terceiro', 'final'
- `status_pagamento`: 'pendente', 'confirmado', 'expirado', 'cancelado'
- `tipo_bonus`: 'campeao', 'vice', 'terceiro', 'quarto', 'artilheiro', 'revelacao'

---

## 5. Features previstas (ordem sugerida)

Esta é a ordem recomendada de construção. Cada item vira uma sessão separada de brainstorming → plan → execute. **Não mistura features.**

1. **Setup do projeto** — Next.js, Tailwind, fontes, estrutura de pastas, Supabase clients, middleware de auth
2. **Schema do banco** — migrations completas, RLS, seed de seleções e jogos, geração de types TS
3. **Landing page** — recriar do protótipo com componentes reutilizáveis
4. **Auth + layout dashboard** — magic link, sidebar, header, página `dashboard/` com dados reais
5. **Lógica de pontuação (lib pura)** — `lib/pontuacao.ts` com bateria completa de testes (TDD obrigatório). Esta é a feature mais crítica do sistema; entrega isolada antes de qualquer UI de palpite.
6. **Checkout + integração Asaas** — criar bilhete, gerar PIX, webhook, polling de status, seletor de cashback
7. **Tela de palpites** — tabs por fase, inputs com auto-save, validação de janela, bônus
8. **Ranking realtime** — view do banco + Supabase Realtime + tabela com pódio
9. **Painel admin (overview)** — KPIs, últimos pagamentos, gráfico de vendas
10. **Painel admin (entrada de resultados)** — admin insere placar → Edge Function recalcula pontos
11. **Painel admin (cashbacks)** — vagas por seleção, exposição financeira
12. **Cron API-Football** — atualização automática de resultados durante a Copa
13. **WhatsApp (opcional)** — notificações de pagamento, jogos, lembretes
14. **Deploy + polimento** — domínio, produção Asaas, termos de uso, política de privacidade

> Observação sobre #5 (pontuação): por ser regra crítica e independente de UI, este item deve ser feito como módulo puro com cobertura de testes ≥ 95% antes de qualquer feature que dependa dele.

---

## 6. Pontos de atenção

### Segurança

- **NUNCA** expor `SUPABASE_SERVICE_ROLE_KEY` no cliente. Apenas em Server Components, Route Handlers e Edge Functions.
- Validar TODO input com Zod antes de tocar o banco.
- Webhook Asaas: validar token de assinatura.
- Rate limiting nas API routes que lidam com pagamento.

### Performance

- View `ranking` pode ficar cara com >1k bilhetes. Se latência > 500ms em prod, transformar em materialized view com refresh a cada 5 min (durante jogos, 1 min).
- Cache agressivo de seleções e jogos (mudam raramente).

### Risco regulatório

- Bolão pago no Brasil está em zona cinzenta após a Lei 14.790/2023. Antes do lançamento público, **consultar advogado especializado em direito desportivo/gaming**.
- Termos de uso devem caracterizar como "competição entre conhecidos" e não casa de apostas.

### Risco financeiro do cashback

- Sem o limite de 20 vagas por seleção, o cashback pode consumir mais do que foi arrecadado. Isso é **bloqueador**: a feature de checkout não pode ir pra produção sem essa proteção testada.

---

## 7. Variáveis de ambiente

Manter em `.env.local` (e replicar em `.env.local.example` sem valores):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
API_FOOTBALL_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 8. Ferramentas de teste e qualidade

- **Vitest** para testes unitários (lib/pontuacao, validators Zod, helpers).
- **Playwright** para testes E2E críticos (fluxo de compra, fluxo de palpite).
- **TypeScript estrito** — `"strict": true` no tsconfig. Zero `any`.
- **ESLint + Prettier** com config padrão do Next.js.
- Toda feature da seção 5 entrega com testes, conforme TDD.

---

## 9. Convenções de commit e branch

- Branch principal: `main`.
- Cada feature em worktree separado (Superpowers cria automaticamente).
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`.
- PR pra `main` só com testes passando e code review da skill aprovado.

---

## 10. Estrutura de documentação do projeto

```
docs/
├── prototype/
│   └── bolao-copa-2026.html       # protótipo visual de referência
├── superpowers/
│   ├── specs/                     # design docs gerados por brainstorming
│   │   └── YYYY-MM-DD-<feature>-design.md
│   └── plans/                     # planos de implementação
│       └── YYYY-MM-DD-<feature>.md
└── decisions/                     # ADRs (architecture decision records) opcional
```

---

Vamos sempre à luta. ⚽🏆
