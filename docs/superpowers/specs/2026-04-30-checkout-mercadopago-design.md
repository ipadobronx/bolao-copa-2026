# Feature 6 — Checkout + integração Mercado Pago (PIX)

**Data:** 2026-04-30
**Status:** Aprovado para implementação
**Autor:** Brainstorm conduzido com Jonatas (sócio dev)
**Próximo passo:** writing-plans → executing-plans em worktree separado

---

## 1. Contexto e motivação

Sexta feature da seção 5 do `CLAUDE.md`. F1-F5 mergeadas:

- **F1** entregou Next.js 14 + Tailwind v4 + 4 clients Supabase tipados (`browser`, `server`, `admin`, `middleware`) + middleware de auth.
- **F2** entregou schema completo (7 tabelas, 3 enums, 13 triggers, RLS, view `ranking`) + seed de 48 seleções e 104 jogos.
- **F3** entregou landing recriada do protótipo.
- **F4** entregou auth (magic link) + layout `(dashboard)` (sidebar + header) + página `/dashboard` real.
- **F5** entregou `lib/pontuacao.ts` puro (cobertura ≥ 95%) + view `ranking` com tiebreakers §3.5.

Esta feature constrói o **checkout PIX completo**:

- Schema delta: cashback diferenciado por tier (1×–5×), sem limite de vagas, snapshot do multiplicador no bilhete, view `bilhetes_view` com `effective_status`, rename `asaas_payment_id` → `mp_payment_id`.
- Libs puras: `lib/cashback.ts` (cálculo de retorno), `lib/checkout.ts` (mapeadores MP↔domínio), `lib/mercadopago.ts` (wrapper SDK + HMAC).
- Server Action `criarCheckout` em `app/(dashboard)/comprar/actions.ts`.
- Route handlers: `GET /api/checkout/[id]/status` (polling) e `POST /api/webhooks/mercadopago` (idempotente).
- UI: rota `app/(dashboard)/comprar/page.tsx` (Stepper + CashbackPicker + resumo) e `app/(dashboard)/comprar/[id]/pix/page.tsx` (QR + countdown + estado).
- Landing CTA "Comprar minha tabela →" passa a apontar pra `/comprar`.

Esta feature **não entrega:**

- Tela de palpites (F7)
- Pagamento real do cashback ao usuário quando ele acerta o campeão (F11 — admin payouts)
- Painel de exposição de cashback por seleção (F11)
- Cron de limpeza de bilhetes pendentes expirados — mantemos `effective_status` lazy + webhook de cancelamento; cron pode ser adicionado em feature posterior se virar problema de hygiene
- Auto-refund via API MP em casos de race condition (escopo manual via painel admin se acontecer)
- Notificação por WhatsApp (F13)

---

## 2. Decisões consolidadas no brainstorming

| #   | Pergunta                                                | Escolha                                                                                                                    | Motivação                                                                                                                                              |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | Modelo: 1 PIX = quantos bilhetes?                       | **B — 1 PIX = N bilhetes, 1 carrega `valor_pago` + cashback**                                                              | Encaixa schema F2 sem refatoração; "5 tabelas" = 5 ranking positions; cashback no bilhete principal; outros com `valor_pago=0`.                        |
| Q2  | Ordem das operações (cashback safety)                   | **P1 — TX1 INSERT pendente, chama MP, TX2 UPDATE com `mp_payment_id` e `expira_em`**                                       | Sem 20-slot a urgência caiu, mas mantém princípio de "criar antes, charge depois" pra simplificar rollback (TX2 vira `cancelado` se MP falhar).        |
| Q3  | Lifecycle "pendente → expirado"                         | **1 + 2 — lazy via `effective_status` (CASE) + webhook MP flipa quando avisa**                                             | Sem cron extra. View `bilhetes_view` calcula on-read. Webhook é o reforço quando MP envia `payment.cancelled`/`expired`.                               |
| Q4  | Limite de vagas por seleção (cashback)                  | **🔄 Pivot: SEM LIMITE.** Curadoria do pool de 13 elegíveis substitui a proteção                                           | Decisão de produto durante o brainstorm. CLAUDE.md §1, §3.3, §6 atualizados nesta sessão. Trigger `enforce_cashback_slot_limit` removido na migration. |
| Q5  | Cashback uniforme ou tiered?                            | **🔄 Tiered:** 100% (FRA/ESP/ENG) · 200% (BRA/ARG) · 300% (POR/GER/NED) · 500% (NOR/SUI/BEL/COL/URU)                       | Curadoria gera o equilíbrio risco/payout. As 35 seleções fora desse pool têm `cashback_multiplicador = 0` e não aparecem no picker.                    |
| Q6  | Multiplicador muda no banco depois → bilhetes vendidos? | **Snapshot na linha do bilhete** (`bilhetes.cashback_multiplicador_snapshot`)                                              | Direito do consumidor: bilhete vendido com 5× retém 5× mesmo se admin baixar pra 0 depois.                                                             |
| Q7  | Webhook idempotency                                     | **Sem tabela de log.** Sempre `GET /v1/payments/{id}` no MP (estado autoritativo) + UPDATE condicional `WHERE status <>`   | Update naturalmente idempotente. Tabela de audit pode ser adicionada se debugging exigir.                                                              |
| Q8  | Polling vs Realtime no client                           | **Polling 3s** via `GET /api/checkout/[id]/status` (CLAUDE.md §5 item 6 já decidiu)                                        | Menos infraestrutura; consistente com o resto do app.                                                                                                  |
| Q9  | Late payment (paga após `expira_em`)                    | **Honra** — webhook flipa pra `confirmado` mesmo após expiração                                                            | PIX é instantâneo; cenário extremamente raro. Sócios resolvem manualmente caso ocorra.                                                                 |
| Q10 | Public key MP no client?                                | **Não usar.** PIX-only, QR estático server-side                                                                            | Sem JS SDK do MP no client. Reduz superfície de ataque e não pede `MERCADOPAGO_PUBLIC_KEY`.                                                            |
| Q11 | Rate limit                                              | **5 chamadas/min por user_id**, validação via `SELECT count(*) FROM bilhetes WHERE user_id=$1 AND created_at > now()-1min` | Sem tabela nova. CLAUDE.md §6 exige rate limiting em endpoints de pagamento.                                                                           |
| Q12 | Layout do qty stepper                                   | **C — Stepper com barra de milestone** ("🎁 cashback liberado em 5")                                                       | Mockup `qty-picker.html` aprovado. Educa sobre o threshold sem ser intrusivo.                                                                          |
| Q13 | Layout do cashback picker                               | **A v3 — tier groups com callout dinâmico do retorno por tier**                                                            | Mockup `cashback-picker-v3.html` aprovado. 13 itens organizados em 4 tiers com fórmula concreta.                                                       |
| Q14 | Pós-confirmação                                         | **Toast verde + auto-redirect 1.5s pra `/palpites?bilhete=<id>`**                                                          | Sem tela de sucesso intermediária. Mockup `pix-qr-states.html` aprovado.                                                                               |

