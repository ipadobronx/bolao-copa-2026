import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { calcularBadges, type UsuarioBadge } from '@/lib/ranking/badges'
import { determinarPeriodoAtual, type JogoParaPeriodo } from '@/lib/ranking'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const [{ data: rankingData }, { data: jogosRaw }] = await Promise.all([
    supabase.from('ranking_usuarios').select('*').order('posicao', { ascending: true }),
    supabase.from('jogos').select('id, fase, data_hora, finalizado'),
  ])

  const jogosData: JogoParaPeriodo[] = (jogosRaw ?? []).map((j) => ({
    id: j.id,
    fase: j.fase,
    data_hora: j.data_hora,
    finalizado: j.finalizado,
  }))

  const periodo = determinarPeriodoAtual(jogosData)

  // Buscar último snapshot por usuário para calcular tendência
  const { data: snapshots } = await supabase
    .from('ranking_snapshots')
    .select('user_id, posicao, snapshot_at')
    .order('snapshot_at', { ascending: false })

  const lastSnap = new Map<string, number>()
  for (const s of snapshots ?? []) {
    if (!lastSnap.has(s.user_id)) lastSnap.set(s.user_id, s.posicao)
  }

  const admin = createSupabaseAdminClient()
  const usuarios: UsuarioBadge[] = (rankingData ?? [])
    .filter((r): r is typeof r & { user_id: string } => r.user_id !== null && r.user_id !== undefined)
    .map((r) => ({ userId: r.user_id, melhorBilheteId: r.melhor_bilhete_id ?? null }))

  const [emojiMap, { data: perfis }] = await Promise.all([
    calcularBadges(admin, usuarios),
    admin.from('profiles').select('id, clube').in('id', usuarios.map((u) => u.userId)),
  ])
  const clubeMap = new Map<string, string | null>(
    (perfis ?? []).map((p) => [p.id, p.clube ?? null]),
  )

  const geral = (rankingData ?? [])
    .filter((r): r is typeof r & { user_id: string } => r.user_id !== null && r.user_id !== undefined)
    .map((r) => {
      const snapPos = lastSnap.get(r.user_id) ?? null
      return {
        userId: r.user_id,
        nome: r.nome ?? '',
        posicao: r.posicao ?? 0,
        pontosTotais: r.pontos_totais ?? 0,
        acertosExatos: r.acertos_exatos ?? 0,
        acertosParciais: r.acertos_parciais ?? 0,
        totalBilhetes: r.total_bilhetes ?? 1,
        tendencia: snapPos !== null ? snapPos - (r.posicao ?? 0) : null,
        isCurrentUser: r.user_id === user.id,
        emoji: emojiMap.get(r.user_id) ?? null,
        clube: clubeMap.get(r.user_id) ?? null,
      }
    })

  let periodoRows: typeof geral = []
  if (periodo) {
    const { data: palpitesData } = await supabase
      .from('palpites')
      .select('bilhete_id, pontos_calculados, bilhetes!inner(user_id, status_pagamento)')
      .in('jogo_id', periodo.jogoIds)
      .eq('bilhetes.status_pagamento', 'confirmado')

    // Agregar pontos por bilhete
    const pontosPorBilhete = new Map<string, number>()
    for (const p of palpitesData ?? []) {
      const prev = pontosPorBilhete.get(p.bilhete_id) ?? 0
      pontosPorBilhete.set(p.bilhete_id, prev + (p.pontos_calculados ?? 0))
    }

    // Melhor bilhete por usuário no período
    const melhorPorUser = new Map<string, number>()
    for (const [bilheteId, pts] of pontosPorBilhete) {
      const rd = (rankingData ?? []).find((r) => r.melhor_bilhete_id === bilheteId)
      if (rd?.user_id) {
        const prev = melhorPorUser.get(rd.user_id) ?? -1
        if (pts > prev) melhorPorUser.set(rd.user_id, pts)
      }
    }

    periodoRows = geral
      .filter((r) => melhorPorUser.has(r.userId))
      .map((r) => ({ ...r, pontosTotais: melhorPorUser.get(r.userId) ?? 0 }))
      .sort((a, b) => b.pontosTotais - a.pontosTotais)
      .map((r, i) => ({ ...r, posicao: i + 1 }))
  }

  return NextResponse.json({ geral, periodo: periodoRows })
}
