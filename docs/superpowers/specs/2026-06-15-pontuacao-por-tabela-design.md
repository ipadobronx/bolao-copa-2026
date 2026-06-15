# Design — Pontuação por tabela (transparência multi-tabela)

**Data:** 2026-06-15
**Status:** aprovado (brainstorming)

## Contexto

Quem tem mais de uma tabela não sabe quantos pontos cada uma fez — só vê a posição da
**melhor** tabela no `/ranking` (que ranqueia por pessoa). Isso atrapalha quem quer ajustar
estratégia entre tabelas. A pontuação por bilhete **já existe** na view `ranking`; falta só
expô-la em dois lugares.

O `/ranking` **não muda** (continua por pessoa, melhor bilhete). A pontuação por tabela
aparece em:

1. **Minhas Tabelas** (`/minhas-tabelas`) — visão do próprio dono.
2. **Modal de perfil do ranking** (`PerfilModal`) — ao clicar num apostador.

## Dados (já existem — sem migration)

A view `public.ranking` (migration `20260430120000_ranking_tiebreakers.sql`) tem **uma linha
por bilhete confirmado**, com as colunas usadas aqui:

- `bilhete_id`, `numero_bilhete`, `user_id`, `nome`
- `pontos_totais` (palpites + bônus)
- `posicao` (1..N entre **todas as tabelas confirmadas**, com os tiebreakers da §3.5)

A view é `security_invoker = false` e tem `GRANT SELECT` para `authenticated`, então qualquer
autenticado já lê todas as linhas (é o que alimenta o `/ranking`). **Nenhuma exposição nova:**
os pontos por tabela já são públicos hoje. O denominador "de N tabelas" = total de linhas da
view (= bilhetes confirmados).

## Escopo

### 1. Minhas Tabelas (`app/(dashboard)/minhas-tabelas/page.tsx` + `TabelaCard.tsx`)

- A página já lista **todos** os bilhetes do usuário (qualquer status) e monta `countMap`
  (palpites por bilhete). Adiciona-se uma consulta à view `ranking` filtrada por
  `user_id = user.id`, montando `pontosMap: Map<bilheteId, { pontos: number; posicao: number }>`,
  mais o **total de tabelas** (`count` da view `ranking`, head-only) para o denominador.
- `TabelaCard` ganha props novas opcionais: `pontos?: number | null`, `posicao?: number | null`,
  `totalTabelas?: number | null`.
- Exibição no card (só quando **confirmado** e há pontuação):
  - Bloco novo, acima do botão "Preencher palpites", no estilo atual:
    `<pontos> pts` em destaque (accent) + `<posicao>ª de <totalTabelas>` em mono/muted.
  - Tabela **não confirmada** (pendente/expirado/cancelado): não mostra pontuação (a view
    `ranking` só tem confirmados; o card segue como hoje, esmaecido).

### 2. Modal de perfil (`PerfilModal.tsx` + rota `/api/perfil/[bilheteId]`)

- A rota hoje recebe `bilheteId` (o melhor bilhete da linha) e devolve os bônus. Passa a
  devolver **também** a lista de tabelas do dono:
  1. Descobre o `user_id` do dono: `bilhetes.select('user_id').eq('id', bilheteId).single()`.
  2. Lê a view `ranking` desse dono:
     `ranking.select('bilhete_id, numero_bilhete, pontos_totais, posicao').eq('user_id', userId).order('numero_bilhete')`.
  3. Lê o total de tabelas: `ranking.select('*', { count: 'exact', head: true })`.
  - Resposta passa a ser:
    ```ts
    {
      campeao: { nome, bandeira } | null,
      artilheiro: string | null,
      tabelas: { bilheteId: string; numero: number; pontos: number; posicao: number }[],
      totalTabelas: number,
    }
    ```
  - Continua usando o **cliente que respeita RLS** (`createSupabaseServerClient`), coerente
    com a correção de segurança da feature anterior. A view `ranking` é legível por
    autenticado; os bônus seguem a policy de pós-início.
- `PerfilModal`:
  - Quando o apostador tem **2+ tabelas** (`entry.totalBilhetes > 1` **e** `tabelas.length > 1`),
    renderiza uma seção nova **"Pontuação por tabela"**, abaixo do bloco de bônus, listando
    cada tabela: `Tabela nº<numero> — <pontos> pts · <posicao>ª`.
  - A tabela que é a **do ranking** (a melhor, = `entry.melhorBilheteId`) recebe um selo
    discreto (ex.: "★ ranking") pra deixar claro qual conta pra posição da pessoa.
  - Com **1 tabela**, a seção não aparece (o topo do card já mostra o placar único).
  - A seção tem estado de loading junto com o fetch de bônus (mesmo `loading`).

### Ordenação
Lista por `numero_bilhete` crescente (igual ao Minhas Tabelas), nos dois lugares.

## Arquitetura / arquivos

- **Modificar** `app/(dashboard)/minhas-tabelas/page.tsx` — consulta `ranking` + total, monta
  `pontosMap`, passa props ao `TabelaCard`.
- **Modificar** `components/minhas-tabelas/TabelaCard.tsx` — props `pontos`/`posicao`/`totalTabelas`
  + bloco de exibição (conditional spread sob `exactOptionalPropertyTypes`).
- **Modificar** `app/api/perfil/[bilheteId]/route.ts` — retornar `tabelas` + `totalTabelas`.
- **Modificar** `components/ranking/PerfilModal.tsx` — tipo `Bonus`→`PerfilData` com `tabelas`,
  renderizar a seção quando 2+.
- Sem mudanças em `RankingRow`/`RankingShell` (já passam `entry` com `userId`/`totalBilhetes`).

## Testes

- **Componente `TabelaCard`:** renderiza "pts" e "Nª de M" quando confirmado e com pontos;
  **não** renderiza pontuação quando não confirmado (RTL).
- **Componente `PerfilModal`:** com `tabelas.length > 1`, renderiza a seção "Pontuação por
  tabela" e as linhas (mock do fetch); com 1 tabela, a seção não aparece. (Estende o teste
  existente, mantendo os casos atuais verdes.)
- **Rota:** validação de tipos (tsc) do novo shape. (Teste de integração de rota não é padrão
  no projeto; cobertura via tsc + checagem manual.)

## Fora de escopo

- Mudar o `/ranking` (continua por pessoa, melhor bilhete).
- Criar uma página/aba de ranking por bilhete.
- Mostrar pontuação de tabelas **não confirmadas** (não existem na view `ranking`).
- Posição "como no /ranking por pessoa" para tabelas não-melhores (sistema diferente; usamos
  a posição entre todas as tabelas, rotulada como tal).
