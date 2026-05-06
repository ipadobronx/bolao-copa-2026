// app/(dashboard)/dashboard/page.tsx
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { ProximosJogosPanel } from '@/components/dashboard/ProximosJogosPanel'
import type { JogoRowData } from '@/components/dashboard/JogoRow'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { DashboardEmptyHero } from '@/components/dashboard/DashboardEmptyHero'
import { DashboardPendentePix } from '@/components/dashboard/DashboardPendentePix'
import { CardPontos } from '@/components/dashboard/CardPontos'
import { CardPosicao } from '@/components/dashboard/CardPosicao'
import { CardProgresso } from '@/components/dashboard/CardProgresso'
import { CardCountdown } from '@/components/dashboard/CardCountdown'
import {
  determinarEstadoDashboard,
  type BilheteEstadoInput,
  type DashboardEstado,
  type RankingUsuarioInput,
} from '@/lib/dashboard/estado'
import { formatDiasHoras } from '@/lib/dashboard/countdown'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const COPA_INICIO = new Date('2026-06-11T00:00:00Z')

function toRankingInput(
  row: {
    melhor_bilhete_id: string | null
    melhor_numero_bilhete: number | null
    pontos_totais: number | null
    posicao: number | null
    total_bilhetes: number | null
  } | null,
): RankingUsuarioInput {
  if (!row) return null
  if (
    row.melhor_bilhete_id === null ||
    row.melhor_numero_bilhete === null ||
    row.pontos_totais === null ||
    row.posicao === null ||
    row.total_bilhetes === null
  ) {
    return null
  }
  return {
    melhor_bilhete_id: row.melhor_bilhete_id,
    melhor_numero_bilhete: row.melhor_numero_bilhete,
    pontos_totais: row.pontos_totais,
    posicao: row.posicao,
    total_bilhetes: row.total_bilhetes,
  }
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard')

  // Profile pro header (nome). Reaproveita pattern da F4.
  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, email')
    .eq('id', user.id)
    .single()
  const nome = profile?.nome || 'Apostador'
  const email = profile?.email || user.email || ''

  // Fase 1: 5 queries paralelas
  const agora = new Date()
  const [bilhetesRes, rankingRes, palpitesCountRes, jogosFutRes, jogoFinRes] = await Promise.all([
    supabase
      .from('bilhetes_view')
      .select('id, numero_bilhete, valor_pago, effective_status, created_at')
      .eq('user_id', user.id),
    supabase
      .from('ranking_usuarios')
      .select('melhor_bilhete_id, melhor_numero_bilhete, pontos_totais, posicao, total_bilhetes')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.rpc('count_palpites_confirmados', { uid: user.id }),
    supabase
      .from('jogos')
      .select(
        `
          id, data_hora, fase, placeholder_casa, placeholder_fora,
          casa:selecoes!selecao_casa_id(nome, bandeira_emoji),
          fora:selecoes!selecao_fora_id(nome, bandeira_emoji)
        `,
      )
      .gt('data_hora', agora.toISOString())
      .order('data_hora', { ascending: true })
      .limit(5),
    supabase.from('jogos').select('id', { head: true, count: 'exact' }).eq('finalizado', true),
  ])

  const bilhetesRaw = (bilhetesRes.data ?? []) as BilheteEstadoInput[]
  const ranking = toRankingInput(rankingRes.data)
  const palpitesCount = (palpitesCountRes.data as number | null) ?? 0
  const jogosFinalizadosCount = jogoFinRes.count ?? 0
  const jogosErrored = !!jogosFutRes.error

  // Determinar estado preliminar pra decidir se precisamos de fase 2
  const estadoBase = determinarEstadoDashboard({
    bilhetes: bilhetesRaw,
    ranking,
    palpitesCount,
    jogosFinalizadosCount,
    copaInicio: COPA_INICIO,
    snapshot: null,
    totalParticipantes: 0,
  })

  // Fase 2: só roda se a Fase 1 retornou em-andamento (precisa de snapshot + total participantes)
  let estado: DashboardEstado = estadoBase
  if (estadoBase.kind === 'em-andamento') {
    const [snapRes, totalRes] = await Promise.all([
      supabase
        .from('ranking_snapshots')
        .select('posicao, pontos_totais')
        .eq('user_id', user.id)
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('ranking_usuarios').select('user_id', { head: true, count: 'exact' }),
    ])
    estado = determinarEstadoDashboard({
      bilhetes: bilhetesRaw,
      ranking,
      palpitesCount,
      jogosFinalizadosCount,
      copaInicio: COPA_INICIO,
      snapshot: snapRes.data,
      totalParticipantes: totalRes.count ?? 0,
    })
  }

  // Próximos jogos (mesmo shape do dashboard atual) pros estados B/C/D
  const jogos: JogoRowData[] = (jogosFutRes.data ?? []).map((j) => ({
    id: j.id,
    data_hora: j.data_hora,
    fase: j.fase,
    placeholder_casa: j.placeholder_casa,
    placeholder_fora: j.placeholder_fora,
    casa: Array.isArray(j.casa) ? (j.casa[0] ?? null) : j.casa,
    fora: Array.isArray(j.fora) ? (j.fora[0] ?? null) : j.fora,
  }))

  // Subtitle por estado
  const subtitle = (() => {
    if (estado.kind === 'sem-bilhete') return 'Sua primeira tabela te espera'
    if (estado.kind === 'pendente-puro') return 'Você tem um pagamento pendente'
    if (estado.kind === 'pre-copa') {
      const { dias } = formatDiasHoras(agora, estado.copaInicio)
      return dias === 0 ? 'Copa começa hoje!' : `Faltam ${dias} dias pra Copa começar`
    }
    return 'Copa em andamento — vê seu desempenho'
  })()

  return (
    <>
      <DashboardHeader nome={nome} email={email} subtitle={subtitle} />

      {estado.kind === 'sem-bilhete' && <DashboardEmptyHero />}

      {estado.kind === 'pendente-puro' && (
        <>
          <DashboardPendentePix pendente={estado.pendente} variant="hero" />
          <ProximosJogosPanel jogos={jogos} errored={jogosErrored} />
        </>
      )}

      {estado.kind === 'pre-copa' && (
        <>
          {estado.pendente && (
            <DashboardPendentePix pendente={estado.pendente} variant="banner" />
          )}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CardCountdown copaInicio={estado.copaInicio} agora={agora} />
            <CardProgresso
              porcentagem={estado.progresso.porcentagem}
              preenchidos={estado.progresso.preenchidos}
              total={estado.progresso.total}
              totalBilhetes={estado.progresso.totalBilhetes}
            />
          </div>
          <ProximosJogosPanel jogos={jogos} errored={jogosErrored} />
          {estado.progresso.porcentagem < 100 && (
            <Link
              href={'/palpites' as Route}
              className="text-accent mt-4 inline-flex items-center gap-1 text-sm hover:underline"
            >
              Fazer palpites <ArrowRight className="size-3" />
            </Link>
          )}
        </>
      )}

      {estado.kind === 'em-andamento' && (
        <>
          {estado.pendente && (
            <DashboardPendentePix pendente={estado.pendente} variant="banner" />
          )}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            <CardPontos
              pontos={estado.rankingUsuario.pontos_totais}
              numeroBilhete={estado.rankingUsuario.melhor_numero_bilhete}
              totalBilhetes={estado.rankingUsuario.total_bilhetes}
              tendencia={estado.tendenciaPontos}
            />
            <CardPosicao
              posicao={estado.rankingUsuario.posicao}
              totalParticipantes={estado.totalParticipantes}
              tendencia={estado.tendenciaPosicao}
            />
            <CardProgresso
              porcentagem={estado.progresso.porcentagem}
              preenchidos={estado.progresso.preenchidos}
              total={estado.progresso.total}
              totalBilhetes={estado.progresso.totalBilhetes}
            />
          </div>
          <ProximosJogosPanel jogos={jogos} errored={jogosErrored} />
          <div className="mt-4 flex flex-wrap gap-4">
            <Link href={'/ranking' as Route} className="text-accent inline-flex items-center gap-1 text-sm hover:underline">
              Ver ranking completo <ArrowRight className="size-3" />
            </Link>
            {estado.progresso.porcentagem < 100 && (
              <Link
                href={'/palpites' as Route}
                className="text-accent inline-flex items-center gap-1 text-sm hover:underline"
              >
                Fazer palpites <ArrowRight className="size-3" />
              </Link>
            )}
          </div>
        </>
      )}
    </>
  )
}
