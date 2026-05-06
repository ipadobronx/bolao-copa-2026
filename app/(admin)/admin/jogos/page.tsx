import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { JogosClient } from './JogosClient'
import type { JogoComSelecoes, SelecaoBasica } from '@/components/admin/JogoRow'

export default async function AdminJogosPage() {
  const admin = createSupabaseAdminClient()

  const [jogosRes, selecoesRes, copaRes, syncRes, mapeadosRes] = await Promise.all([
    admin
      .from('jogos')
      .select(`
        id, numero_jogo, fase, data_hora,
        selecao_casa_id, selecao_fora_id,
        placeholder_casa, placeholder_fora,
        gols_casa, gols_fora, finalizado,
        selecao_casa:selecoes!selecao_casa_id(id, nome, bandeira_emoji, codigo_iso),
        selecao_fora:selecoes!selecao_fora_id(id, nome, bandeira_emoji, codigo_iso)
      `)
      .order('data_hora', { ascending: true }),
    admin
      .from('selecoes')
      .select('id, nome, bandeira_emoji, codigo_iso')
      .order('nome', { ascending: true }),
    admin
      .from('copa_resultados')
      .select('*')
      .eq('id', 1)
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('sync_jogos_log')
      .select('iniciado_em, finalizado_em, jogos_atualizados, status')
      .order('iniciado_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('jogos')
      .select('*', { count: 'exact', head: true })
      .not('external_id', 'is', null),
  ])

  const jogos = (jogosRes.data ?? []) as unknown as JogoComSelecoes[]
  const selecoes = (selecoesRes.data ?? []) as SelecaoBasica[]
  const copaResultados = copaRes.data ?? {
    id: 1,
    campeao_id: null,
    vice_id: null,
    terceiro_id: null,
    quarto_id: null,
    artilheiro_nome: null,
    revelacao_id: null,
    finalizada: false,
  }
  const ultimoSync = (syncRes.data ?? null) as {
    iniciado_em: string
    finalizado_em: string | null
    jogos_atualizados: number
    status: string
  } | null
  const totalMapeados = (mapeadosRes.count ?? 0) as number

  const proximoJogo = jogos.find((j) => !j.finalizado)
  const initialTab = proximoJogo?.fase ?? 'grupos'

  return (
    <section>
      <div className="mb-8">
        <h1 className="font-display text-text-primary text-4xl tracking-wide">
          Jogos <span className="text-danger">& Resultados</span>
        </h1>
        <p className="text-text-muted mt-1 text-sm">Copa 2026 · Inserção de placares e recálculo de pontos</p>
      </div>
      <JogosClient
        jogos={jogos}
        selecoes={selecoes}
        copaResultados={copaResultados}
        initialTab={initialTab}
        ultimoSync={ultimoSync}
        totalMapeados={totalMapeados}
      />
    </section>
  )
}
