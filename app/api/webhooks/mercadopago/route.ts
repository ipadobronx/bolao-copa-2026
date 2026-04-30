import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { consultarPagamento } from '@/lib/mercadopago.io';
import { validarAssinaturaWebhook } from '@/lib/mercadopago';
import { mapearStatusMP } from '@/lib/checkout';
import { serverEnv } from '@/lib/env-server';

export async function POST(req: Request) {
  // 1. Read raw body + headers
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
    return new Response(null, { status: 502 });
  }

  // 4. Mapear status
  let status;
  try {
    status = mapearStatusMP(mp.status, mp.status_detail);
  } catch {
    console.warn('Webhook MP: status desconhecido — ignorando', {
      mp_id: data_id,
      status: mp.status,
    });
    return new Response(null, { status: 200 });
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
    return new Response(null, { status: 500 });
  }

  return new Response(null, { status: 200 });
}
