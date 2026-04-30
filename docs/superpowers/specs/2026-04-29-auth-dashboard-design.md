# Feature 4 — Auth + layout dashboard

**Data:** 2026-04-29
**Status:** Aprovado para implementação
**Autor:** Brainstorm conduzido com Jonatas
**Próximo passo:** writing-plans → executing-plans em worktree separado

---

## 1. Contexto e motivação

Quarta feature da seção 5 do `CLAUDE.md`. Features 1-3 já mergeadas em `main`:

- **F1 (setup):** Next 14 App Router, Tailwind v4 via `@theme` em `globals.css`, fontes (Bebas/Archivo/JetBrains), `.env.local`, ESLint/Prettier, Vitest, supabase clients (`lib/supabase/{server,browser,middleware,admin}.ts`), middleware base com `updateSupabaseSession` (chama `getUser` mas não redireciona).
- **F2 (schema):** 7 tabelas (`profiles`, `selecoes`, `jogos`, `bilhetes`, `palpites`, `palpites_bonus`, `copa_resultados`) + view `ranking` + 5 enums + triggers (`handle_new_user`, `prevent_palpite_after_start`, `set_updated_at`) + RLS em todas as tabelas + seed (48 seleções, 104 jogos).
- **F3 (landing):** `/` renderiza `<HeroSection/>`, `<FeaturesSection/>`, `<PromoSection/>`. `<SiteHeader/>` com link "Entrar" → `/login`. `<SiteFooter/>` com disclaimer regulatório.

Hoje os caminhos `/login`, `/auth/callback`, `/dashboard`, `/admin` existem como **placeholders** explícitos:

- `app/(auth)/login/page.tsx`: card "Placeholder. Magic link entra na Feature 4."
- `app/(auth)/auth/callback/route.ts`: retorna 501 com `{ error: 'auth callback not implemented yet — see Feature 4' }`.
- `app/(auth)/layout.tsx`: container centrado `max-w-md`.
- `app/(dashboard)/layout.tsx`: aside `hidden md:block` com texto "sidebar real na Feature 4".
- `app/(dashboard)/dashboard/page.tsx`: `<h1>Meu painel</h1>` com nota "Conteúdo real entra na Feature 4".
- `app/(admin)/layout.tsx`: header com nota "guard de is_admin entra na Feature 9".
- `app/(admin)/admin/page.tsx`: `<h1>Painel admin</h1>` com nota "KPIs e gráficos entram nas Features 9-11".
- `middleware.ts`: aplica `updateSupabaseSession` a todas as rotas exceto `api`, `_next/*`, imagens.

Esta feature substitui o login/callback placeholder por **fluxo de auth real (magic link puro)**, troca o aside placeholder do `(dashboard)` por uma **shell completa** (sidebar desktop + drawer mobile + header), e popula `/dashboard` com **dados reais** do usuário logado + um único painel "Próximos jogos da Copa" (read-only). Stats, progresso, palpites e cashback ficam pra Features 7+.

---

## 2. Decisões de produto registradas durante o brainstorming

Estas decisões orientam features futuras; ficam aqui pra que o `writing-plans` da F4 e os specs/plans das próximas features encontrem em um único lugar.

### 2.1 Modelo rodada-por-rodada de palpites

Palpites de jogo são feitos **um a um**, com janela individual até o **apito inicial daquele jogo específico**. O trigger `prevent_palpite_after_start` em `palpites` (Feature 2, linhas 248+ da migration) já enforça isso. Não existe "palpitar tudo antes da Copa".

Bônus (campeão, vice, terceiro, quarto, artilheiro, revelação) têm **deadline único** antes do **primeiro jogo da Copa**; depois disso, viram read-only.

**Implicação na F4:** o painel "Próximos jogos da Copa" tem CTA "Palpitar" por linha apontando pra `/palpites/[id]`. Como F7 ainda não criou essa rota, Next.js renderiza `app/not-found.tsx` (404 controlado). Aceitável como placeholder até F7.

**Implicação na F7:** a UX de palpites foca em "próximos 3-5 jogos com palpite aberto"; **não** numa lista massiva de 104 jogos. Bônus moram em telas separadas.

### 2.2 Palpite ausente vale 0 pontos

Quem não palpitar até o apito não pontua naquele jogo. **Não existe palpite default** (nada de "0×0 automático" ou "empate por falta de palpite"). Decisão de simplicidade e justiça.

**Implicação na F5 (`lib/pontuacao.ts`):** input do tipo `palpite | null`; quando null, retorna 0 sem caminho especial.

### 2.3 Visibilidade dos palpites: privado antes, público depois

- **Antes do apito** (`jogo.data_hora > now()`): só dono + admin veem o palpite.
- **Depois do apito** (`jogo.data_hora <= now()`): qualquer authenticated user vê os palpites de todo mundo naquele jogo.
- **Bônus**: privados até o **primeiro jogo da Copa**; depois ficam públicos.

Já enforced via RLS na F2 (policies `palpites_select_own_or_started` e `palpites_bonus_select_own_or_copa_started` — linhas 487 e 528 da migration).

