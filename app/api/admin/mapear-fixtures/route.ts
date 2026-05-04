import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchAllFixtures, TEAM_NAME_MAP, roundToFase } from '@/lib/api-football'

async function verificarAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 as const }
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Acesso negado', status: 403 as const }
  return { error: null, status: null }
}

export async function POST() {
  const auth = await verificarAdmin()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status! })

  const admin = createSupabaseAdminClient()

  let apiFixtures
  try {
    apiFixtures = await fetchAllFixtures(1, 2026)
  } catch (e) {
    return NextResponse.json({ error: `API-Football falhou: ${e instanceof Error ? e.message : 'erro'}` }, { status: 502 })
  }

  const { data: jogosData } = await admin
    .from('jogos')
    .select('id, data_hora, fase, numero_jogo, selecao_casa_id, selecao_fora_id, external_id, selecao_casa:selecoes!selecao_casa_id(nome), selecao_fora:selecoes!selecao_fora_id(nome)')

  const jogos = jogosData ?? []

  let mapeados = 0
  const warnings: { fixture_id: number; motivo: string }[] = []

  for (const fixture of apiFixtures) {
    const fixId = fixture.fixture.id
    const fixDate = new Date(fixture.fixture.date).getTime()
    const faseMapped = roundToFase(fixture.league.round)

    let jogoMatch: typeof jogos[number] | undefined

    const homeName = TEAM_NAME_MAP[fixture.teams.home.name]
    const awayName = TEAM_NAME_MAP[fixture.teams.away.name]

    if (homeName && awayName) {
      jogoMatch = jogos.find((j) => {
        const cn = (j.selecao_casa as { nome: string } | null)?.nome
        const fn = (j.selecao_fora as { nome: string } | null)?.nome
        return cn === homeName && fn === awayName
      })
    }

    if (!jogoMatch && faseMapped) {
      jogoMatch = jogos.find((j) => {
        if (j.fase !== faseMapped) return false
        const diff = Math.abs(new Date(j.data_hora as string).getTime() - fixDate)
        return diff < 30 * 60 * 1000
      })
    }

    if (!jogoMatch) {
      warnings.push({ fixture_id: fixId, motivo: `Nenhum jogo no banco bate com date=${fixture.fixture.date} round=${fixture.league.round}` })
      continue
    }

    await admin.from('jogos').update({ external_id: String(fixId) }).eq('id', jogoMatch.id)
    mapeados++
  }

  return NextResponse.json({ mapeados, total_api: apiFixtures.length, warnings })
}
