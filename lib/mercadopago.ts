import 'server-only';
import crypto from 'node:crypto';

/** Resposta normalizada do MP pro nosso domínio. Usada também por `lib/mercadopago.io.ts`. */
export type MPPaymentResponse = {
  id: string;
  status: string;
  status_detail: string;
  transaction_amount: number;
  date_approved: string | null;
  date_of_expiration: string;
  qr_code: string;
  qr_code_base64: string;
};

/**
 * Valida assinatura HMAC-SHA256 enviada pelo MP em `x-signature`.
 *
 * Header format: `ts=<unix_ts>,v1=<hmac_hex>`
 * Template assinado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
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

    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(v1, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