**Implicação na F8/F4:** confiar nas RLS para filtragem cross-user. Não duplicar a lógica de visibilidade no app.

### 2.4 Perfil público de bilhete via ranking

Sem tela tipo `/jogos/[id]/palpites`. O fluxo único é: `/ranking` → clicar no nome de qualquer apostador → abrir `/ranking/[bilheteId]` (perfil público do bilhete).

**O que aparece em `/ranking/[bilheteId]`:**

| Campo | Visível? |
|---|---|
| Nome (da view `ranking`) | ✅ |
| Posição, pontos, acertos | ✅ |
| Palpites de jogos com apito dado (em curso ou finalizados) | ✅ (RLS libera) |
| Palpites de jogos pendentes | 🔒 (placeholder "🔒 palpite escondido até o jogo começar") |
| Bônus pré-Copa | 🔒 (idem) |
| Email, telefone, CPF | ❌ NUNCA — colunas privadas em `profiles`, query da página pública lista colunas explicitamente |

**Implicação na F8:** cada linha do ranking precisa ser ``<Link href={`/ranking/${bilheteId}`}>`` envolvendo o nome (ou a row inteira). A view `ranking` já expõe `bilhete_id`, `nome`, `posicao`, `pontos_totais` (a view roda com `security_invoker = false`, portanto bypassa RLS de `profiles` e libera leitura cross-user). Esta página em si é entregue na F8.

---

## 3. Decisões de design da Feature 4

| #   | Pergunta                              | Escolha                                                                                                                                            | Motivação                                                                                                |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Q1  | Escopo do dashboard                   | **Chrome real + 1 painel "Próximos jogos da Copa"** (sem stats, progresso, cashback)                                                               | Aproveita `jogos` seedados sem depender de F6/F7; entrega valor visível sem hack                          |
| Q2  | Fluxo do magic link                   | **Magic link puro** + form `nome` + `email`; metadata `full_name` lido pelo trigger                                                                | UX mais simples; nome resolvido no signup, sem onboarding modal                                          |
| Q3  | Sidebar items                         | **7 itens completos**, 6 disabled "em breve" (`text-muted` + `cursor-not-allowed` + `aria-disabled`)                                               | Fiel ao protótipo; ativar futuras features = trocar 1 flag                                               |
| Q4  | Mobile nav                            | **Top bar fixa** (logo + hamburger) + **drawer Radix Dialog** reusando `<DashboardNav/>`                                                            | `@radix-ui/react-dialog` já instalado; 1 componente serve desktop e mobile                               |
| Q5  | Sign-out                              | **Único botão** no rodapé do `<DashboardNav/>` (`mt-auto` + divider)                                                                               | `<DashboardNav/>` já é Client por causa do drawer; centraliza a lógica de logout                         |
| Q6  | Redirects e proteção                  | **Tudo no middleware**: anon → `/login?next=...` em `/dashboard*` / `/admin*` / `/palpites*`; logado → `/dashboard` em `/login`                    | Single source of truth; layouts continuam re-checando `getUser` por defesa em profundidade               |
| Q7  | UX pós-submit do login                | **`<LoginForm/>` controla seu próprio estado**: idle → sending → sent (form some, mostra "Link enviado", reenviar com cooldown 60s)                | Sem rota extra; estado vivo no client; mobile-friendly                                                   |
| Q8  | Painel "Próximos jogos"               | **Top 5** por `data_hora ASC`; server query direto; data formatada (`Hoje`/`Amanhã`/`Sex, 14/06`); CTA "Palpitar" por linha → `/palpites/[id]`     | Cobre o caso 100% Copa antes do início (próximos 5 = primeiros 5 jogos) e durante (próximos 5 = mistura) |

---

## 4. Arquitetura

### 4.1 Fluxo de auth (magic link puro)

```
1. /login (Server Component shell + <LoginForm/> Client)
   ↓ user preenche nome + email, submit
2. supabase.auth.signInWithOtp({
     email,
     options: {
       emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next ?? '/dashboard')}`,
       data: { full_name: nome.trim() }   // ← chave 'full_name' lida pelo trigger
     }
   })
   ↓ Supabase envia email; <LoginForm/> vai pra estado "sent"
3. user clica no link no email → ${origin}/auth/callback?code=...&next=/dashboard
   ↓
4. /auth/callback (Route Handler GET):
     - createSupabaseServerClient()
     - supabase.auth.exchangeCodeForSession(code)
     - lê e valida `next` (regex /^\/(?!\/)/) — fallback /dashboard
     - se exchange falha → redireciona /login?error=link-invalido
     - se ok → redireciona pra `next`
   ↓
5. Cookie de sessão setado.
   (No primeiro signup desse email, o INSERT em auth.users dispara o trigger
    handle_new_user, que cria a row em profiles. Em logins subsequentes do
    mesmo email, o Supabase reconhece o user existente e só re-emite o link
    — sem novo INSERT em auth.users — então o trigger não dispara de novo.)
   ↓
