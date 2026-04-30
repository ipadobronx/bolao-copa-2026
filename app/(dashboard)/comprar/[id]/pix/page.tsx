import type { Route } from 'next';
import { redirect, notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TelaPIX } from '@/components/checkout/TelaPIX';
import { consultarPagamento } from '@/lib/mercadopago.io';

export const dynamic = 'force-dynamic';

export default async function PIXPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();

  const { data: bilhete } = await supabase
    .from('bilhetes_view')
    .select(
      `
      id, effective_status, expira_em, valor_pago, mp_payment_id,
      selecao_cashback_id,
      selecoes:selecao_cashback_id(nome, bandeira_emoji, cashback_multiplicador)
    `,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!bilhete || !bilhete.id || bilhete.valor_pago == null) notFound();
  if (bilhete.effective_status === 'confirmado') {
    redirect(`/palpites?bilhete=${bilhete.id}` as Route);
  }
  if (bilhete.effective_status !== 'pendente') {
    redirect('/comprar');
  }
  if (!bilhete.mp_payment_id || !bilhete.expira_em) {
    redirect('/comprar');
  }

  const { count: qty } = await supabase
    .from('bilhetes')
    .select('id', { count: 'exact', head: true })
    .eq('mp_payment_id', bilhete.mp_payment_id);

  const mp = await consultarPagamento(bilhete.mp_payment_id);

  const selecaoRel = Array.isArray(bilhete.selecoes) ? bilhete.selecoes[0] : bilhete.selecoes;

  return (
    <TelaPIX
      bilheteId={bilhete.id}
      qrCode={mp.qr_code}
      qrCodeBase64={mp.qr_code_base64}
      expiraEm={bilhete.expira_em}
      valorTotal={Number(bilhete.valor_pago)}
      resumo={{
        qty: qty ?? 1,
        ...(selecaoRel
          ? {
              cashback: {
                selecao: selecaoRel.nome,
                multiplicador: Number(selecaoRel.cashback_multiplicador),
                bandeira: selecaoRel.bandeira_emoji,
              },
            }
          : {}),
      }}
    />
  );
}
