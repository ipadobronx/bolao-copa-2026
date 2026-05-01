import { redirect } from 'next/navigation';
import { TabelaCard } from '@/components/minhas-tabelas/TabelaCard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { BilheteResumo, SelecaoBasica } from '@/lib/palpites';

export const dynamic = 'force-dynamic';

export default async function MinhasTabelasPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/minhas-tabelas');

  const { data: bilhetes } = await supabase
    .from('bilhetes')
    .select('id, numero_bilhete, valor_pago, status_pagamento, selecao_cashback_id')
    .eq('user_id', user.id)
    .order('numero_bilhete', { ascending: true });

  const bilhetesData = bilhetes ?? [];
  const bilheteIds = bilhetesData.map((b) => b.id);

  const { data: palpitesAll } = bilheteIds.length
    ? await supabase.from('palpites').select('bilhete_id').in('bilhete_id', bilheteIds)
    : { data: [] };

  const countMap = new Map<string, number>();
  for (const p of palpitesAll ?? []) {
    countMap.set(p.bilhete_id, (countMap.get(p.bilhete_id) ?? 0) + 1);
  }

  const cashbackIds = bilhetesData
    .map((b) => b.selecao_cashback_id)
    .filter((id): id is number => id !== null);

  const { data: selecoes } = cashbackIds.length
    ? await supabase
        .from('selecoes')
        .select('id, nome, bandeira_emoji, codigo_iso, grupo')
        .in('id', cashbackIds)
    : { data: [] };

  const selecaoMap = new Map<number, SelecaoBasica>();
  for (const s of selecoes ?? []) selecaoMap.set(s.id, s);

  if (bilhetesData.length === 0) {
    return (
      <div className="p-6">
        <h1 className="font-display mb-2 text-3xl">
          Minhas <span className="text-accent">tabelas</span>
        </h1>
        <p className="text-text-muted text-sm">
          Você ainda não comprou nenhuma tabela.{' '}
          <a href="/comprar" className="text-accent underline">
            Comprar agora →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="font-display mb-1 text-3xl">
        Minhas <span className="text-accent">tabelas</span>
      </h1>
      <p className="text-text-muted mb-6 text-sm">
        {bilhetesData.length} tabela{bilhetesData.length !== 1 ? 's' : ''} comprada
        {bilhetesData.length !== 1 ? 's' : ''}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {bilhetesData.map((b) => (
          <TabelaCard
            key={b.id}
            bilhete={b as BilheteResumo}
            palpitesCount={countMap.get(b.id) ?? 0}
            selecaoCashback={
              b.selecao_cashback_id ? (selecaoMap.get(b.selecao_cashback_id) ?? null) : null
            }
          />
        ))}
      </div>
    </div>
  );
}