6. Próximo request passa pelo middleware com cookie válido → user logado
```

### 4.2 Fluxo de proteção (middleware)

```
Toda request → middleware.ts
  ↓
  updateSupabaseSession(request) → renova cookies + retorna { response, user }
  ↓
  const path = request.nextUrl.pathname
  const isProtected = /^\/(dashboard|admin|palpites|ranking)(\/|$)/.test(path)
  const isLoginPage = path === '/login'
  ↓
  switch:
    isProtected && !user:
      const url = new URL('/login', request.url)
      url.searchParams.set('next', path + request.nextUrl.search)
      return NextResponse.redirect(url)
    isLoginPage && user:
      return NextResponse.redirect(new URL('/dashboard', request.url))
    default:
      return response
```

`/auth/callback` fica fora dos protected (não tem cookie ainda; é a porta de entrada). API routes e estáticos já são excluídos pelo matcher atual.

> Nota sobre `/ranking` e `/palpites`: as rotas reais entram nas Features 7 e 8, mas o middleware **já protege** esses caminhos agora — quando F7/F8 derem 404, anon é redirecionado pra `/login` antes de ver o 404, e logado vê o `not-found.tsx` natural. Custo: zero — só amplia o regex.

### 4.3 Fluxo de render do `/dashboard`

```
(dashboard)/layout.tsx  (Server Component)
  ↓
  - createSupabaseServerClient()
  - const { data: { user } } = await supabase.auth.getUser()
  - if (!user) redirect('/login')                 // defesa em profundidade
  - const { data: profile } = await supabase
      .from('profiles').select('nome, email').eq('id', user.id).single()
  - <DashboardShell nome={profile?.nome || 'Apostador'} email={user.email!}>
      {children}
    </DashboardShell>
  ↓
(dashboard)/dashboard/page.tsx  (Server Component)
  ↓
  - createSupabaseServerClient()
  - const agora = new Date().toISOString()
  - const { data: jogos } = await supabase
      .from('jogos')
      .select(`
        id, numero_jogo, fase, data_hora, placeholder_casa, placeholder_fora,
        casa:selecoes!selecao_casa_id(id, nome, bandeira_emoji),
        fora:selecoes!selecao_fora_id(id, nome, bandeira_emoji)
      `)
      .gt('data_hora', agora)
      .order('data_hora', { ascending: true })
      .limit(5)
  - <DashboardHeader nome={…} email={…} />
  - <ProximosJogosPanel jogos={jogos ?? []} />
```

### 4.4 Fluxo de logout

```
<DashboardNav/>  (Client Component)
  ↓ user clica em "Sair"
  ↓ const supabase = createSupabaseBrowserClient()
  ↓ const { error } = await supabase.auth.signOut()
  ↓ if (error) toast.error('Não consegui deslogar. Tenta de novo.')
  ↓ else { router.push('/login'); router.refresh() }
```

---

## 5. Componentes e organização de arquivos

Convenção: idêntica ao padrão estabelecido em `components/landing/` na Feature 3.

### 5.1 Árvore de arquivos

**Arquivos novos:**

```
app/
  (auth)/
    login/
      page.tsx                          [SUBSTITUIR placeholder por shell + <LoginForm/>]
      page.test.tsx                     [smoke]
    auth/
      callback/
        route.ts                        [SUBSTITUIR 501 por exchange real + redirect]
  (dashboard)/
    layout.tsx                          [SUBSTITUIR placeholder por guard + <DashboardShell/>]
    dashboard/
      page.tsx                          [SUBSTITUIR placeholder por dashboard real]
      page.test.tsx                     [smoke]
  (admin)/
    layout.tsx                          [MODIFICAR — adicionar guard de auth básico]

components/
  auth/
    LoginForm.tsx                       [NOVO — Client]
    LoginForm.test.tsx                  [smoke + estados]
  dashboard/
    DashboardShell.tsx                  [NOVO — Server]
    DashboardTopbarMobile.tsx           [NOVO — Client (estado do drawer)]
    DashboardNav.tsx                    [NOVO — Client]
    DashboardNav.test.tsx               [smoke]
    DashboardHeader.tsx                 [NOVO — Server]
    UserBadge.tsx                       [NOVO — Server]
    ProximosJogosPanel.tsx              [NOVO — Server]
    ProximosJogosPanel.test.tsx         [smoke + empty state + TBD]
    JogoRow.tsx                         [NOVO — Server]

lib/
  format/
    data-relativa.ts                    [NOVO — função pura]
    iniciais.ts                         [NOVO — função pura]
  validators/
    login.ts                            [NOVO — Zod schema]
  __tests__/
    data-relativa.test.ts               [unit]
    iniciais.test.ts                    [unit]
    login-validator.test.ts             [unit]
```

**Arquivos modificados:**

```
middleware.ts                           [adicionar redirect logic via path matching]
lib/supabase/middleware.ts              [estender pra retornar { response, user }]
app/globals.css                         [adicionar @utility .panel, .panel-header, .sidebar-item,
                                         .sidebar-item-active, .sidebar-item-disabled,
                                         .sign-out-btn, .btn-sm — ver §5.3]
