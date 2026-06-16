# Design — Palpites por jogo no modal do ranking (revelados ao travar)

**Data:** 2026-06-16
**Status:** aprovado (brainstorming)

## Contexto

No grupo, a galera quer ver **o que cada um apostou** num jogo depois que ele começa — pra
gerar debate. Hoje isso só dá pra saber consultando o banco manualmente. O modal de perfil
(`PerfilModal`) já mostra selo, pontos/forma, bônus e pontuação por tabela; falta o que mais
gera treta: **o placar que a pessoa cravou em cada jogo já travado**.

Palpites são privados até o apito e públicos depois — e isso **já é garantido por RLS**: a
policy `palpites_select_own_or_started` (`20260429202547_initial_schema.sql:478`) só expõe o
palpite de outra pessoa quando aquele jogo específico já começou (`j.data_hora <= now()`).
Logo, buscar os palpites com o cliente que respeita RLS traz **apenas jogos travados**, sem
risco de vazar palpite de jogo futuro. **Sem migration.**

## Escopo

### Onde
Nova seção no `PerfilModal`, abaixo de "Pontuação por tabela", título **"Palpites nos jogos"**.

### De qual tabela
Somente a **melhor** (a do ranking, `melhorBilheteId`) — que é exatamente o `bilheteId` que o
modal já usa pra buscar `/api/perfil/[bilheteId]`.

### Quais jogos
Todos os **travados** (RLS já filtra), **agrupados por dia** (cabeçalho de data em BRT), dias
mais recentes primeiro; dentro do dia, por horário de apito decrescente (mais recente no topo).

### Conteúdo de cada linha
- `🇧🇪 Bélgica <palpiteCasa>×<palpiteFora> Egito 🇪🇬` (nomes + bandeira via `BandeiraImg`,
  igual ao bloco do campeão).
- **Finalizado:** acrescenta ` · real <golsCasa>×<golsFora> · +<pontos> pts`.
- **Em andamento** (travado mas `finalizado=false`): só o palpite + tag discreta
  "em andamento" (sem resultado/pontos, que ainda não existem).
- **Sem palpite** na melhor tabela pra um jogo travado: linha do jogo com "— sem palpite"
  e `0 pts` se finalizado. (A melhor tabela pode ter pulado um jogo.)

### Layout
A lista cresce (até 104 jogos no fim da Copa), então o `Dialog.Content` ganha
`max-height` (ex.: `max-h-[85vh]`) + `overflow-y-auto` — hoje o modal não rola.

## Arquitetura

- **Rota `app/api/perfil/[bilheteId]/route.ts`** (já retorna `campeao`, `artilheiro`,
  `tabelas`, `totalTabelas`): passa a retornar também `palpites[]` — **um item por jogo já
  travado**, com o palpite da melhor tabela quando existir (ou `null` = "sem palpite").
  - 1) Jogos travados: `jogos.select('id, numero_jogo, data_hora, fase, finalizado, gols_casa, gols_fora, selecao_casa:selecoes!selecao_casa_id(nome, bandeira_emoji), selecao_fora:selecoes!selecao_fora_id(nome, bandeira_emoji)').lte('data_hora', <agora ISO>).order('data_hora', { ascending: false })`.
    (`<agora>` = `new Date().toISOString()`.)
  - 2) Palpites do bilhete: `palpites.select('jogo_id, gols_casa, gols_fora, pontos_calculados').eq('bilhete_id', bilheteId)`
    (cliente RLS-respecting; RLS já devolve só os de jogos travados). Monta `Map<jogo_id, palpite>`.
  - 3) Merge: para cada jogo travado, anexa o palpite do Map (ou `null`). Evita N+1 (2 queries).
  - Shape de cada item:
    ```ts
    {
      numeroJogo: number
      dataHora: string          // ISO — para agrupar por dia (BRT)
      casa: string; fora: string
      bandeiraCasa: string | null; bandeiraFora: string | null
      palpiteCasa: number | null; palpiteFora: number | null  // null = sem palpite
      realCasa: number | null; realFora: number | null
      finalizado: boolean
      pontos: number | null     // pontos_calculados; null se sem palpite ou ainda não finalizado
    }[]
    ```
  - Assim, todo jogo travado aparece — com o placar cravado ou com "— sem palpite".

- **Helper puro `lib/ranking/agruparPorDia.ts`** + teste: recebe a lista de palpites e
  retorna `{ dia: string; label: string; jogos: Palpite[] }[]`, dias decrescentes, jogos por
  `dataHora` decrescente. Dia/label em BRT (`America/Sao_Paulo`). Pura e testável.

- **`components/ranking/PerfilModal.tsx`**: nova seção que chama o helper e renderiza os
  grupos (cabeçalho de dia + linhas). Estado de loading junto com o fetch atual. Scroll no
  `Dialog.Content`.

## Testes
- **Unit `agruparPorDia`:** agrupa 2 dias, ordena dias e jogos do mais recente pro mais antigo;
  formata o label de dia em BRT; lista vazia → `[]`.
- **Component `PerfilModal`:** com `palpites` mockados (1 finalizado + 1 em andamento),
  renderiza a seção "Palpites nos jogos", o placar do palpite, o `real`/`pts` no finalizado e
  a tag "em andamento" no outro. Mantém os testes atuais verdes.

## Fora de escopo
- Palpites das **outras** tabelas (só a melhor).
- Jogos **não iniciados** (escondidos pelo RLS).
- Mexer na tela `/jogos` ou no `/ranking`.
- Mostrar palpites de bônus aqui (já têm a própria seção).
