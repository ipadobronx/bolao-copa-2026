// app/(dashboard)/ranking/page.tsx
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { calcularBadges, calcularForma, type UsuarioBadge } from '@/lib/ranking/badges'
import { determinarPeriodoAtual } from '@/lib/ranking'
import { RankingShell } from '@/components/ranking/RankingShell'
import type { RankingRowData } from '@/components/ranking/RankingRow'

export const dynamic = 'force-dynamic'

export default async function RankingPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const [{ data: rankingData }, { data: jogosData }, { data: snapshots }] =
    await Promise.all([
      supabase
        .from('ranking_usuarios')
        .select('*')
        .order('posicao', { ascending: true }),
      supabase.from('jogos').select('id, fase, data_hora, finalizado'),
      supabase
        .from('ranking_snapshots')
        .select('user_id, posicao, snapshot_at')
        .order('snapshot_at', { ascending: false }),
    ])

  const lastSnap = new Map<string, number>()
  for (const s of snapshots ?? []) {
    if (s.user_id && !lastSnap.has(s.user_id)) lastSnap.set(s.user_id, s.posicao)
  }

  const admin = createSupabaseAdminClient()
  const usuarios: UsuarioBadge[] = (rankingData ?? [])
    .filter((r): r is typeof r & { user_id: string } => Boolean(r.user_id))
    .map((r) => ({ userId: r.user_id, melhorBilheteId: r.melhor_bilhete_id ?? null }))

  const [emojiMap, formaMap, { data: perfis }] = await Promise.all([
    calcularBadges(admin, usuarios),
    calcularForma(admin, usuarios),
    admin.from('profiles').select('id, clube').in('id', usuarios.map((u) => u.userId)),
  ])
  const clubeMap = new Map<string, string | null>(
    (perfis ?? []).map((p) => [p.id, p.clube ?? null]),
  )

  const geral: RankingRowData[] = (rankingData ?? []).map((r) => {
    const snapPos = lastSnap.get(r.user_id ?? '') ?? null
    return {
      userId: r.user_id ?? '',
      nome: r.nome ?? '',
      posicao: r.posicao ?? 0,
      pontosTotais: r.pontos_totais ?? 0,
      acertosExatos: r.acertos_exatos ?? 0,
      acertosParciais: r.acertos_parciais ?? 0,
      totalBilhetes: r.total_bilhetes ?? 1,
      tendencia: snapPos !== null ? snapPos - (r.posicao ?? 0) : null,
      isCurrentUser: r.user_id === user.id,
      emoji: emojiMap.get(r.user_id ?? '') ?? null,
      clube: clubeMap.get(r.user_id ?? '') ?? null,
      forma: formaMap.get(r.user_id ?? '') ?? null,
    }
  })

  const jogosParaPeriodo = (jogosData ?? []).map((j) => ({
    id: j.id,
    fase: j.fase,
    data_hora: j.data_hora,
    finalizado: j.finalizado,
  }))
  const periodo = determinarPeriodoAtual(jogosParaPeriodo)

  let periodoRows: RankingRowData[] = []
  if (periodo && periodo.jogoIds.length > 0) {
    const { data: palpitesData } = await supabase
      .from('palpites')
      .select('bilhete_id, pontos_calculados, bilhetes!inner(status_pagamento)')
      .in('jogo_id', periodo.jogoIds)
      .eq('bilhetes.status_pagamento', 'confirmado')

    // Soma os pontos da rodada POR BILHETE (não por usuário).
    const pontosPorBilhete = new Map<string, number>()
    for (const p of palpitesData ?? []) {
      pontosPorBilhete.set(
        p.bilhete_id,
        (pontosPorBilhete.get(p.bilhete_id) ?? 0) + (p.pontos_calculados ?? 0),
      )
    }

    // Cada usuário é representado pelo seu MELHOR bilhete (o que aparece no Geral).
    // A Rodada mostra quanto ESSE bilhete pontuou no período — não a soma de todas
    // as tabelas do usuário.
    const melhorBilhetePorUser = new Map<string, string>(
      (rankingData ?? [])
        .filter(
          (r): r is typeof r & { user_id: string; melhor_bilhete_id: string } =>
            Boolean(r.user_id) && Boolean(r.melhor_bilhete_id),
        )
        .map((r) => [r.user_id, r.melhor_bilhete_id]),
    )

    periodoRows = geral
      .filter((r) => {
        const bid = melhorBilhetePorUser.get(r.userId)
        return bid !== undefined && pontosPorBilhete.has(bid)
      })
      .map((r) => ({
        ...r,
        pontosTotais: pontosPorBilhete.get(melhorBilhetePorUser.get(r.userId)!) ?? 0,
      }))
      .sort((a, b) => b.pontosTotais - a.pontosTotais)
      .map((r, i) => ({ ...r, posicao: i + 1, tendencia: null }))
  }

  return (
    <RankingShell
      initialRows={geral}
      periodoLabel={periodo?.label ?? 'Aguardando jogos'}
      periodoRows={periodoRows}
      totalApostadores={geral.length}
    />
  )
}
