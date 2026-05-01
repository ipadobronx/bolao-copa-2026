import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PalpitesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
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
  if (confirmed.length >= 2) redirect('/minhas-tabelas');

  const { tab } = await searchParams;
  const dest = tab
    ? `/palpites/${confirmed[0].id}?tab=${tab}`
    : `/palpites/${confirmed[0].id}`;
  redirect(dest);
}