---

## 3. Arquitetura

### 3.1 Migration SQL

**Arquivo:** `supabase/migrations/<timestamp>_checkout_mercadopago.sql`

Migration única, transacional. Apply via `supabase db push`.

```sql
-- ============================================================================
-- Bolão Copa 2026 — Feature 6: Checkout + Mercado Pago
-- ============================================================================
-- Spec: docs/superpowers/specs/2026-04-30-checkout-mercadopago-design.md
--
-- 1. Renomeia bilhetes.asaas_payment_id → mp_payment_id (+index pra webhook)
-- 2. Atualiza protect_bilhete_payment_columns:
--    - referência à coluna nova (mp_payment_id)
--    - protege selecao_cashback_id (não pode mudar pós-pagamento)
--    - protege cashback_multiplicador_snapshot
-- 3. Drop trigger 20-slot + função + index parcial (sem limite de vagas)
-- 4. Adiciona selecoes.cashback_multiplicador (numeric(3,1), default 0)
-- 5. Seed das 13 elegíveis (1×/2×/3×/5×)
-- 6. Adiciona bilhetes.cashback_multiplicador_snapshot (numeric(3,1), default 0)
-- 7. Trigger enforce_cashback_eligibility: rejeita selecao com mult=0;
--    popula snapshot automaticamente em INSERT ou se selecao_cashback_id mudar
-- 8. View bilhetes_view com effective_status (lazy expiration)
-- ============================================================================

-- 1. Rename + index pra webhook lookup
ALTER TABLE bilhetes RENAME COLUMN asaas_payment_id TO mp_payment_id;

CREATE INDEX bilhetes_mp_payment_id_idx
  ON bilhetes(mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;

-- 2. Atualiza trigger de proteção de colunas (renomeia ref + adiciona 2 colunas)
CREATE OR REPLACE FUNCTION public.protect_bilhete_payment_columns() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.user_id                       IS DISTINCT FROM OLD.user_id
       OR NEW.numero_bilhete             IS DISTINCT FROM OLD.numero_bilhete
       OR NEW.status_pagamento           IS DISTINCT FROM OLD.status_pagamento
       OR NEW.mp_payment_id              IS DISTINCT FROM OLD.mp_payment_id
       OR NEW.valor_pago                 IS DISTINCT FROM OLD.valor_pago
       OR NEW.cashback_pago              IS DISTINCT FROM OLD.cashback_pago
       OR NEW.cashback_multiplicador_snapshot IS DISTINCT FROM OLD.cashback_multiplicador_snapshot
       OR NEW.selecao_cashback_id        IS DISTINCT FROM OLD.selecao_cashback_id
       OR NEW.pago_em                    IS DISTINCT FROM OLD.pago_em
       OR NEW.expira_em                  IS DISTINCT FROM OLD.expira_em
    THEN
      RAISE EXCEPTION 'Colunas de pagamento somente alteráveis via service_role'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Remove enforcement legado de 20 vagas
DROP TRIGGER IF EXISTS bilhetes_cashback_slot_trigger ON bilhetes;
DROP FUNCTION IF EXISTS public.enforce_cashback_slot_limit();
DROP INDEX IF EXISTS bilhetes_cashback_active_idx;

-- 4. Cashback multiplicador em selecoes
ALTER TABLE selecoes
  ADD COLUMN cashback_multiplicador numeric(3,1) NOT NULL DEFAULT 0
    CHECK (cashback_multiplicador IN (0, 1.0, 2.0, 3.0, 5.0));

-- 5. Seed dos 13 elegíveis (idempotente — UPDATEs por codigo_iso)
UPDATE selecoes SET cashback_multiplicador = 1.0 WHERE codigo_iso IN ('FRA','ESP','ENG');
UPDATE selecoes SET cashback_multiplicador = 2.0 WHERE codigo_iso IN ('BRA','ARG');
UPDATE selecoes SET cashback_multiplicador = 3.0 WHERE codigo_iso IN ('POR','GER','NED');
UPDATE selecoes SET cashback_multiplicador = 5.0 WHERE codigo_iso IN ('NOR','SUI','BEL','COL','URU');

-- 6. Snapshot do multiplicador na linha do bilhete (item Q6)
ALTER TABLE bilhetes
  ADD COLUMN cashback_multiplicador_snapshot numeric(3,1) NOT NULL DEFAULT 0
    CHECK (cashback_multiplicador_snapshot >= 0);

-- 7. Trigger: valida elegibilidade + popula snapshot automaticamente
CREATE OR REPLACE FUNCTION public.enforce_cashback_eligibility() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  mult numeric(3,1);
BEGIN
  IF NEW.selecao_cashback_id IS NULL THEN
    NEW.cashback_multiplicador_snapshot := 0;
    RETURN NEW;
  END IF;

  -- Re-snapshot apenas em INSERT ou quando selecao_cashback_id muda;
  -- preserva snapshot original em UPDATEs que não tocam selecao.
  IF TG_OP = 'INSERT'
     OR OLD.selecao_cashback_id IS DISTINCT FROM NEW.selecao_cashback_id THEN

    SELECT cashback_multiplicador INTO mult
    FROM public.selecoes
    WHERE id = NEW.selecao_cashback_id;

    IF mult IS NULL THEN
      RAISE EXCEPTION 'Seleção % não existe', NEW.selecao_cashback_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF mult <= 0 THEN
      RAISE EXCEPTION 'Seleção % não é elegível para cashback (multiplicador 0)',
        NEW.selecao_cashback_id
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.cashback_multiplicador_snapshot := mult;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bilhetes_cashback_eligibility_trigger
BEFORE INSERT OR UPDATE OF selecao_cashback_id ON bilhetes
FOR EACH ROW EXECUTE FUNCTION public.enforce_cashback_eligibility();

-- 8. View bilhetes_view com effective_status (lazy expiration — Q3)
CREATE OR REPLACE VIEW public.bilhetes_view
WITH (security_invoker = true) AS
SELECT
  b.*,
  CASE
    WHEN b.status_pagamento = 'pendente'
         AND b.expira_em IS NOT NULL
         AND b.expira_em < now()
    THEN 'expirado'::status_pagamento
    ELSE b.status_pagamento
  END AS effective_status
FROM public.bilhetes b;

GRANT SELECT ON public.bilhetes_view TO authenticated;
```