```

### 5.2 Especificação por componente

#### `<LoginForm/>` — Client

**Responsabilidade:** form de login com state machine local, validação Zod, chamada `signInWithOtp` e gerenciamento de cooldown do reenvio.

**Props:** `{ defaultNext?: string }` — recebido do query param `?next=` lido no Server Component shell.

**Estado interno:**
```ts
type State =
  | { kind: 'idle'; values: { nome: string; email: string }; errors: Partial<Record<'nome' | 'email', string>> }
  | { kind: 'sending'; values: { nome: string; email: string } }
  | { kind: 'sent'; email: string; cooldownLeft: number }
```

**Comportamento:**
- Submit em `idle`: valida com `loginSchema` (Zod). Se inválido, escreve em `errors` e fica em `idle`. Se válido, transiciona pra `sending`.
- Em `sending`: chama `supabase.auth.signInWithOtp(...)`. Se erro, volta pra `idle` mantendo valores; mostra `toast.error(mensagem)` via sonner. Se ok, transiciona pra `sent` com `cooldownLeft = 60`.
- Em `sent`: timer `setInterval(1000)` decrementa `cooldownLeft` até 0. Botão "Reenviar" habilita em 0. Reenviar volta pra `sending` (mesmo email, sem novo nome).
- Banner de erro vinda do callback: lê `?error=link-invalido` no Server Component shell, passa como prop adicional, exibe acima do form.

**Acessibilidade:**
- Inputs com `<label>` associados (`htmlFor` / `id`).
- Erros inline com `aria-describedby` apontando pro span de erro.
- Botão de submit com `aria-busy={state.kind === 'sending'}`.
- Estado `sent` foca o card de "Link enviado" via `useEffect` com `ref`.

#### `<DashboardShell/>` — Server

**Responsabilidade:** orquestra topbar mobile + sidebar/drawer + header + main area.

**Props:** `{ nome: string; email: string; children: React.ReactNode }`.

**Markup:**
```tsx
<div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
  <DashboardTopbarMobile nome={nome} email={email} />
  <DashboardNav nome={nome} email={email} className="hidden md:flex" />
  <div className="flex flex-col">
    <main className="flex-1 px-5 pt-20 pb-10 md:p-8 md:pt-8">
      <DashboardHeader nome={nome} email={email} />
      {children}
    </main>
  </div>
</div>
```

`pt-20` no mobile compensa a topbar fixa (h-14 + safe area). `md:pt-8` reseta no desktop.

#### `<DashboardTopbarMobile/>` — Client

**Responsabilidade:** topbar fixa mobile (logo + hamburger) que controla o drawer; oculta no desktop.

**Props:** `{ nome: string; email: string }`.

**Por que Client:** controla o estado `open` do `Dialog` Radix e passa pra `<DashboardNav/>` (a sidebar e o conteúdo do drawer compartilham o mesmo componente; quem decide se está em drawer mode é uma prop).

**Markup (resumido):**
```tsx
<Dialog.Root open={open} onOpenChange={setOpen}>
  <header className="fixed top-0 inset-x-0 z-40 h-14 md:hidden bg-bg-dark/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4">
    <DashboardLogo />
    <Dialog.Trigger asChild>
      <button aria-label="Abrir menu" className="p-2 rounded-lg hover:bg-bg-elevated">
        <Menu className="size-5" />
      </button>
    </Dialog.Trigger>
  </header>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50 md:hidden" />
    <Dialog.Content className="fixed top-0 left-0 bottom-0 z-50 w-72 md:hidden">
      <Dialog.Title className="sr-only">Menu</Dialog.Title>
      <DashboardNav nome={nome} email={email} drawerMode onItemClick={() => setOpen(false)} />
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

#### `<DashboardNav/>` — Client

**Responsabilidade:** lista de nav items (sidebar fixa no desktop, conteúdo do drawer no mobile) + botão "Sair".

**Props:**
```ts
type Props = {
  nome: string;
  email: string;
  drawerMode?: boolean;        // se true, o componente está dentro do drawer
  onItemClick?: () => void;    // callback opcional pra fechar o drawer ao clicar
  className?: string;
};
```

**Por que Client:** chama `supabase.auth.signOut()` no clique de "Sair" + `router.push/refresh`.

**Estrutura:**
```tsx
<nav className={cn("flex flex-col h-full bg-bg-card border-r border-border p-6", className)}>
  <DashboardLogo className="mb-8" />

  <Section label="Principal">
    <NavItem icon={<Home/>} label="Dashboard" href="/dashboard" active />
    <NavItem icon={<Trophy/>} label="Meus Palpites" disabled hint="Em breve (F7)" />
    <NavItem icon={<Award/>} label="Ranking" disabled hint="Em breve (F8)" />
    <NavItem icon={<Target/>} label="Bônus" disabled hint="Em breve (F7)" />
  </Section>

  <Section label="Conta">
    <NavItem icon={<Ticket/>} label="Minhas Tabelas" disabled hint="Em breve (F6)" />
    <NavItem icon={<DollarSign/>} label="Cashback" disabled hint="Em breve (F11)" />
    <NavItem icon={<Settings/>} label="Configurações" disabled hint="Em breve" />
  </Section>

  <button onClick={handleSignOut} className="mt-auto sign-out-btn">
    <LogOut className="size-4" /> Sair
  </button>
</nav>
```

