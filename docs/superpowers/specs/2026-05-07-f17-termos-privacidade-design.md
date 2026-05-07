# Feature 17 — Termos de Uso + Política de Privacidade

**Data:** 2026-05-07
**Status:** Aprovado para implementação (aprovação inline, sem subagent-driven)
**Autor:** Brief Jonatas → spec direta (sem brainstorming pesado)
**Próximo passo:** plan curto (~400 linhas) → execução direta nesta sessão

---

## 1. Contexto e motivação

Décima sétima feature da seção 5 do `CLAUDE.md`. F1–F16 mergeadas — sistema em produção em `https://malanacopa.com.br`. O `SiteFooter` (F15) já referencia `/termos` e `/privacidade`, mas as rotas **não existem** — clicar dá 404. Esta feature cria as duas páginas legais estáticas que faltam.

**Posicionamento jurídico:** bolão da Copa do Mundo 2026 operado por **Pessoa Física (CPF)**, posicionado como **"competição privada entre conhecidos"** (não casa de apostas). Acesso restrito a usuários cadastrados. Conformidade com **Lei 14.790/2023, CDC, LGPD**. Apresentação pública: "**Equipe Mala na Copa**" (sem nomes pessoais expostos).

**Não é**: revisão jurídica profissional. Saída marcada como `v1 — pendente revisão jurídica` em pontos sensíveis via comentários `{/* TODO_LEGAL: revisar com advogado */}`.

---

## 2. Decisões consolidadas (sem brainstorming aberto)

| Item | Decisão |
|------|---------|
| Premiação | **R$ 7.000 (1º) · R$ 2.000 (2º) · R$ 1.000 (3º)** — top 3 apenas, total R$ 10k. Alinha com landing F15. **Discrepância flagada com CLAUDE.md §3.2** (que diz top-10) — não corrigida nesta F17, registrada como dívida. |
| Cashback | 13 seleções elegíveis · valor pago ≥ R$ 100 · multiplicador 1×/2×/3×/5× × valor pago, pago somente se a seleção escolhida for campeã. |
| Pagamento | PIX via Mercado Pago. R$ 20 por tabela. |
| Reembolso | Integral em até 24h após pagamento, **desde que antes do 1º jogo (11/06/2026)**. Após o 1º jogo: produto consumido, sem reembolso. **Política operacional manual** — sem feature técnica de reembolso nesta F17. |
| Idade mínima | 18 anos. |
| Contato | Placeholder `[CONTATO_PLACEHOLDER]` — Jonatas substitui à mão pós-merge. |
| Foro | Domicílio do consumidor (CDC). |
| Pagamento de prêmio | Via PIX em até **30 dias** após fim da Copa. Política operacional. |
| Pagamento de cashback | Via PIX após fim da Copa. Política operacional. |
| DPO | Email de contato (mesmo placeholder ou variação) — Jonatas decide ao substituir. |
| Footer | **Já aponta pra `/termos` e `/privacidade`.** Nada a alterar em `SiteFooter.tsx`. |

---

## 3. Estrutura dos Termos de Uso (`/termos`)

14 seções, em ordem:

1. **Apresentação** — Equipe Mala na Copa, natureza privada do bolão, não-afiliação à FIFA.
2. **Aceite dos termos** — uso = aceitação tácita; quem discordar não usa.
3. **Cadastro** — 18+, dados verídicos, responsabilidade pelo acesso, conta única por pessoa.
4. **Funcionamento do bolão** — compra de tabelas, palpites por rodada, sistema de pontuação, deadlines.
5. **Pagamentos** — PIX/MP, R$ 20/tabela, confirmação automática, PIX sem QR pago não conta.
6. **Premiação** — distribuição R$ 10k entre top 3 (7k/2k/1k), pagamento PIX em até 30 dias após fim da Copa.
7. **Cashback** — 13 seleções, regra do snapshot, valor mínimo R$ 100, pago após Copa via PIX.
8. **Reembolso** — integral em 24h se antes do 1º jogo; após, sem reembolso.
9. **Conduta do usuário** — proibido: contas múltiplas, fraude, automação de palpites, engenharia reversa.
10. **Suspensão e cancelamento** — operador pode suspender contas que violarem termos. `TODO_LEGAL`.
11. **Responsabilidades** — operador não responde por instabilidade de internet, falhas no MP, falhas em provedores externos. `TODO_LEGAL`.
12. **Propriedade intelectual** — site e conteúdo são da Equipe Mala na Copa.
13. **Foro** — domicílio do consumidor (CDC). `TODO_LEGAL`.
14. **Contato e atualização** — email, operador pode atualizar termos com aviso aos usuários.

---

## 4. Estrutura da Política de Privacidade (`/privacidade`)

12 seções LGPD, em ordem:

1. **Quem somos** — Equipe Mala na Copa, controlador dos dados (Lei 13.709/2018 Art. 5º, VI).
2. **Dados coletados** — nome, email, senha (hash), telefone (opcional), CPF (opcional), palpites, dados de pagamento (processados pelo MP — nós não armazenamos cartão/PIX).
3. **Finalidade** — operar o bolão, comunicar resultados, processar pagamentos/cashback, prevenir fraude.
4. **Base legal** — execução de contrato (Art. 7º, V) + consentimento (Art. 7º, I) + obrigação legal (Art. 7º, II) onde aplicável.
5. **Compartilhamento** — Mercado Pago (pagamento), Supabase (armazenamento), Vercel (hospedagem), API-Football (jogos públicos, sem dados pessoais). `TODO_LEGAL`.
6. **Direitos do titular (Art. 18)** — acessar, corrigir, excluir, portabilidade, revogar consentimento. Solicitação por email. `TODO_LEGAL`.
7. **Retenção** — durante uso ativo + 5 anos após (obrigação fiscal/legal).
8. **Segurança** — RLS no Supabase, HTTPS obrigatório, autenticação por senha (hash), boas práticas.
9. **Cookies** — apenas essenciais (sessão Supabase, CSRF). Sem rastreamento publicitário.
10. **Menores** — não coletamos dados de menores; cadastro exige 18+.
11. **Encarregado (DPO)** — email de contato pra exercer direitos LGPD.
12. **Atualização** — política pode ser atualizada com aviso aos usuários.