**Notas sobre a migration:**

- `security_invoker = true` na view é o oposto da view `ranking` (que é `false`). `bilhetes_view` herda a RLS de `bilhetes` — usuário só vê os próprios bilhetes pela view.
- O trigger atualizado de `protect_bilhete_payment_columns` é uma `CREATE OR REPLACE FUNCTION` — não precisa drop+create do TRIGGER em si.
- O CHECK em `cashback_multiplicador IN (0, 1.0, 2.0, 3.0, 5.0)` impede admin acidentalmente setar valores fora dos tiers documentados.
- O CHECK em `cashback_multiplicador_snapshot >= 0` é menos rígido (permite só `>= 0`) porque snapshot pode ter qualquer valor histórico se o pool mudar no futuro.

### 3.2 `lib/cashback.ts`

Lib pura. Sem I/O. Cobertura Vitest ≥ 95%.

```ts
/**
 * Cálculos de cashback. Lib pura — sem I/O, sem importação de Database.
 *
 * Spec: docs/superpowers/specs/2026-04-30-checkout-mercadopago-design.md §3.3
 * Regras: CLAUDE.md §3.3 (cashback diferenciado).
 */

/** Multiplicadores válidos do pool de 13 elegíveis + 0 pra fora-do-pool. */
export type CashbackMultiplicador = 0 | 1.0 | 2.0 | 3.0 | 5.0;

/** Threshold mínimo pra cashback ser ofertado. CLAUDE.md §3.3. */
export const CASHBACK_VALOR_MINIMO = 100.0 as const;

/** Lista hardcoded dos códigos ISO elegíveis por tier. Espelha o seed da migration. */
export const SELECOES_ELEGIVEIS = {
  1.0: ['FRA', 'ESP', 'ENG'] as const,
  2.0: ['BRA', 'ARG'] as const,
  3.0: ['POR', 'GER', 'NED'] as const,
  5.0: ['NOR', 'SUI', 'BEL', 'COL', 'URU'] as const,
} as const;

/**
 * Calcula o valor a devolver se a seleção do cashback for campeã.
 * Usa o snapshot armazenado no bilhete (não busca em selecoes).
 *
 * Retorna número arredondado a 2 casas decimais.
 *
 * @example
 *   calcularValorCashback(100, 5.0) === 500
 *   calcularValorCashback(80, 2.0) === 160
 *   calcularValorCashback(33.33, 3.0) === 99.99
 */
export function calcularValorCashback(
  valor_pago: number,
  multiplicador: CashbackMultiplicador,
): number {
  if (valor_pago < 0) {
    throw new Error('valor_pago não pode ser negativo');
  }
  return Math.round(valor_pago * multiplicador * 100) / 100;
}

/**
 * Verifica se um valor de compra qualifica para o cashback (>= R$100).
 */
export function elegivelCashback(valor_pago: number): boolean {
  return valor_pago >= CASHBACK_VALOR_MINIMO;
}

/**
 * Type guard pro multiplicador. Útil em validações vindas do banco
 * (numeric → number) onde TS não estreita o tipo automaticamente.
 */
export function isMultiplicadorValido(n: number): n is CashbackMultiplicador {
  return n === 0 || n === 1.0 || n === 2.0 || n === 3.0 || n === 5.0;
}
```

### 3.3 `lib/checkout.ts`

Lib pura. Mapeadores e construtor de payload MP.

```ts
/**
 * Mapeadores entre o domínio do bolão e a API do Mercado Pago.
 * Lib pura — sem I/O.
 *
 * Spec: docs/superpowers/specs/2026-04-30-checkout-mercadopago-design.md §3.3
 */

import type { Database } from '@/lib/supabase/types';

type StatusPagamento = Database['public']['Enums']['status_pagamento'];

/** Payload aceito pelo POST /v1/payments do MP pra PIX. */
export type MPPaymentPayload = {
  transaction_amount: number;
  description: string;
  payment_method_id: 'pix';
  payer: { email: string; first_name?: string };
  external_reference: string; // bilhete_principal_id (uuid)
  date_of_expiration: string; // ISO 8601 com timezone
  notification_url?: string; // opcional; preferimos painel global
};

/**
 * Constrói payload de criação de pagamento PIX.
 * `qty * 20` em reais. `external_reference` é o ID do bilhete principal,
 * o que permite ao webhook localizar a linha autoritativa rapidamente.
 *
 * @example
 *   montarPayloadMP({ qty: 5, user_email: 'a@b.com', user_name: 'João',
 *                    bilhete_principal_id: 'uuid', expira_em: '2026-04-30T...' })
 */
export function montarPayloadMP(args: {
  qty: number;
  user_email: string;
  user_name?: string;
  bilhete_principal_id: string;
  expira_em: string; // ISO 8601
}): MPPaymentPayload {
  if (args.qty < 1 || args.qty > 50) {
    throw new Error('qty deve estar entre 1 e 50');
  }
  return {
    transaction_amount: args.qty * 20,
    description: `Bolão Copa 2026 — ${args.qty} ${args.qty === 1 ? 'tabela' : 'tabelas'}`,
    payment_method_id: 'pix',
    payer: {
      email: args.user_email,
      ...(args.user_name ? { first_name: args.user_name } : {}),
    },
    external_reference: args.bilhete_principal_id,
    date_of_expiration: args.expira_em,
  };
}

/**
 * Mapeia status do MP pro nosso enum status_pagamento.
 *
 * MP status canônicos pra PIX:
 *   - pending / in_process → pendente
 *   - approved → confirmado
 *   - cancelled → cancelado
 *   - rejected → cancelado (motivo no status_detail)
 *   - refunded / charged_back → cancelado (refund é fora do escopo F6;
 *     marca como cancelado e admin lida)
 *
 * Lança em status desconhecido (fail-closed) — webhook handler captura
 * e responde 200 com warning log (MP retry não ajuda em status novo).
 */
export function mapearStatusMP(mp_status: string, _mp_status_detail: string): StatusPagamento {
  switch (mp_status) {
    case 'pending':
    case 'in_process':
    case 'in_mediation':
    case 'authorized':
      return 'pendente';
    case 'approved':
      return 'confirmado';
    case 'cancelled':
    case 'rejected':
    case 'refunded':
    case 'charged_back':
      return 'cancelado';
    default:
      throw new Error(`Status MP desconhecido: ${mp_status}`);
  }
}
```