`<NavItem/>` (componente interno):
- `disabled`: renderiza `<span aria-disabled="true" title={hint} className="...cursor-not-allowed text-text-muted/60">` — sem `<Link>`, não navega.
- `active`: `bg-accent/10 text-accent`. Caminho atual marcado via `usePathname()` (`active={pathname === href}`); na F4 só `/dashboard` casa.

#### `<DashboardHeader/>` — Server

**Responsabilidade:** greeting + subtitle + `<UserBadge/>`.

**Props:** `{ nome: string; email: string }`.

**Markup:**
```tsx
<header className="flex flex-wrap items-start justify-between gap-4 mb-8">
  <div>
    <h1 className="font-display text-[38px] tracking-wide leading-none">
      Salve, <span className="text-accent">{primeiroNome(nome)}</span> 👋
    </h1>
    <p className="font-body text-text-secondary text-sm mt-2">
      Sua primeira tabela ainda não está no jogo. Disponível em breve.
    </p>
  </div>
  <UserBadge nome={nome} email={email} />
</header>
```

`primeiroNome(nome)`: helper inline (split por espaço, primeiro elemento; fallback "Apostador" se vazio).

#### `<UserBadge/>` — Server

**Markup:**
```tsx
<div className="flex items-center gap-2.5 bg-bg-card border border-border px-3.5 py-2 rounded-full">
  <div className="avatar w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-bg-dark font-extrabold text-[13px]">
    {iniciais(nome)}
  </div>
  <div className="text-[13px] leading-tight">
    <div className="font-semibold">{nome || 'Apostador'}</div>
    <div className="font-mono text-[11px] text-text-muted">@{handle(email)} · 0 tabelas</div>
  </div>
</div>
```

`handle(email)`: `email.split('@')[0].toLowerCase()`. "0 tabelas" hardcoded — vira contagem real na F6.

#### `<ProximosJogosPanel/>` — Server

**Props:** `{ jogos: JogoComSelecoes[] }` (tipo derivado do select da page; documentado inline como type literal).

**Markup:**
```tsx
<section className="panel">
  <header className="panel-header">
    <div className="flex items-center gap-2.5 text-base font-bold">
      <span className="size-2 rounded-full bg-success animate-pulse-dot" />
      Próximos jogos · Copa 2026
    </div>
  </header>
  {jogos.length === 0 ? (
    <div className="px-6 py-12 text-center text-text-muted">
      <p className="font-display text-2xl">A Copa acabou. Bola pra frente. ⚽</p>
    </div>
  ) : (
    <ul>
      {jogos.map(j => <JogoRow key={j.id} jogo={j} />)}
    </ul>
  )}
</section>
```

#### `<JogoRow/>` — Server

**Comportamento:**
- 5 colunas no desktop: data | casa | × | fora | ação.
- Stack centralizado no mobile.
- Casa: bandeira + nome se `selecao_casa_id` setado; `placeholder_casa` em texto puro caso contrário.
- Fora: idem.
- CTA "Palpitar":
  - Se `selecao_casa_id && selecao_fora_id` → ``<Link href={`/palpites/${jogo.id}`} className="btn-sm">Palpitar</Link>`` (link real; 404 até F7).
  - Caso contrário → ``<span aria-disabled="true" title="Aguarde os times serem definidos" className="btn-sm opacity-50 cursor-not-allowed pointer-events-none">Palpitar</span>``.
- Sublabel discreto à direita do nome do time fora ou abaixo: `<span className="text-text-muted text-xs font-mono">{labelFase(jogo.fase)}</span>` (ex: "Fase de Grupos", "Oitavas", etc.).

**Helper `labelFase`** (inline em `JogoRow.tsx` ou em `lib/format/fase.ts` se ≥3 usos no projeto):
```ts
function labelFase(fase: Database['public']['Enums']['fase_jogo']): string {
  return {
    grupos: 'Grupos',
    '16avos': '16-avos',
    oitavas: 'Oitavas',
    quartas: 'Quartas',
    semis: 'Semis',
    disputa_terceiro: 'Disputa de 3º',
    final: 'Final',
  }[fase];
}
```

#### `lib/format/data-relativa.ts`

```ts
type Args = { data: Date; agora: Date; locale?: string };

export function formatDataRelativa({ data, agora, locale = 'pt-BR' }: Args): {
  date: string;   // "Hoje" | "Amanhã" | "Sex, 14/06"
  hour: string;   // "16:00" — sempre em America/Sao_Paulo (TZ explícita; ver nota abaixo)
}
```

Implementação resumida:
- normaliza `data` e `agora` em "início do dia" (00:00:00 local).
- diff em dias: 0 → "Hoje"; 1 → "Amanhã"; senão → `format(data, 'EEE, dd/MM', { locale: ptBR })` usando `Intl.DateTimeFormat` (sem date-fns — evitar dep extra).
- hora: `Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(data)`.

