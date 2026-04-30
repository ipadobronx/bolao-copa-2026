import { ProximosJogosPanel } from '@/components/dashboard/ProximosJogosPanel';
import type { JogoRowData } from '@/components/dashboard/JogoRow';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const agora = new Date().toISOString();

  const { data, error } = await supabase
    .from('jogos')
    .select(
      `
        id, data_hora, fase, placeholder_casa, placeholder_fora,
        casa:selecoes!selecao_casa_id(nome, bandeira_emoji),
        fora:selecoes!selecao_fora_id(nome, bandeira_emoji)
      `,
    )
    .gt('data_hora', agora)
    .order('data_hora', { ascending: true })
    .limit(5);

  if (error) {
    return <ProximosJogosPanel jogos={[]} errored />;
  }

  // Supabase tipa os related selects como possivelmente arrays mesmo em FK 1:1.
  // Normalizamos pro shape esperado pelo JogoRow.
  const jogos: JogoRowData[] = (data ?? []).map((j) => ({
    id: j.id,
    data_hora: j.data_hora,
    fase: j.fase,
    placeholder_casa: j.placeholder_casa,
    placeholder_fora: j.placeholder_fora,
    casa: Array.isArray(j.casa) ? (j.casa[0] ?? null) : j.casa,
    fora: Array.isArray(j.fora) ? (j.fora[0] ?? null) : j.fora,
  }));

  return <ProximosJogosPanel jogos={jogos} />;
}