### 3.4 `lib/mercadopago.ts` — pure (signature validation + types)

Lib pura. Server-only por convenção (importa `node:crypto`). Cobertura ≥ 95%.

```ts
import 'server-only';
import crypto from 'node:crypto';

/** Resposta normalizada do MP pro nosso domínio. Usada também por `lib/mercadopago.io.ts`. */
export type MPPaymentResponse = {
  id: string;
  status: string; // raw MP status
  status_detail: string; // raw MP status_detail
  transaction_amount: number;
  date_approved: string | null;
  date_of_expiration: string;
  qr_code: string; // BR Code (copia-cola)
  qr_code_base64: string; // PNG base64
};

/**
 * Valida assinatura HMAC-SHA256 enviada pelo MP em `x-signature`.
 *
 * Header format: `ts=<unix_ts>,v1=<hmac_hex>`
 * Template assinado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 *
 * Lib pura: recebe headers + secret, retorna boolean. Testável com fixtures.
 */
export function validarAssinaturaWebhook(args: {
  x_signature: string;
  x_request_id: string;
  data_id: string;
  secret: string;
}): boolean {
  try {
    const { x_signature, x_request_id, data_id, secret } = args;
    const parts = x_signature.split(',').reduce<Record<string, string>>((acc, kv) => {
      const [k, v] = kv.split('=').map((s) => s.trim());
      if (k && v) acc[k] = v;
      return acc;
    }, {});
    const ts = parts.ts;
    const v1 = parts.v1;
    if (!ts || !v1) return false;

    const template = `id:${data_id};request-id:${x_request_id};ts:${ts};`;
    const expected = crypto.createHmac('sha256', secret).update(template).digest('hex');

    // timing-safe compare
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(v1, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
```

### 3.5 `lib/mercadopago.io.ts` — IO sobre o SDK oficial

Chamadas de rede pro MP. Server-only. **Excluído do coverage** (rede; confiança vem do E2E manual em sandbox).

**Nova dependência:** `mercadopago@^2.x.x` em `package.json`.

```ts
import 'server-only';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { serverEnv } from '@/lib/env-server';
import type { MPPaymentResponse } from './mercadopago';
import type { MPPaymentPayload } from './checkout';

const client = new MercadoPagoConfig({ accessToken: serverEnv.MERCADOPAGO_ACCESS_TOKEN });
const payment = new Payment(client);

/**
 * Cria pagamento PIX via SDK oficial.
 * Lança em qualquer falha (rede, 4xx, 5xx) — caller decide o que fazer.
 */
export async function criarPagamentoPIX(payload: MPPaymentPayload): Promise<MPPaymentResponse> {
  const result = await payment.create({ body: payload });
  return normalize(result);
}

/**
 * Consulta estado autoritativo de um pagamento. Usado no webhook handler
 * pra evitar confiar no payload da notificação.
 */
export async function consultarPagamento(payment_id: string): Promise<MPPaymentResponse> {
  const result = await payment.get({ id: payment_id });
  return normalize(result);
}

function normalize(r: any): MPPaymentResponse {
  // Path do QR pra PIX: r.point_of_interaction.transaction_data.{qr_code, qr_code_base64}
  // Documentado em https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
  return {
    id: String(r.id ?? throwIfMissing('id')),
    status: r.status ?? throwIfMissing('status'),
    status_detail: r.status_detail ?? '',
    transaction_amount: r.transaction_amount ?? throwIfMissing('transaction_amount'),
    date_approved: r.date_approved ?? null,
    date_of_expiration: r.date_of_expiration ?? throwIfMissing('date_of_expiration'),
    qr_code: r.point_of_interaction?.transaction_data?.qr_code ?? '',
    qr_code_base64: r.point_of_interaction?.transaction_data?.qr_code_base64 ?? '',
  };
}

function throwIfMissing(field: string): never {
  throw new Error(`Resposta MP sem campo obrigatório: ${field}`);
}
```

> **Verificação em runtime:** os campos do SDK MP (`r.point_of_interaction.transaction_data.qr_code` etc.) precisam ser confirmados durante a implementação contra a resposta real do sandbox. Se shape diferir, ajustar `normalize` — não há mudança de design, só de mapping. `qr_code` / `qr_code_base64` aceitam string vazia em `consultarPagamento` porque post-payment o MP pode não retornar o QR de novo.

### 3.6 `lib/env-server.ts` — delta

Adiciona 2 vars MP. Schema vira:

```ts
import 'server-only';
import { z } from 'zod';

const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MERCADOPAGO_ACCESS_TOKEN: z.string().min(1),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(1),
});

const parsed = schema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN,
  MERCADOPAGO_WEBHOOK_SECRET: process.env.MERCADOPAGO_WEBHOOK_SECRET,
});

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error('❌ Invalid server environment variables:', fieldErrors);
  throw new Error(
    `Invalid server environment variables: ${JSON.stringify(fieldErrors)}. Check .env.local against .env.local.example.`,
  );
}

export const serverEnv = parsed.data;
```

### 3.7 `.env.local.example` — conteúdo final

Já atualizado nesta sessão de brainstorm. Conteúdo completo:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxxxxxx

# Mercado Pago (Feature 6)
# Sandbox: TEST-... · Produção: APP_USR-...
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxxxxx
# Painel MP → Suas integrações → Notificações → Webhooks → "Assinatura secreta"
MERCADOPAGO_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# API-Football (preencher na feature 12)
API_FOOTBALL_KEY=

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.local` (gitignored) tem os valores TEST reais já populados.

### 3.8 `vitest.config.mts` — delta

Expandir `coverage.include` pra cobrir novas libs puras. Threshold ≥ 95% mantido (igual F5).

```ts
coverage: {
  provider: 'v8',
  include: [
    'lib/pontuacao.ts',
    'lib/cashback.ts',
    'lib/checkout.ts',
    'lib/mercadopago.ts',     // pure: validarAssinaturaWebhook + types
    // lib/mercadopago.io.ts intencionalmente FORA — rede, coberto por E2E manual
  ],
  thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
},
```

### 3.9 `app/(dashboard)/comprar/actions.ts` — Server Action

```ts
'use server';