**Nota sobre TZ:** Vercel functions rodam em UTC por default. Pra exibir "16:00" no horário de Brasília consistentemente, ou (a) setar `TZ=America/Sao_Paulo` na env de runtime do dashboard, ou (b) explicitar `timeZone: 'America/Sao_Paulo'` em todas as chamadas `Intl.DateTimeFormat`. **Escolha (b)** — explícito e isolado nesta função, sem efeito colateral global.

#### `lib/format/iniciais.ts`

```ts
export function iniciais(nome: string | null | undefined): string {
  if (!nome) return '?';
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return '?';
  if (palavras.length === 1) return palavras[0]!.slice(0, 1).toUpperCase();
  return (palavras[0]![0]! + palavras[palavras.length - 1]![0]!).toUpperCase();
}
```

#### `lib/validators/login.ts`

```ts
import { z } from 'zod';

export const loginSchema = z.object({
  nome: z.string()
    .trim()
    .min(2, 'Nome precisa ter pelo menos 2 caracteres.')
    .max(80, 'Nome muito longo.'),
  email: z.string()
    .trim()
    .email('Email inválido.')
    .toLowerCase(),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

### 5.3 Modificações nos arquivos existentes

#### `lib/supabase/middleware.ts` (modificado)

Estender pra retornar o `user` junto com a `response`, sem mudar a semântica de erro:

```ts
export async function updateSupabaseSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(/* ... */);

  let user: User | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // transient — segue com user=null; middleware decide o que fazer
  }

  return { response, user };
}
```

#### `middleware.ts` (modificado)

```ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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

#### `app/(admin)/layout.tsx` (modificado)

Layout placeholder atual mantém o header com aviso "guard de is_admin entra na Feature 9". Esta feature **adiciona um guard de auth básico**:

```tsx
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Guard de auth (F4). Guard de is_admin entra na F9.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
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

(O middleware já protege, mas re-checagem no layout é defesa em profundidade.)

#### `app/globals.css` (modificado)

Adicionar `@utility` apenas pra padrões que aparecem ≥3× nesta feature (mesmo critério da F3):

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
  @apply text-text-secondary hover:bg-bg-elevated hover:text-danger mt-auto flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors border-t border-border pt-4;
}

@utility btn-sm {
  @apply text-text-primary border-border-strong hover:border-accent hover:text-accent inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold transition;
}
```

`.dashboard-logo` aparece em 2 lugares apenas (sidebar desktop + topbar mobile) — fica como utility puro inline.

---

## 6. Visual / mapeamento Tailwind v4

Strategy idêntica à F3: `@theme` em `globals.css` já define todos os tokens (cores, fontes); novos `@utility` somente pra padrões repetidos ≥3×; resto é Tailwind utility puro. Tokens novos adicionados em F2/F3 (acima) já cobrem o necessário.

Breakpoint mobile/desktop: `md:` do Tailwind (768px). Diverge dos 900px do protótipo HTML, mas alinha com o que `(dashboard)/layout.tsx` placeholder atual já usa (`md:block` no aside) e com o pattern da F3. Decisão consciente.

Iconografia: **Lucide React** (`lucide-react` já no package.json). Substitui os emojis 🏠⚽🏆🎯🎫💰⚙️ do protótipo no nav. Coerente com a estética dark/yellow (ícones com `stroke-current`, herdam cor do contexto). **Exceção:** bandeiras de seleções continuam emoji (`bandeira_emoji` da tabela `selecoes`); só os ícones de nav viram Lucide.

---

## 7. Erros e edge cases

### 7.1 Auth

| Cenário | Comportamento |
|---|---|
| `signInWithOtp` retorna erro de rede | `<LoginForm/>` volta pra `idle`, `toast.error('Não consegui enviar o link. Tenta de novo.')` |
| Email rejeitado pelo Supabase (formato/rate limit) | Mesmo path; mensagem mapeada se possível ('Aguarda 60s pra pedir outro link.') |
| Submit com `nome.length < 2` ou email inválido | Validação Zod no client antes da chamada; erro inline abaixo do input via `errors[field]` |
| `/auth/callback` recebe `?code=` mas exchange falha | Redireciona pra `/login?error=link-invalido`. Login shell lê o param e mostra banner vermelho fixo no topo do card |
| `/auth/callback` recebe sem `code` ou com `?error=...` | Mesmo path acima |
| `next` query malicioso (ex: `next=https://evil.com` ou `next=//evil.com`) | Validação `^/(?!\/)`. Falhou → ignora, usa `/dashboard` |
| User clica "Reenviar link" antes do cooldown | Botão `disabled` + counter visível ("Reenviar (32s)") |
| Supabase Auth indisponível durante middleware | `updateSupabaseSession` retorna `user: null` (sem 500). Rota protegida → redirect pra `/login` (fail-closed). Rota pública → segue. |

### 7.2 Dashboard

