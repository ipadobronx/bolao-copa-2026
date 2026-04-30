import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FormulaCheckout } from '@/components/checkout/FormulaCheckout';

export const dynamic = 'force-dynamic';

type SearchParams = { qty?: string; cashback?: string };

export default async function ComprarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/comprar');

  const { data: selecoes } = await supabase
    .from('selecoes')
    .select('id, nome, codigo_iso, bandeira_emoji, cashback_multiplicador')
    .gt('cashback_multiplicador', 0)
    .order('cashback_multiplicador', { ascending: false })
    .order('nome');

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