import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { criarPagamentoPIX } from '@/lib/mercadopago.io';
import { montarPayloadMP } from '@/lib/checkout';
import { elegivelCashback } from '@/lib/cashback';

const schema = z.object({
  qty: z.number().int().min(1).max(50),
  selecao_cashback_id: z.number().int().positive().nullable(),
});

export type CriarCheckoutResult =
  | {
      ok: true;
      bilhete_principal_id: string;
      qr_code: string;
      qr_code_base64: string;
      expira_em: string;
      valor_total: number;
    }
  | {
      ok: false;
      error:
        | 'unauthenticated'
        | 'validation'
        | 'rate_limit'
        | 'cashback_min_value'
        | 'cashback_inelegivel'
        | 'mp_failure'
        | 'unknown';
      mensagem: string;
    };

export async function criarCheckout(input: unknown): Promise<CriarCheckoutResult> {
  // 1. Auth
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthenticated', mensagem: 'Faça login pra continuar.' };

  // 2. Validação Zod
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'validation', mensagem: 'Dados inválidos.' };
  }
  const { qty, selecao_cashback_id } = parsed.data;
  const valor_total = qty * 20;

  // 3. Rate limit (5 chamadas/min do mesmo user)
  const { count } = await supabase
    .from('bilhetes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString());

  if ((count ?? 0) >= 5) {
    return { ok: false, error: 'rate_limit', mensagem: 'Espera 1 minuto pra tentar de novo.' };
  }

  // 4. Validação cashback (cliente também valida, mas aqui é a barreira)
  if (selecao_cashback_id !== null && !elegivelCashback(valor_total)) {
    return { ok: false, error: 'cashback_min_value', mensagem: 'Cashback exige R$ 100 ou mais.' };
  }

  // 5. TX1 — INSERT N bilhetes (admin client bypassa RLS + protect trigger)
  const admin = createSupabaseAdminClient();
  const expira_provisional = new Date(Date.now() + 30 * 60_000).toISOString();
  const rows = Array.from({ length: qty }, (_, i) => ({
    user_id: user.id,
    valor_pago: i === 0 ? valor_total : 0,
    selecao_cashback_id: i === 0 ? selecao_cashback_id : null,
    expira_em: expira_provisional,
    status_pagamento: 'pendente' as const,
  }));

  const { data: inserted, error: insErr } = await admin
    .from('bilhetes')
    .insert(rows)
    .select('id, numero_bilhete, selecao_cashback_id');

  if (insErr || !inserted) {
    // Detecta exceção do trigger enforce_cashback_eligibility
    if (insErr?.message?.includes('não é elegível para cashback')) {
      return { ok: false, error: 'cashback_inelegivel', mensagem: 'Essa seleção não dá cashback.' };
    }
    return { ok: false, error: 'unknown', mensagem: 'Erro ao criar bilhetes.' };
  }

  const principal = inserted[0];
  const profile = await supabase.from('profiles').select('email, nome').eq('id', user.id).single();

  // 6. Chama MP
  let mp;
  try {
    mp = await criarPagamentoPIX(
      montarPayloadMP({
        qty,
        user_email: profile.data?.email ?? user.email!,
        user_name: profile.data?.nome ?? undefined,
        bilhete_principal_id: principal.id,
        expira_em: expira_provisional,
      }),
    );
  } catch (e) {
    // TX2 compensação — marca todos como cancelado
    await admin
      .from('bilhetes')
      .update({ status_pagamento: 'cancelado' })
      .in(
        'id',
        inserted.map((r) => r.id),
      );
    return { ok: false, error: 'mp_failure', mensagem: 'Falha no Mercado Pago. Tenta de novo.' };
  }

  // 7. TX2 — UPDATE com mp_payment_id e expira_em real
  const { error: updErr } = await admin
    .from('bilhetes')
    .update({ mp_payment_id: mp.id, expira_em: mp.date_of_expiration })
    .in(
      'id',
      inserted.map((r) => r.id),
    );

  if (updErr) {
    // Bilhetes pendentes ficam até effective_status virar expirado.
    // Logar e retornar sucesso parcial (QR já existe).
    console.error('TX2 update falhou', { err: updErr, mp_id: mp.id });
  }

  return {
    ok: true,
    bilhete_principal_id: principal.id,
    qr_code: mp.qr_code,
    qr_code_base64: mp.qr_code_base64,
    expira_em: mp.date_of_expiration,
    valor_total,
  };
}
```

### 3.10 `app/api/checkout/[id]/status/route.ts` — Polling

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  // RLS garante que só vê os próprios bilhetes
  const { data, error } = await supabase
    .from('bilhetes_view')
    .select('id, effective_status, expira_em, mp_payment_id')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    status: data.effective_status,
    expira_em: data.expira_em,
  });
}
```

### 3.11 `app/api/webhooks/mercadopago/route.ts` — Webhook

```ts
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { consultarPagamento } from '@/lib/mercadopago.io';
import { validarAssinaturaWebhook } from '@/lib/mercadopago';
import { mapearStatusMP } from '@/lib/checkout';
import { serverEnv } from '@/lib/env-server';

export async function POST(req: Request) {
  // 1. Read raw body + headers pra HMAC
  const raw = await req.text();
  const x_signature = req.headers.get('x-signature') ?? '';
  const x_request_id = req.headers.get('x-request-id') ?? '';

  let body: { action?: string; data?: { id?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }

  const data_id = body.data?.id;
  if (!data_id) return new Response(null, { status: 400 });

  // 2. Validar HMAC
  const ok = validarAssinaturaWebhook({
    x_signature,
    x_request_id,
    data_id,
    secret: serverEnv.MERCADOPAGO_WEBHOOK_SECRET,
  });
  if (!ok) {
    console.warn('Webhook MP: assinatura inválida', { data_id, x_request_id });
    return new Response(null, { status: 401 });
  }

  // 3. GET autoritativo
  let mp;
  try {
    mp = await consultarPagamento(data_id);
  } catch (e) {
    console.error('Webhook MP: consulta falhou', { data_id, err: e });
    return new Response(null, { status: 502 }); // MP retry
  }

  // 4. Mapear status
  let status;
  try {
    status = mapearStatusMP(mp.status, mp.status_detail);
  } catch (e) {
    console.warn('Webhook MP: status desconhecido — ignorando', {
      mp_id: data_id,
      status: mp.status,
    });
    return new Response(null, { status: 200 }); // 200 pra MP não retentar
  }

  // 5. UPDATE idempotente (apenas se status muda)
  const admin = createSupabaseAdminClient();
  const updates: { status_pagamento: typeof status; pago_em?: string } = {
    status_pagamento: status,
  };
  if (status === 'confirmado') {
    updates.pago_em = mp.date_approved ?? new Date().toISOString();
  }

  const { error } = await admin
    .from('bilhetes')
    .update(updates)
    .eq('mp_payment_id', data_id)
    .neq('status_pagamento', status);

  if (error) {
    console.error('Webhook MP: update falhou', { data_id, err: error });
    return new Response(null, { status: 500 }); // MP retry
  }

  return new Response(null, { status: 200 });
}
```