| Cenário | Comportamento |
|---|---|
| `profiles.nome` vazio (trigger fallback `''`) | `<DashboardHeader/>` usa "Apostador" via `primeiroNome(nome)` que trata vazio. `<UserBadge/>` mostra "Apostador". Logger emite `console.warn` server-side. |
| Query de `profiles` retorna erro (não should happen com RLS atual + user logado) | Layout deixa propagar pro `app/error.tsx` (já existe; mostra "Tentar novamente"). |
| Query de `próximos jogos` falha | `<ProximosJogosPanel/>` recebe `[]`; renderiza fallback "Não foi possível carregar os próximos jogos. Tenta atualizar a página." (variante do empty state). Page component captura erro e passa flag `errored: true` pro panel. |
| `próximos jogos` retorna 0 (Copa acabou ou cenário pós-Copa) | Empty state "A Copa acabou. Bola pra frente. ⚽" |
| Jogo com `selecao_casa_id: null` (mata-mata TBD) | `<JogoRow/>` renderiza `placeholder_casa` em texto. CTA "Palpitar" disabled com `aria-disabled` + title. |
| User logado mas sessão revogada/expirada | `getUser()` retorna null no middleware → redirect pra `/login?next=/dashboard`. Layout serve como segunda barreira. |

### 7.3 Logout

| Cenário | Comportamento |
|---|---|
| `signOut()` retorna erro | `toast.error('Não consegui deslogar. Tenta de novo.')`. Não navega. |
| `signOut()` ok | `router.push('/login')` + `router.refresh()` (limpa cache RSC). |

### 7.4 Mobile drawer

| Cenário | Comportamento |
|---|---|
| Drawer aberto + clique em item disabled | Drawer permanece aberto; clique não consome (item é `<span>` sem href). |
| Drawer aberto + clique em "Sair" | Fecha drawer (via `onItemClick` callback do `<DashboardNav/>`) + executa `signOut()`. |
| Drawer aberto + clique fora ou Esc | Radix Dialog fecha (default behavior). |
| User abre drawer no mobile e a viewport vira desktop (rotação tablet) | Radix Dialog continua aberto até user fechar; sidebar fixa também aparece. Caso raro, não prioritário. |

---

## 8. Estratégia de testes

### 8.1 Unit (puros, alta cobertura — meta ≥95%)

- `lib/__tests__/data-relativa.test.ts` — Hoje/Amanhã/dia da semana com data fixa injetada via `agora` param; TZ Brasília explícita; bordas de meia-noite.
- `lib/__tests__/iniciais.test.ts` — 1 palavra → 1 letra; 2+ palavras → primeira+última; espaços, vazio, null → `'?'`.
- `lib/__tests__/login-validator.test.ts` — válido; nome curto; email mal-formado; trim.

### 8.2 Smoke (Vitest + RTL — 1 por surface relevante)

- `app/(auth)/login/page.test.tsx` — h1 "Entrar"; 2 inputs; botão "Receber link".
- `components/auth/LoginForm.test.tsx` —
  - estado idle: form visível, botão enabled
  - submit válido: estado sending (botão disabled, label "Enviando...")
  - mock `vi.mock('@/lib/supabase/browser')` retornando `signInWithOtp` resolved → estado sent (mensagem "Link enviado pra **{email}**", botão "Reenviar (60s)" disabled)
  - mock rejected → toast spy capturou erro; volta a idle
  - cooldown: `vi.useFakeTimers()`; após 60s, "Reenviar" vira clicável
- `components/dashboard/DashboardNav.test.tsx` — 7 itens; só "Dashboard" sem `aria-disabled`; "Sair" no rodapé; mobile (mock `matchMedia`) abre drawer ao clicar hamburger.
- `components/dashboard/ProximosJogosPanel.test.tsx` — 5 jogos mock → 5 rows; `[]` → empty state; jogo TBD → CTA com `aria-disabled`.
- `app/(dashboard)/dashboard/page.test.tsx` — mock `createSupabaseServerClient` retornando user válido + 3 jogos → renderiza greeting + panel.

### 8.3 Não cobrir nesta feature

- Middleware redirect (testar middleware Next isolado é flaky; deixar pra E2E quando Playwright entrar).
- `/auth/callback` route handler (integração real precisa Supabase Auth loop).
- RLS de `profiles`/`jogos`/`palpites` (validado na F2; não duplicar).
- Visual regression.

### 8.4 Convenções

- Testes em `__tests__/` (lib) e ao lado do componente (UI).
- `vitest.config.mts` já configurado (`jsdom` + `@testing-library/jest-dom` via setup).
- Mocks centralizados se reusados (`__mocks__/supabase.ts` factory).

---

## 9. O que NÃO entra nesta feature

- Stats cards (Posição/Pontos/Acertos/Cashback) → F7 pós-bilhete.
- Painel de progresso de palpites → F7.
- Tela `/palpites/[id]` real → F7. Link aponta pra rota inexistente; Next renderiza `not-found.tsx`.
- Tela `/ranking` e `/ranking/[bilheteId]` → F8.
- Configurações / edição de profile / mudar email/nome.
- OTP code de 6 dígitos como fallback do magic link.
- Guard de `is_admin` no `(admin)` → F9 (TODO documentado no layout).
- Páginas placeholder para os 6 itens disabled da sidebar.
- Notificações WhatsApp / email transacional → F13.
- E2E com Playwright (introdução posterior).

