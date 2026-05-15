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

  // Palpite Neymar + config (tabelas criadas em 20260515_palpite_neymar).
  // Cast: types ainda não conhecem essas tabelas; será regenerado pós-migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: palpiteNeymarRow } = await (supabase.from('palpites_neymar' as any) as any)
    .select('resposta')
    .eq('user_id', user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: neymarConfig } = await (supabase.from('neymar_config' as any) as any)
    .select('deadline, pergunta')
    .eq('id', 1)
    .single();

  const palpiteNeymar = neymarConfig
    ? {
        palpiteAtual: (palpiteNeymarRow?.resposta as boolean | undefined) ?? null,
        deadline: neymarConfig.deadline as string,
        pergunta: neymarConfig.pergunta as string,
      }
    : null;

  const qtyInicial = Math.min(50, Math.max(1, Number(searchParams.qty) || 1));
  const cashbackInicial = searchParams.cashback ? Number(searchParams.cashback) : null;

  return (
    <FormulaCheckout
      selecoes={selecoes ?? []}
      qtyInicial={qtyInicial}
      cashbackInicial={cashbackInicial}
      palpiteNeymar={palpiteNeymar}
    />
  );
}
