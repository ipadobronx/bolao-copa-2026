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
  if (!user) {
    return { ok: false, error: 'unauthenticated', mensagem: 'Faça login pra continuar.' };
  }

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

  // 4. Validação cashback (cliente também valida; aqui é a barreira)
  if (selecao_cashback_id !== null && !elegivelCashback(valor_total)) {
    return {
      ok: false,
      error: 'cashback_min_value',
      mensagem: 'Cashback exige R$ 100 ou mais.',
    };
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

  if (insErr || !inserted || inserted.length === 0) {
    if (insErr?.message?.includes('não é elegível para cashback')) {
      return {
        ok: false,
        error: 'cashback_inelegivel',
        mensagem: 'Essa seleção não dá cashback.',
      };
    }
    console.error('TX1 insert falhou', insErr);
    return { ok: false, error: 'unknown', mensagem: 'Erro ao criar bilhetes.' };
  }

  const principal = inserted[0]!;
  const profileRes = await supabase
    .from('profiles')
    .select('email, nome')
    .eq('id', user.id)
    .single();

  // 6. Chama MP
  let mp;
  try {
    const payloadArgs: Parameters<typeof montarPayloadMP>[0] = {
      qty,
      user_email: profileRes.data?.email ?? user.email!,
      bilhete_principal_id: principal.id,
      expira_em: expira_provisional,
    };
    if (profileRes.data?.nome) {
      payloadArgs.user_name = profileRes.data.nome;
    }
    mp = await criarPagamentoPIX(montarPayloadMP(payloadArgs));
  } catch (e) {
    console.error('MP create falhou', e);
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
    console.error('TX2 update falhou', { err: updErr, mp_id: mp.id });
    // Bilhetes ficam pendente; viram expirado em 30min via effective_status.
    // Webhook não vai achar (mp_payment_id null) — caso raro, escalável manualmente.
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
