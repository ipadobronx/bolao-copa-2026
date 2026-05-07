# Plano de implementação — F17: Termos de Uso + Política de Privacidade

**Data:** 2026-05-07
**Spec:** `docs/superpowers/specs/2026-05-07-f17-termos-privacidade-design.md`
**Modo:** execução direta nesta sessão (sem subagents, sem TDD — conteúdo estático).
**Branch:** `main` (sem worktree — F17 é puramente aditiva, não toca código existente).

---

## 1. Princípios

- **Aditivo**: cria 2 arquivos novos; não altera nenhum arquivo existente.
- **Server Components**: zero JavaScript no cliente, conteúdo HTML puro.
- **Sem dependências novas**: reutiliza tokens Tailwind v4 do `globals.css`.
- **Sem teste**: conteúdo estático, sem lógica condicional. Verificação = `tsc --noEmit` + `next build`.
- **Placeholders literais**: `[CONTATO_PLACEHOLDER]` e `[DATA_ATUALIZACAO]` ficam no código pra Jonatas substituir manualmente.

---

## 2. Sequência de tarefas

### Tarefa 1 — Criar `app/(public)/termos/page.tsx`

**Objetivo:** Server Component com 14 seções dos Termos de Uso.

**Estrutura do arquivo:**
```tsx
import Link from 'next/link';

export const metadata = {
  title: 'Termos de Uso · Mala na Copa',
  description: 'Termos de uso do bolão Mala na Copa — Copa do Mundo 2026.',
};

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="font-mono text-xs text-text-muted hover:text-accent">
        ← Voltar para a página inicial
      </Link>

      <h1 className="font-display text-4xl tracking-wide text-text-primary mt-6 mb-2">
        Termos de Uso
      </h1>
      <p className="font-mono text-xs text-text-muted mb-10">
        Última atualização: [DATA_ATUALIZACAO]
      </p>

      {/* 14 seções com H2 + parágrafos */}
    </main>
  );
}
```

**Conteúdo das 14 seções (resumo de cada):**

1. **Apresentação** — quem somos (Equipe Mala na Copa, operador pessoa física), natureza privada do bolão, não-afiliação à FIFA, base normativa (Lei 14.790/2023, CDC).
2. **Aceite dos termos** — uso da plataforma = aceitação tácita, quem discordar deve cessar uso.
3. **Cadastro** — 18+ obrigatório, dados verídicos, conta única, responsabilidade pelas credenciais.
4. **Funcionamento do bolão** — compra de tabelas (1 = 1 conjunto de palpites), palpites por rodada, deadline = início de cada jogo, sistema de pontuação (placar exato 10pts, etc — referência simplificada), bônus pré-Copa.
5. **Pagamentos** — PIX via MP, R$ 20/tabela, confirmação automática via webhook, prazo de expiração da cobrança.
6. **Premiação** — total R$ 10k, distribuição: 1º R$ 7.000 / 2º R$ 2.000 / 3º R$ 1.000. Pagamento via PIX em até 30 dias após fim da Copa. Empate: critérios de desempate em cascata (referenciar regras do site sem detalhar).
7. **Cashback** — 13 seleções elegíveis, valor mínimo R$ 100, multiplicador (1×/2×/3×/5×), pago somente se a seleção for campeã, valor = `valor_pago × multiplicador`, pago após fim da Copa via PIX.
8. **Reembolso** — integral em até 24h após pagamento, condicionado a ser antes do 1º jogo (11/06/2026). Após o 1º jogo: produto consumido, sem reembolso.
9. **Conduta do usuário** — proibido: contas múltiplas, fraude, automação de palpites, engenharia reversa, uso indevido da marca.
10. **Suspensão e cancelamento** — operador pode suspender/cancelar contas que violarem termos, sem prejuízo de outras medidas legais. **`TODO_LEGAL`**
11. **Responsabilidades** — operador atua com diligência mas não responde por: instabilidade de internet, falhas no Mercado Pago, falhas em provedores externos (Supabase/Vercel/API-Football), eventos de força maior. **`TODO_LEGAL`**
12. **Propriedade intelectual** — marca, logo, conteúdo do site são da Equipe Mala na Copa; uso não autorizado é vedado.
13. **Foro** — domicílio do consumidor, conforme CDC. **`TODO_LEGAL`**
14. **Contato e atualização** — email `[CONTATO_PLACEHOLDER]`, operador pode atualizar termos com aviso aos usuários cadastrados.

**Comentários `TODO_LEGAL` injetados antes das seções 10, 11 e 13.**

**Padrão por seção:**
```tsx
<h2 className="font-display text-2xl text-accent mt-10 mb-4">
  N. Título da seção
</h2>
<p className="font-body text-text-secondary leading-relaxed mb-4">
  Texto formal mas acessível.
</p>
```

---

### Tarefa 2 — Criar `app/(public)/privacidade/page.tsx`

**Objetivo:** Server Component com 12 seções da Política de Privacidade (LGPD).

**Estrutura do arquivo:** análoga aos Termos.

```tsx
export const metadata = {
  title: 'Política de Privacidade · Mala na Copa',
  description: 'Como tratamos seus dados pessoais no bolão Mala na Copa, conforme a LGPD.',
};
```

**Conteúdo das 12 seções (resumo):**