### 3.12 UI Components

Componentes em `components/checkout/`. Props/state shapes contratuais — JSX vai detalhar no plan.

#### `components/checkout/Stepper.tsx`

Variante C (mockup `qty-picker.html`). Client component.

```ts
type StepperProps = {
  qty: number;
  onChange: (qty: number) => void;
  min?: number; // default 1
  max?: number; // default 50
  milestone?: number; // default 5 (cashback unlock)
};
```

Renderiza: − N + (botões com handlers) · barra de milestone com tick em `milestone` · texto "🔒 +X tabelas pra liberar cashback" quando `qty < milestone`, ou "🎁 Cashback liberado!" quando `qty >= milestone`.

#### `components/checkout/CashbackPicker.tsx`

Variante A v3 (mockup `cashback-picker-v3.html`). Client component.

```ts
type SelecaoElegivel = {
  id: number;
  nome: string;
  codigo_iso: string;
  bandeira_emoji: string;
  cashback_multiplicador: 1.0 | 2.0 | 3.0 | 5.0;
};

type CashbackPickerProps = {
  selecoes: SelecaoElegivel[]; // já filtradas (mult > 0) e ordenadas (mult DESC, nome ASC)
  selectedId: number | null;
  onChange: (selecao_cashback_id: number | null) => void;
  valor_pago: number; // pra render dinâmico do callout
};
```

Renderiza: 4 tier groups (5×, 3×, 2×, 1×), cada um com:

- Cabeçalho `5× — AZARÕES` / `3× — TIME B` / etc.
- Callout colorido com `R$ {valor_pago} × {mult}× = R$ {calcularValorCashback(valor_pago, mult)}`
- Lista de flag-rows (selectable; selected → border amarela + badge SUA)

#### `components/checkout/FormulaCheckout.tsx`

Wrapper. Client component. Estado central:

```ts
type State = {
  qty: number; // default 1
  selecao_cashback_id: number | null; // null se qty*20 < 100
};
```

Renderiza: `<Stepper>` no topo, `<CashbackPicker>` (gated por `state.qty * 20 >= 100`, com fade-in/out), card de resumo, botão "Pagar R$ {valor_total} via PIX".

Submit: chama `criarCheckout(state)`. Em sucesso, `router.push(\`/comprar/${result.bilhete_principal_id}/pix\`)`. Em falha, `toast.error(result.mensagem)`.

#### `components/checkout/TelaPIX.tsx`

Client component. Recebe estado inicial do Server Component. Polling 3s.

```ts
type TelaPIXProps = {
  bilheteId: string;
  qrCode: string;
  qrCodeBase64: string; // PNG base64
  expiraEm: string; // ISO 8601
  valorTotal: number;
  resumo: { qty: number; cashback?: { selecao: string; multiplicador: number; bandeira: string } };
};
```

Estado interno:

```ts
type Status = 'pendente' | 'confirmado' | 'expirado' | 'cancelado';
type State = { status: Status; secondsLeft: number };
```

Comportamento:

- `useEffect` inicia 2 timers: countdown 1s + polling 3s (`fetch('/api/checkout/{id}/status')`).
- Polling atualiza `state.status`. `confirmado` → `toast.success` + `setTimeout(1500, () => router.push('/palpites?bilhete=' + id))`. `expirado` ou `cancelado` → renderiza tela de retry.
- Countdown: quando atinge 0, força um poll extra. Não renderiza "expirado" sozinho.
- Botão "Copiar código PIX": `navigator.clipboard.writeText(qrCode)` + `toast.success('Copiado!')`.
- Botão "Gerar novo PIX" (no estado expirado): `router.push(\`/comprar?qty=${resumo.qty}&cashback=${...}\`)`.

### 3.13 Pages

#### `app/(dashboard)/comprar/page.tsx` — Server Component

```ts
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FormulaCheckout } from '@/components/checkout/FormulaCheckout';

export const dynamic = 'force-dynamic';

export default async function ComprarPage({ searchParams }: { searchParams: { qty?: string; cashback?: string } }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/comprar');

  const { data: selecoes } = await supabase
    .from('selecoes')
    .select('id, nome, codigo_iso, bandeira_emoji, cashback_multiplicador')
    .gt('cashback_multiplicador', 0)
    .order('cashback_multiplicador', { ascending: false })
    .order('nome');

  // Pré-fill via querystring (vindo do retry de "Gerar novo PIX")
  const qtyInicial = Math.min(50, Math.max(1, Number(searchParams.qty) || 1));
  const cashbackInicial = searchParams.cashback ? Number(searchParams.cashback) : null;

  return (
    <FormulaCheckout
      selecoes={selecoes ?? []}
      qtyInicial={qtyInicial}
      cashbackInicial={cashbackInicial}
    />
  );
}
```

#### `app/(dashboard)/comprar/[id]/pix/page.tsx` — Server Component

