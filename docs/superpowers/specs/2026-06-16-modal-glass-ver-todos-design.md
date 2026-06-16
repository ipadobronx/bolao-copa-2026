# Design — "Ver todos" + liquid glass na seção de palpites do modal

**Data:** 2026-06-16
**Status:** aprovado (brainstorming)

## Contexto

A seção "Palpites nos jogos" (recém-lançada) lista todos os jogos travados de uma vez — fica
longa — e o `Dialog.Content` ganhou `overflow-y-auto`, que mostra a scrollbar padrão feia. Dois
ajustes, **só no `PerfilModal` + 1 classe utilitária no `globals.css`** (sem tocar
rota/helper/dados):

1. Mostrar por padrão só o **dia de jogo mais recente**; o resto atrás de um "Ver todos".
2. Dar ao modal um visual **liquid glass** (fosco translúcido) e uma scrollbar discreta.

## Escopo

### 1. "Ver todos os palpites"
- A seção calcula `grupos = agruparPorDia(data.palpites)` (já existe; `grupos[0]` = dia mais
  recente).
- Estado `verTodos` (`useState(false)`), **resetado para `false` quando troca de bilhete**
  (no mesmo `useEffect([bilheteId])` que faz o fetch).
- Render: `verTodos ? grupos : grupos.slice(0, 1)`.
- Se `grupos.length > 1`: botão **"Ver todos os palpites (+N)"** (N = soma dos jogos dos grupos
  escondidos, `grupos.slice(1)`). Ao clicar, alterna `verTodos`; com `verTodos=true` o texto
  vira **"Ver menos"**.
- `grupos.length <= 1` → sem botão. `data.palpites.length === 0` → seção escondida (como hoje).

### 2. Liquid glass
- **`Dialog.Content`:** troca o fundo sólido por vidro fosco. Classes:
  - `bg-[#0c0c0e]` → `bg-[#0c0c0e]/70` + `backdrop-blur-2xl`
  - `border-[#1f1f23]` → `border-white/10`
  - acrescenta `shadow-2xl shadow-black/50`
  - acrescenta a classe utilitária `scrollbar-glass`
  - mantém `rounded-2xl`, `max-h-[85vh]`, `overflow-y-auto`, `p-5`, etc.
- **Classe `.scrollbar-glass`** (nova, em `app/globals.css`): scrollbar fina, trilho
  transparente, thumb translúcido arredondado (`rgba(255,255,255,.18)`, hover `.30`), com
  suporte Chrome (`::-webkit-scrollbar*`) e Firefox (`scrollbar-width: thin; scrollbar-color`).
  Inclui também o **fade líquido** nas bordas via `mask-image`
  (`linear-gradient(to bottom, transparent, #000 14px, #000 calc(100% - 14px), transparent)`),
  pro conteúdo "derreter" no topo/baixo ao rolar.

## Arquitetura / arquivos
- **Modificar** `components/ranking/PerfilModal.tsx` — estado `verTodos` + reset no effect;
  `grupos` calculado; render fatiado + botão; classes de glass no `Dialog.Content`.
- **Modificar** `components/ranking/__tests__/PerfilModal.test.tsx` — atualizar o teste de
  palpites pro novo comportamento (default mostra só o dia recente; clicar em "Ver todos"
  revela o resto).
- **Modificar** `app/globals.css` — classe `.scrollbar-glass`.

## Testes
- **Component `PerfilModal`:** com palpites em 2 dias, por padrão o jogo do dia mais antigo
  **não** aparece e o botão "Ver todos os palpites" aparece; após `fireEvent.click` no botão, o
  jogo antigo aparece. Mantém os demais testes verdes.
- **Glass:** é CSS — validado por `next build` (Tailwind v4 compila `globals.css`); sem teste
  unitário.

## Fora de escopo
- Mexer na rota/helper/dados de palpites.
- Aplicar o glass em outros modais/telas.
- Palpites de outras tabelas.
