// app/(dashboard)/ranking/page.tsx
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { calcularBadges, type UsuarioBadge } from '@/lib/ranking/badges'
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

  const [emojiMap, { data: perfis }] = await Promise.all([
    calcularBadges(admin, usuarios),
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
      .select('bilhete_id, pontos_calculados, bilhetes!inner(user_id, status_pagamento)')
      .in('jogo_id', periodo.jogoIds)
      .eq('bilhetes.status_pagamento', 'confirmado')

    const pontosPorUser = new Map<string, number>()
    for (const p of palpitesData ?? []) {
      const bilheteRaw = (p as { bilhetes: unknown }).bilhetes
      const bilheteRow = Array.isArray(bilheteRaw) ? bilheteRaw[0] : bilheteRaw
      const uid: string =
        (bilheteRow as { user_id?: string } | null)?.user_id ?? ''
      if (!uid) continue
      pontosPorUser.set(uid, (pontosPorUser.get(uid) ?? 0) + (p.pontos_calculados ?? 0))
    }

    periodoRows = geral
      .filter((r) => pontosPorUser.has(r.userId))
      .map((r) => ({ ...r, pontosTotais: pontosPorUser.get(r.userId) ?? 0 }))
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