```ts
import { redirect, notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TelaPIX } from '@/components/checkout/TelaPIX';

export const dynamic = 'force-dynamic';

export default async function PIXPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();

  const { data: bilhete } = await supabase
    .from('bilhetes_view')
    .select(`
      id, effective_status, expira_em, valor_pago, mp_payment_id,
      selecao_cashback_id,
      selecoes:selecao_cashback_id(nome, bandeira_emoji, cashback_multiplicador)
    `)
    .eq('id', params.id)
    .maybeSingle();

  if (!bilhete) notFound();
  if (bilhete.effective_status === 'confirmado') {
    redirect(`/palpites?bilhete=${bilhete.id}`);
  }
  if (bilhete.effective_status !== 'pendente') {
    redirect('/comprar');
  }

  // mp_payment_id obrigatório nesse ponto (TX2 já rodou); se não, MP falhou
  if (!bilhete.mp_payment_id) {
    redirect('/comprar');
  }

  // qty derivada das linhas com mesmo mp_payment_id (já que valor_pago=0 nas N-1)
  const { count: qty } = await supabase
    .from('bilhetes')
    .select('id', { count: 'exact', head: true })
    .eq('mp_payment_id', bilhete.mp_payment_id);

  // QR re-fetch via SDK MP (não persistimos no banco) — server-side, em paralelo
  const { consultarPagamento } = await import('@/lib/mercadopago.io');
  const mp = await consultarPagamento(bilhete.mp_payment_id);

  return (
    <TelaPIX
      bilheteId={bilhete.id}
      qrCode={mp.qr_code}
      qrCodeBase64={mp.qr_code_base64}
      expiraEm={bilhete.expira_em!}
      valorTotal={Number(bilhete.valor_pago)}
      resumo={{
        qty: qty ?? 1,
        cashback: bilhete.selecoes
          ? {
              selecao: bilhete.selecoes.nome,
              multiplicador: Number(bilhete.selecoes.cashback_multiplicador),
              bandeira: bilhete.selecoes.bandeira_emoji,
            }
          : undefined,
      }}
    />
  );
}
```

> **Nota:** o QR é re-buscado no MP em vez de persistido. Vantagem: zero risco de QR desatualizado. Custo: 1 chamada MP no page load. Aceitável (page load == "já vou pagar agora", não acontece com frequência).

### 3.14 Landing CTA

`app/(public)/page.tsx` ou seus componentes — substituir `href="#"` dos CTAs `Comprar minha tabela →` e `Garantir meu cashback →` por `href="/comprar"`.

---

## 4. Plano de commits (sequência reviewable)

| #   | Mensagem                                                                           | Conteúdo                                                                                                   |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | `chore(env): add MERCADOPAGO_* env vars + .example`                                | `.env.local`, `.env.local.example`, `lib/env-server.ts` schema com 2 vars novas                            |
| 2   | `chore: add mercadopago dependency`                                                | `pnpm add mercadopago@^2.x.x`                                                                              |
| 3   | `feat(db): F6 migration (mp_payment_id rename + cashback tiers + view + triggers)` | `supabase/migrations/<timestamp>_checkout_mercadopago.sql` — migration única com todos os 8 passos do §3.1 |
| 4   | `chore(db): regenerate Supabase types`                                             | `pnpm supabase:types` → `lib/supabase/types.ts`                                                            |
| 5   | `feat(checkout): lib/cashback.ts + tests`                                          | `lib/cashback.ts` + `lib/__tests__/cashback.test.ts` (≥ 95%)                                               |
| 6   | `feat(checkout): lib/checkout.ts (mappers MP↔domínio) + tests`                     | `lib/checkout.ts` + `lib/__tests__/checkout.test.ts` (≥ 95%)                                               |
| 7   | `feat(checkout): lib/mercadopago.ts (signature validation) + tests`                | `lib/mercadopago.ts` + tests; vitest config inclui no coverage                                             |
| 8   | `feat(checkout): lib/mercadopago.io.ts (SDK calls)`                                | `lib/mercadopago.io.ts` (criar/consultar — excluído da cobertura)                                          |
| 9   | `feat(checkout): server action criarCheckout`                                      | `app/(dashboard)/comprar/actions.ts`                                                                       |
| 10  | `feat(checkout): GET /api/checkout/[id]/status (polling)`                          | `app/api/checkout/[id]/status/route.ts`                                                                    |
| 11  | `feat(checkout): POST /api/webhooks/mercadopago (idempotent)`                      | `app/api/webhooks/mercadopago/route.ts`                                                                    |
| 12  | `feat(checkout): UI components Stepper, CashbackPicker, FormulaCheckout`           | `components/checkout/{Stepper,CashbackPicker,FormulaCheckout}.tsx`                                         |
| 13  | `feat(checkout): UI component TelaPIX`                                             | `components/checkout/TelaPIX.tsx`                                                                          |
| 14  | `feat(checkout): /comprar e /comprar/[id]/pix pages`                               | `app/(dashboard)/comprar/page.tsx` + `app/(dashboard)/comprar/[id]/pix/page.tsx`                           |
| 15  | `chore(landing): linka CTA "Comprar minha tabela →" pra /comprar`                  | edit em `app/(public)/page.tsx` (ou componentes equivalentes)                                              |

---

## 5. Critério de pronto da feature

- [ ] Migrations aplicam em cloud dev sem erro (`supabase db push`); `pnpm supabase:types` regenera com `cashback_multiplicador` e `cashback_multiplicador_snapshot`.
- [ ] `pnpm typecheck` zero erros (com tipos atualizados).
- [ ] `pnpm lint && pnpm format:check` clean.
- [ ] `pnpm test:run` passa, **cobertura ≥ 95%** em `lib/cashback.ts`, `lib/checkout.ts`, `lib/mercadopago.ts` (signature only), `lib/pontuacao.ts` (já existente).
- [ ] Smoke counts (Supabase Studio):
  - `SELECT COUNT(*) FROM selecoes WHERE cashback_multiplicador > 0` → 13
  - `SELECT codigo_iso FROM selecoes WHERE cashback_multiplicador = 5.0 ORDER BY codigo_iso` → BEL, COL, NOR, SUI, URU
  - `SELECT codigo_iso FROM selecoes WHERE cashback_multiplicador = 3.0 ORDER BY codigo_iso` → GER, NED, POR
  - `SELECT codigo_iso FROM selecoes WHERE cashback_multiplicador = 2.0 ORDER BY codigo_iso` → ARG, BRA
  - `SELECT codigo_iso FROM selecoes WHERE cashback_multiplicador = 1.0 ORDER BY codigo_iso` → ENG, ESP, FRA
- [ ] Trigger smokes (Studio, conexão authenticated):
  - INSERT em `bilhetes` com `selecao_cashback_id` apontando pra Haiti (mult=0) → erro `'check_violation'`.
  - INSERT em `bilhetes` com `selecao_cashback_id=Brasil` → snapshot setado pra `2.0` automaticamente.
  - UPDATE em `bilhetes.selecao_cashback_id` por user (sem service_role) → erro do `protect_bilhete_payment_columns` (`insufficient_privilege`).
  - SELECT em `bilhetes_view` com bilhete `pendente` cujo `expira_em < now()` → `effective_status = 'expirado'`.
