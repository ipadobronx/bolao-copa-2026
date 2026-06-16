# Design — Polimento: cinza/glass, Próximos jogos compacto + Voltar ao Dashboard

**Data:** 2026-06-16
**Status:** aprovado (brainstorming)

## Contexto

Três ajustes de UI após o feedback no print:
1. As linhas de "cada pessoa" no painel **Palpites do jogo** estão num azul (`bg-bg-elevated`)
   que destoa do painel preto. Trocar por um **cinza fosco translúcido** (liquid-glass sutil).
2. O painel **Próximos jogos** está azulado e com cada jogo **empilhado** (dia / casa / × /
   fora / botão em linhas separadas). Deixar **preto** e **uma linha só por jogo** (times
   inline), responsivo.
3. Quem chega via **Próximos jogos → Palpitar** (deep-link num jogo) precisa de um jeito fácil
   de voltar e escolher outro jogo → adicionar **"← Dashboard"** no topo da tela de palpites.

## Escopo

### 1. Linhas de cada pessoa (cinza/glass) — `JogoResumoCard.tsx`
- Cada linha da lista "Palpite de cada um": trocar `bg-bg-elevated border-border` por
  `bg-white/[0.04] border-white/[0.06]` (cinza fosco translúcido sobre o preto).
- O lockbox do card "próximo" (`🔒 …`): trocar `bg-bg-elevated` por `bg-white/[0.04]` e
  `border-border` por `border-white/[0.06]` (mantém `border-dashed`).

### 2. Próximos jogos preto + inline — `ProximosJogosPanel.tsx` + `JogoRow.tsx`
- **Painel:** no `<section className="panel">`, acrescentar `bg-[#08080a] border-[#1b1b1e]`
  (preto igual ao ranking). **Não** alterar o `.panel` global (usado em admin/outros).
- **JogoRow:** trocar o grid empilhado por uma **linha flex única**:
  `[dia/hora]  🇫🇷 França  ×  Senegal 🇸🇳  [Palpitar]`
  - Esquerda: dia + hora, fonte pequena, largura fixa (`w-14 shrink-0`).
  - Centro: `flex min-w-0 flex-1 items-center justify-center gap-1.5` com bandeira+nome da
    casa, `×`, nome+bandeira do visitante. Cada nome em `<span class="truncate">` (nomes
    longos truncam, ex.: "Bósnia e Herz…"). Bandeiras menores (`size={20}`).
  - Direita: `shrink-0` com o `PalpitarButton` (ou o span desabilitado quando TBD).
  - Remover o rótulo de fase (chip) pra ficar compacto.
  - Mantém a borda inferior entre jogos (`border-b last:border-b-0`) e padding enxuto.
  - TBD (sem times): centro mostra os placeholders; Palpitar desabilitado (igual hoje).

### 3. Voltar ao Dashboard — `PalpitesHeader.tsx`
- Acima do `<h1>Meus palpites</h1>`, um link discreto:
  `← Dashboard` → `/dashboard` (`text-xs text-text-muted hover:text-text-primary`).
- Sempre visível (não só no deep-link).

## Arquitetura / arquivos
- **Modificar** `components/dashboard/JogoResumoCard.tsx` — cinza/glass nas linhas + lockbox.
- **Modificar** `components/dashboard/JogoRow.tsx` — layout inline de uma linha.
- **Modificar** `components/dashboard/ProximosJogosPanel.tsx` — `<section>` preta.
- **Modificar** `components/palpites/PalpitesHeader.tsx` — link "← Dashboard".

## Testes
- **Regressão:** os testes atuais de `ProximosJogosPanel` (links "Palpitar" → /comprar ou
  deep-link; nomes dos times renderizados) devem seguir verdes — o redesign mantém os nomes
  (em spans `truncate`) e o `PalpitarButton`. Sem novos testes unitários (mudança é
  estilo/layout; o `next build` valida CSS).
- Checagem manual: print mobile mostrando o preto, a linha única por jogo e o "← Dashboard".

## Fora de escopo
- Mudar o `.panel` global; estilizar o modal seletor do PalpitarButton; lógica dos jogos.