1. **Quem somos** — Equipe Mala na Copa, controlador dos dados (LGPD Art. 5º, VI).
2. **Dados coletados** — lista (nome, email, senha hash, telefone opcional, CPF opcional, palpites, IP/log de acesso, dados de pagamento via MP — não armazenamos cartão/PIX).
3. **Finalidade** — operar o bolão, comunicar resultados, processar pagamentos/cashback, prevenir fraude, cumprir obrigações legais.
4. **Base legal** — execução de contrato (Art. 7º, V), consentimento (Art. 7º, I), obrigação legal (Art. 7º, II), legítimo interesse (Art. 7º, IX) onde aplicável.
5. **Compartilhamento** — Mercado Pago (pagamento), Supabase (banco), Vercel (hospedagem), API-Football (apenas dados de jogos públicos, sem dados pessoais). **`TODO_LEGAL`**
6. **Direitos do titular (Art. 18)** — acessar, corrigir, anonimizar/excluir, portabilidade, revogar consentimento, informação sobre compartilhamento. Solicitação por email. **`TODO_LEGAL`**
7. **Retenção** — dados mantidos durante uso ativo + 5 anos após (obrigação fiscal/legal), depois excluídos ou anonimizados.
8. **Segurança** — RLS no Supabase (controle por linha), HTTPS obrigatório, hash de senha, boas práticas de desenvolvimento. Não há sistema 100% seguro — usuário também é responsável por proteger credenciais.
9. **Cookies** — apenas essenciais (sessão de autenticação Supabase, CSRF). Sem rastreamento publicitário, sem cookies de terceiros.
10. **Menores** — não direcionado a menores de 18 anos, não coletamos dados de menores. Cadastro exige 18+.
11. **Encarregado (DPO)** — email de contato `[CONTATO_PLACEHOLDER]` para exercer direitos LGPD ou tirar dúvidas.
12. **Atualização** — política pode ser atualizada com aviso aos usuários cadastrados; data de "última atualização" no topo.

**Comentários `TODO_LEGAL` injetados antes das seções 5 e 6.**

---

### Tarefa 3 — Verificação local

**Comandos:**
```bash
pnpm typecheck
pnpm build
```

**Critérios:**
- `pnpm typecheck` passa sem erros.
- `pnpm build` compila as 2 novas rotas como SSG (estáticas).
- Saída do build deve listar `/termos` e `/privacidade` como `○ (Static)`.

**Smoke test (manual, opcional se build ok):**
- `pnpm dev` → abrir `http://localhost:3000/termos` e `http://localhost:3000/privacidade`.
- Verificar:
  - Header e footer presentes (vêm do layout `(public)`).
  - Link "← Voltar" funciona.
  - Footer "Termos de Uso" leva pra `/termos`, "Privacidade" pra `/privacidade`.
  - Mobile (largura 375px): sem overflow horizontal, hierarquia legível.

---

## 3. Riscos e mitigações

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Texto legal contém afirmação que não se sustenta juridicamente | Alta | Marcado como `v1 — pendente revisão jurídica` na spec; 5 pontos `TODO_LEGAL` sinalizados; usuário é desenvolvedor (não advogado) e tem ciência. |
| Placeholders esquecidos em produção | Média | Sintaxe `[NOME]` é grep-friendly; checklist pós-merge: `grep -r "\[CONTATO_PLACEHOLDER\]\|\[DATA_ATUALIZACAO\]" app/`. |
| Estilo divergente da landing | Baixa | Usa exatamente os tokens existentes em `globals.css`; sem novas classes nem deps. |
| Quebra no build por TypeScript estrito | Baixa | Server Components com tipos óbvios; metadata é `Metadata` do Next mas inferência funciona; sem props complexas. |
| CLAUDE.md fica conflitante (top-10 vs top-3) | Certa | Já flagado na spec §9 como dívida documental; PR separado pra atualizar. |

---

## 4. Estimativa

- Tarefa 1 (Termos): ~30min (escrever conteúdo legal + JSX).
- Tarefa 2 (Privacidade): ~25min (idem, mais curto).
- Tarefa 3 (verificação): ~5min.

**Total: ~1h.** Sem testes, sem brainstorming, sem subagents. Direto no `main`.

---

## 5. Checklist de execução

- [ ] Criar `app/(public)/termos/page.tsx` com 14 seções + 3 `TODO_LEGAL` + metadata.
- [ ] Criar `app/(public)/privacidade/page.tsx` com 12 seções + 2 `TODO_LEGAL` + metadata.
- [ ] Rodar `pnpm typecheck` — deve passar.
- [ ] Rodar `pnpm build` — deve gerar as 2 rotas como `○ (Static)`.
- [ ] Abrir `/termos` e `/privacidade` em dev local — verificar render visual e mobile.
- [ ] Confirmar 5 placeholders na busca: `grep -r "\[CONTATO_PLACEHOLDER\]\|\[DATA_ATUALIZACAO\]" app/(public)/termos app/(public)/privacidade`.
- [ ] Confirmar 5 `TODO_LEGAL` na busca: `grep -rn "TODO_LEGAL" app/(public)/termos app/(public)/privacidade`.

---

## 6. Pós-merge (manual pelo Jonatas)

1. Substituir `[CONTATO_PLACEHOLDER]` pelo email pessoal real (em `/termos` e `/privacidade`).
2. Substituir `[DATA_ATUALIZACAO]` pela data efetiva de publicação (formato `DD/MM/YYYY`).
3. Adicionar nota no `CLAUDE.md` informando que `/termos` e `/privacidade` estão como **v1 — pendente revisão jurídica** (e atualizar §3.2 pra refletir top-3 enquanto está nele).
4. Antes de divulgação ampla, contratar revisão de advogado especializado em direito desportivo/gaming pra revisar os 5 `TODO_LEGAL`.