- [ ] Trigger antigo `bilhetes_cashback_slot_trigger` foi removido; função `enforce_cashback_slot_limit()` foi deletada (verificar via `\df` no Studio).
- [ ] **E2E manual em sandbox MP** (todos passam):
  1. Compra 1 tabela R$ 20 (sem cashback) — vê QR, paga via app sandbox MP, vê toast verde + redirect.
  2. Compra 5 tabelas R$ 100 + cashback Brasil (2×) — `cashback_multiplicador_snapshot=2.0` confirmado no DB; redirect ok.
  3. Tenta cashback em seleção inelegível (Haiti) — UI bloqueia (não aparece no picker); via API direta retorna `cashback_inelegivel`.
  4. Tenta cashback com `qty=4` (R$ 80) — server retorna `cashback_min_value`.
  5. Cria QR e deixa expirar 30min — `effective_status='expirado'`; "Gerar novo PIX" pré-preenche `/comprar?qty=...&cashback=...`.
  6. Webhook duplicado (envia 2× via `mcp__mercadopago__notifications_history` → reenvia) — UPDATE idempotente, sem dupla atualização (verificar logs).
  7. Webhook com signature inválida — 401 retornado; bilhete não muda.
  8. 6 chamadas em 1 min do mesmo user — sexta retorna `rate_limit`.
- [ ] `git log --oneline` mostra os 15 commits temáticos da seção 4.

---

## 6. Steps manuais que o desenvolvedor executa

1. **Aplicar migrations e regenerar types:**

   ```bash
   supabase db push
   pnpm supabase:types
   ```

2. **Cadastrar webhook no painel MP (sandbox):**
   - https://www.mercadopago.com.br/developers → Suas integrações → app sandbox.
   - Notificações → Webhooks → URL: `https://malanacopa.com.br/api/webhooks/mercadopago` (ou ngrok URL local pra dev).
   - Eventos: marcar **Pagamentos**.
   - Copiar a `Assinatura secreta` gerada pelo painel → confirmar que bate com `MERCADOPAGO_WEBHOOK_SECRET` em `.env.local`.

3. **Smoke E2E em sandbox** (cenários 1-8 da seção 5).

4. **Antes de produção (fora do escopo F6):**
   - Trocar `MERCADOPAGO_ACCESS_TOKEN` pra `APP_USR-...` (prod).
   - Rotacionar `MERCADOPAGO_WEBHOOK_SECRET` (cadastrar novo webhook em prod).
   - Rotacionar `SUPABASE_SERVICE_ROLE_KEY` se ainda não foi (CLAUDE.md F2 §7 mencionou).

---

## 7. Riscos e pontos de atenção

- **Public key MP comentada em `.env.local`** (não usada no fluxo PIX-only). Se F6 expandir pra Card Brick / Status Brick rodando no client, descomentar e adicionar `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` ao schema público de env.
- **Race condition cashback (sem 20-slot, baixíssimo risco):** dois bilhetes simultâneos com mesma seleção 5× passam ambos. Sem limite, isso é desejado. Se admin desabilitar a seleção (`cashback_multiplicador=0`) em tempo real, bilhetes em flight (TX1 já rodou) ainda recebem o snapshot anterior — proteção de consumidor funciona.
- **MP failure após TX1:** server action faz TX2 de compensação (`cancelado`). Se TX2 falhar (DB indisponível), bilhetes ficam `pendente` com `expira_em` provisional → viram `expirado` em 30min via `effective_status`. Sem `mp_payment_id`, webhook nunca acha — silenciosamente caem.
- **Webhook race:** MP pode mandar webhook em `<200ms` da resposta de criação, antes da TX2 commitar. Webhook acha 0 linhas com `mp_payment_id=X` → `UPDATE` faz no-op → MP retentar até bater. Cenário benigno; PIX é instantâneo então retry vence.
- **Late payment honored:** webhook flipa para `confirmado` mesmo se `expira_em < now()`. Gera bilhete válido sem competidor de cashback. Aceito.
- **Late payment refund:** se sócios decidirem rejeitar pagamento tardio, faz refund manualmente via painel MP. F6 não automatiza refund.
- **Performance:** `bilhetes_view` é um wrapper barato sobre `bilhetes` (apenas um `CASE`). Sem custo perceptível.
- **Coverage `criarPagamentoPIX` / `consultarPagamento`:** excluídos da cobertura (rede). A confiança vem do E2E manual no sandbox.
- **Shape do response do SDK MP:** os campos exatos (`point_of_interaction.transaction_data.qr_code` etc.) precisam ser confirmados na implementação rodando contra sandbox real. Se diferir, ajustar mapping em `lib/mercadopago.io.ts` — sem mudança de design.
- **Volume:** 500-2000 tabelas projetadas (CLAUDE.md §1). Cada tabela = 1 bilhete; bilhetes pendentes acumulam até virarem expirados. Sem cron de limpeza, em ~2.000 bilhetes de pico × razão pendente:confirmado de ~5% = ~100 linhas pendente-stale. Negligível.
- **Domínio prod:** `https://malanacopa.com.br` cadastrado pra webhooks. Em dev local, usar tunneling (ngrok / vercel dev tunnel) e cadastrar URL temporária no painel sandbox separadamente — anotado em memory `reference_mercadopago_setup.md`.

---

## 8. O que NÃO está aqui (escopo)

- Auto-refund via API MP em caso de race condition ou cancelamento — feito manualmente via painel até F11.
- Pagamento real do cashback ao usuário quando ele acerta o campeão — Feature 11 (admin payouts).
- Painel admin de exposição de cashback (`SUM(valor_pago) × multiplicador` por seleção) — Feature 11.
- Cron de limpeza de bilhetes pendentes expirados — feature posterior se hygiene virar problema.
- Notificação por WhatsApp (pagamento confirmado, expirado) — Feature 13.
- Tela de palpites — Feature 7.
- Tabela de log de webhooks pra audit — adicionada se debugging exigir.
- Card Brick / Status Brick rodando no client — não previsto.
- Cobertura de tests pras chamadas de rede MP (`criarPagamentoPIX`, `consultarPagamento`) — vão pro `lib/mercadopago.io.ts` excluído do coverage; confiança vem do E2E manual.
- Suporte a outros métodos de pagamento (cartão, boleto) — F6 é PIX-only.
- Multi-tenant / múltiplos bolões num mesmo schema — out of scope.
