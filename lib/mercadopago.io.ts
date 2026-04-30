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

/** Consulta estado autoritativo de um pagamento. */
export async function consultarPagamento(payment_id: string): Promise<MPPaymentResponse> {
  const result = await payment.get({ id: payment_id });
  return normalize(result);
}

// MP SDK retorna PaymentResponse. Validamos em runtime os campos críticos
// — usamos `any` aqui pra evitar acoplar fortemente com a tipagem volátil do SDK.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(r: any): MPPaymentResponse {
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