---

## 10. Critérios de pronto

- [ ] `signInWithOtp` envia email com `emailRedirectTo` correto e metadata `full_name` populada.
- [ ] Trigger `handle_new_user` cria row em `profiles` com `nome` igual ao input do formulário.
- [ ] `/auth/callback` faz exchange e redireciona pra `next` (validado) ou `/dashboard`.
- [ ] Middleware redireciona anon → `/login?next=...` em rotas protegidas; redireciona logado → `/dashboard` em `/login`.
- [ ] `/login` mostra banner de erro quando `?error=link-invalido` presente.
- [ ] `<LoginForm/>` cobre os 3 estados (idle/sending/sent) com cooldown de 60s funcional.
- [ ] `/dashboard` mostra greeting "Salve, **{primeiro nome}** 👋" + subtitle + `<UserBadge/>` + painel "Próximos jogos".
- [ ] Painel mostra top 5 jogos por `data_hora ASC` ou empty state.
- [ ] Sidebar desktop fixa em ≥md; topbar + drawer em <md, com Radix Dialog acessível.
- [ ] 6 itens de sidebar disabled (sem href, com `aria-disabled` e `title`).
- [ ] Botão "Sair" no rodapé executa `signOut` + redirect.
- [ ] Layout `(admin)` redireciona anon pra `/login?next=/admin`.
- [ ] Todos os testes (unit + smoke) passam (`pnpm test:run`).
- [ ] `pnpm typecheck` passa sem `any` ou `as unknown`.
- [ ] `pnpm lint` passa sem warnings.
- [ ] Smoke manual: criar conta nova com email real (Supabase Cloud dev), receber email, clicar link, ver dashboard, deslogar, voltar.

---

## 11. Riscos e mitigações

### 11.1 Magic link abre em browser diferente

**Risco:** user pede link no Safari iOS, clica no email no Gmail (que abre Chrome), sessão é setada num browser e não no outro.

**Mitigação:** o magic link puro já lida com isso porque a sessão é setada via cookie no domínio do app, independente de qual browser abre. O único caso real de quebra é WebView de email apps em Android antigos. **Se virar problema na prática, adicionamos OTP code de 6 dígitos como fallback (decisão consciente de adiar)**.

### 11.2 Trigger `handle_new_user` lê `'full_name'`, não `'nome'`

**Risco:** se o form passar `data: { nome }`, o trigger faz `COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')` e só pega `''`.

**Mitigação:** o `signInWithOtp` chamada **passa explicitamente `full_name`** (documentado em §4.1 e §5.2). Teste de smoke real (em `(auth)/login/page.test.tsx`) verifica o payload da chamada via `vi.spyOn`. Trigger não muda nesta feature.

### 11.3 TZ servidor vs Brasília

**Risco:** Vercel Functions rodam em UTC; `Intl.DateTimeFormat` sem `timeZone` explícito retorna hora UTC.

**Mitigação:** `lib/format/data-relativa.ts` passa `timeZone: 'America/Sao_Paulo'` em todas as chamadas `Intl.DateTimeFormat`. Localizado nesse helper, sem efeito colateral global. Test cobre data em fuso brasileiro.

### 11.4 RLS bloqueando query de `profiles` no layout

**Risco:** policy de leitura em `profiles` que não permita self-read derrubaria a query do layout.

**Mitigação:** a policy atual `profiles_select` (linhas 409-411 da migration F2) é `FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin())` — ou seja, **só leitura do próprio profile** (mais admin). Isso é compatível com a F4: o layout sempre filtra `.eq('id', user.id)`, então passa naturalmente. Layout só seleciona `nome, email` (defesa contra leak — CPF/telefone fora). Cross-user reads (F8 / perfil público via ranking) usam a view `ranking`, que tem `security_invoker = false` (bypassa RLS) e é granted a `authenticated` — ou seja, ela é o caminho oficial pra ler `nome` de outros bilhetes.

### 11.5 Loop de redirect entre middleware e layout

**Risco:** middleware redireciona anon pra `/login`; user faz login; volta pra `/dashboard`; layout re-checa e redireciona pra `/login` por race.

**Mitigação:** middleware roda **antes** de qualquer Server Component; cookie é setado pelo callback; o request seguinte já chega no middleware com cookie válido. Cenário só acontece se cookie corrompido — neste caso, redirect pra `/login` é o comportamento certo. Não há loop infinito porque `/login` não é protected.

---

## 12. Próximos passos

1. **Self-review do spec** (placeholders, contradições, ambiguidade, escopo).
2. **Aprovação do user** sobre o spec escrito.
3. **Invocar `writing-plans`** pra gerar o plano de implementação detalhado.
4. **Worktree separado** + execução via `executing-plans` com checkpoints.

---

**Vamos sempre à luta.** ⚽🏆
