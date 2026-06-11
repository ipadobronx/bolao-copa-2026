import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PalpitesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; bilhete?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/palpites');

  const { data: bilhetes } = await supabase
    .from('bilhetes')
    .select('id')
    .eq('user_id', user.id)
    .eq('status_pagamento', 'confirmado')
    .order('numero_bilhete', { ascending: true });

  const confirmed = bilhetes ?? [];

  if (confirmed.length === 0) redirect('/comprar');

  const { tab, bilhete } = await searchParams;
  const tabSuffix = tab ? `?tab=${tab}` : '';

  // ?bilhete=<id> explícito (ex.: pós-checkout da 2ª tabela): vai direto pra ela,
  // desde que seja um bilhete confirmado do próprio usuário.
  if (bilhete && confirmed.some((b) => b.id === bilhete)) {
    redirect(`/palpites/${bilhete}${tabSuffix}`);
  }

  if (confirmed.length >= 2) redirect('/minhas-tabelas');

  redirect(`/palpites/${confirmed[0]!.id}${tabSuffix}`);
}
