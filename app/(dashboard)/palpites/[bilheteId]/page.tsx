import { notFound, redirect } from 'next/navigation';
import { PalpitesShell } from '@/components/palpites/PalpitesShell';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  BilheteResumo,
  BonusSalvo,
  JogoComSelecoes,
  PalpiteSalvo,
  SelecaoBasica,
} from '@/lib/palpites';

export const dynamic = 'force-dynamic';

export default async function PalpitesBilhetePage({
  params,
  searchParams,
}: {
  params: Promise<{ bilheteId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { bilheteId } = await params;
  const { tab } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/palpites/${bilheteId}`);

  const [
    { data: bilhete },
    { data: jogosRaw },
    { data: palpitesRaw },
    { data: bonusRaw },
    { data: selecoesRaw },
  ] = await Promise.all([
    supabase
      .from('bilhetes')
      .select('id, numero_bilhete, valor_pago, status_pagamento, selecao_cashback_id')
      .eq('id', bilheteId)
      .eq('user_id', user.id)
      .single(),

    supabase
      .from('jogos')
      .select(
        `id, numero_jogo, fase, data_hora, finalizado,
         gols_casa, gols_fora, selecao_casa_id, selecao_fora_id,
         placeholder_casa, placeholder_fora,
         selecao_casa:selecoes!selecao_casa_id(id, nome, bandeira_emoji, codigo_iso, grupo),
         selecao_fora:selecoes!selecao_fora_id(id, nome, bandeira_emoji, codigo_iso, grupo)`,
      )
      .order('numero_jogo', { ascending: true }),

    supabase
      .from('palpites')
      .select('jogo_id, gols_casa, gols_fora, pontos_calculados')
      .eq('bilhete_id', bilheteId),

    supabase
      .from('palpites_bonus')
      .select('tipo, selecao_id, jogador_nome')
      .eq('bilhete_id', bilheteId),

    supabase
      .from('selecoes')
      .select('id, nome, bandeira_emoji, codigo_iso, grupo')
      .order('grupo', { ascending: true })
      .order('nome', { ascending: true }),
  ]);

  if (!bilhete) notFound();

  if (bilhete.status_pagamento !== 'confirmado') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="mb-2 text-4xl">🔒</p>
        <h1 className="mb-1 text-xl font-bold">Bilhete não confirmado</h1>
        <p className="text-text-muted mb-6 text-sm">
          Complete o pagamento PIX para preencher seus palpites.
        </p>
        <a href="/comprar" className="text-accent text-sm underline">
          Ir para pagamento →
        </a>
      </div>
    );
  }

  const jogos: JogoComSelecoes[] = (jogosRaw ?? []).map((j) => ({
    ...j,
    selecao_casa: Array.isArray(j.selecao_casa) ? (j.selecao_casa[0] ?? null) : j.selecao_casa,
    selecao_fora: Array.isArray(j.selecao_fora) ? (j.selecao_fora[0] ?? null) : j.selecao_fora,
  }));

  return (
    <PalpitesShell
      key={bilhete.id}
      bilhete={bilhete as BilheteResumo}
      jogos={jogos}
      palpitesSalvos={(palpitesRaw ?? []) as PalpiteSalvo[]}
      bonusSalvos={(bonusRaw ?? []) as BonusSalvo[]}
      selecoes={(selecoesRaw ?? []) as SelecaoBasica[]}
      initialTab={tab ?? null}
    />
  );
}