---

## 5. Implementação técnica

### 5.1 Arquivos novos

| Arquivo | Linhas alvo | Conteúdo |
|---------|-------------|----------|
| `app/(public)/termos/page.tsx` | ~250 (com texto) | Server Component, 14 seções, metadata SEO. |
| `app/(public)/privacidade/page.tsx` | ~200 (com texto) | Server Component, 12 seções, metadata SEO. |

### 5.2 Arquivos NÃO alterados

- `components/layout/SiteFooter.tsx` — já referencia `/termos` e `/privacidade`. Nada a fazer.
- `app/(public)/layout.tsx` — já envolve com `SiteHeader` e `SiteFooter`. Nada a fazer.
- Schema/RLS/ENV — sem alterações.

### 5.3 Padrão visual (sem `@tailwindcss/typography`)

Estilos inline via classes Tailwind v4 com tokens existentes em `globals.css`:

- **Wrapper:** `<main className="mx-auto max-w-3xl px-6 py-12">`
- **Link "← Voltar":** topo, `font-mono text-xs text-text-muted hover:text-accent`
- **H1:** `font-display text-4xl tracking-wide text-text-primary mb-2`
- **Subtítulo "Última atualização":** `font-mono text-xs text-text-muted mb-10`
- **H2 (seções numeradas):** `font-display text-2xl text-accent mt-10 mb-4`
- **H3 (subsubseções, se houver):** `font-body text-lg font-semibold text-text-primary mt-6 mb-2`
- **Parágrafos:** `font-body text-text-secondary leading-relaxed mb-4`
- **Listas (raras):** `list-disc pl-6 text-text-secondary leading-relaxed mb-4 space-y-1`
- **Strong:** `text-text-primary font-semibold`

### 5.4 Placeholders

Substituídos manualmente por Jonatas pós-merge:

- `[CONTATO_PLACEHOLDER]` — email pessoal de contato (aparece em §14 dos Termos e §11 da Privacidade)
- `[DATA_ATUALIZACAO]` — data de última atualização no topo de cada página

### 5.5 Comentários `TODO_LEGAL`

Em pontos sensíveis pra revisão jurídica futura:

- Termos §10 (Suspensão e cancelamento)
- Termos §11 (Responsabilidades / exclusão)
- Termos §13 (Foro)
- Privacidade §5 (Compartilhamento)
- Privacidade §6 (Direitos do titular — texto da revogação)

Formato: `{/* TODO_LEGAL: revisar com advogado — ponto X */}` antes da seção.

### 5.6 Metadata (SEO)

Cada página exporta:

```ts
export const metadata = {
  title: 'Termos de Uso · Mala na Copa',
  description: 'Termos de uso do bolão Mala na Copa — Copa do Mundo 2026.',
}
```

Análoga para Privacidade.

---

## 6. Tom da redação

- Formal mas acessível — linguagem clara, sem juridiquês excessivo.
- Operador na 1ª pessoa do plural ("nós", "nossa equipe").
- Usuário em 2ª pessoa ("você").
- Frases curtas, parágrafos pequenos.
- Subheadings descritivos pra escaneabilidade.
- Sem listas excessivas — texto formal lê melhor (use lista só onde fizer sentido: dados coletados, direitos LGPD, terceiros).

---

## 7. Critérios de aceite

- [ ] `/termos` renderiza com as 14 seções na ordem da §3, com `[CONTATO_PLACEHOLDER]` e `[DATA_ATUALIZACAO]` literais.
- [ ] `/privacidade` renderiza com as 12 seções na ordem da §4, com placeholders idem.
- [ ] Footer continua funcionando — clicar em "Termos de Uso" leva pra `/termos` (200), idem privacidade.
- [ ] 5 comentários `TODO_LEGAL` presentes nos pontos da §5.5.
- [ ] Metadata `title` + `description` em cada página.
- [ ] Layout consistente com landing — dark theme, fontes Bebas/Archivo/JetBrains Mono.
- [ ] Mobile-first verificado (largura ≤ 375px sem overflow).
- [ ] Server Component (zero JS no client).
- [ ] `tsc --noEmit` passa.
- [ ] `next build` passa.

---

## 8. Fora de escopo

- TDD (conteúdo estático, zero lógica).
- Subagents (economia de tokens).
- Tradução pra outros idiomas.
- Cookie banner (cookies são apenas essenciais).
- Feature técnica de reembolso (manual via PIX).
- Mecanismo de notificação de atualização dos termos (email/banner) — texto promete, implementação fica pra fase 2.
- Atualização de `CLAUDE.md §3.2` (dívida documental — flagada, não corrigida nesta F17).

---

## 9. Dívidas conhecidas pós-merge

1. **CLAUDE.md §3.2 stale** — ainda diz top-10 (5k/2.5k/1.5k + 1k pra 4-10). Texto legal e landing dizem top-3 (7k/2k/1k). Atualizar `CLAUDE.md` em PR separado.
2. **Placeholders** — Jonatas substitui `[CONTATO_PLACEHOLDER]` e `[DATA_ATUALIZACAO]` antes de tornar público.
3. **Revisão jurídica** — todos os 5 `TODO_LEGAL` precisam de aval de advogado especializado em direito desportivo/gaming antes de operação em escala.
