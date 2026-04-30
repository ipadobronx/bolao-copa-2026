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
  external_reference: string;
  date_of_expiration: string;
};

/**
 * Constrói payload de criação de pagamento PIX.
 * `qty * 20` em reais. `external_reference` é o ID do bilhete principal,
 * o que permite ao webhook localizar a linha autoritativa rapidamente.
 */
export function montarPayloadMP(args: {
  qty: number;
  user_email: string;
  user_name?: string;
  bilhete_principal_id: string;
  expira_em: string;
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
