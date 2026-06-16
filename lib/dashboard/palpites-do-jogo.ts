import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { resumoPalpites, type JogoResumo, type PalpitePessoa } from './resumo-jogo'

type Admin = ReturnType<typeof createSupabaseAdminClient>

const JOGO_COLS =
  'id, numero_jogo, data_hora, finalizado, gols_casa, gols_fora, placeholder_casa, placeholder_fora, ' +
  'casa:selecoes!selecao_casa_id(nome, bandeira_emoji), ' +
  'fora:selecoes!selecao_fora_id(nome, bandeira_emoji)'

type Selecao = { nome: string; bandeira_emoji: string }
type JogoRow = {
  id: number
  numero_jogo: number | null
  data_hora: string
  finalizado: boolean | null
  gols_casa: number | null
  gols_fora: number | null
  placeholder_casa: string | null
  placeholder_fora: string | null
  casa: Selecao | Selecao[] | null
  fora: Selecao | Selecao[] | null
}

type Melhor = { bilheteId: string; nome: string; userId: string; posicao: number }

async function buildJogo(
  admin: Admin,
  j: JogoRow,
  melhores: Melhor[],
  incluirPalpites: boolean,
): Promise<JogoResumo> {
  const bilheteIds = melhores.map((m) => m.bilheteId)
  const { data: palps } = bilheteIds.length
    ? await admin
        .from('palpites')
        .select('bilhete_id, gols_casa, gols_fora, pontos_calculados')
        .eq('jogo_id', j.id)
        .in('bilhete_id', bilheteIds)
    : { data: [] }

  const lista = palps ?? []
  const resumo = resumoPalpites(lista.map((p) => ({ gols_casa: p.gols_casa, gols_fora: p.gols_fora })))

  const c = Array.isArray(j.casa) ? j.casa[0] : j.casa
  const f = Array.isArray(j.fora) ? j.fora[0] : j.fora

  let palpites: PalpitePessoa[] | null = null
  if (incluirPalpites) {
    const byBilhete = new Map(lista.map((p) => [p.bilhete_id, p]))
    palpites = melhores
      .filter((m) => byBilhete.has(m.bilheteId))
      .sort((a, b) => a.posicao - b.posicao)
      .map((m) => {
        const p = byBilhete.get(m.bilheteId)!
        return {
          userId: m.userId,
          nome: m.nome,
          gc: p.gols_casa,
          gf: p.gols_fora,
          pts: p.pontos_calculados,
          isLider: m.posicao === 1,
        }
      })
  }

  return {
    numeroJogo: j.numero_jogo ?? 0,
    dataHora: j.data_hora,
    casa: c?.nome ?? j.placeholder_casa ?? '?',
    fora: f?.nome ?? j.placeholder_fora ?? '?',
    bandeiraCasa: c?.bandeira_emoji ?? null,
    bandeiraFora: f?.bandeira_emoji ?? null,
    finalizado: j.finalizado ?? false,
    realCasa: j.gols_casa,
    realFora: j.gols_fora,
    total: resumo.total,
    tendencia: resumo.tendencia,
    topPlacares: resumo.topPlacares,
    palpites,
  }
}

/** Acha o jogo travado mais recente (atual) e o próximo; agrega sobre o melhor bilhete de cada pessoa. */
export async function montarPalpitesDoJogo(): Promise<{
  atual: JogoResumo | null
  proximo: JogoResumo | null
}> {
  const admin = createSupabaseAdminClient()
  const agora = new Date().toISOString()

  const [atualRes, proxRes, rankRes] = await Promise.all([
    admin.from('jogos').select(JOGO_COLS).lte('data_hora', agora).order('data_hora', { ascending: false }).limit(1).maybeSingle(),
    admin.from('jogos').select(JOGO_COLS).gt('data_hora', agora).order('data_hora', { ascending: true }).limit(1).maybeSingle(),
    admin.from('ranking_usuarios').select('user_id, nome, melhor_bilhete_id, posicao'),
  ])

  const melhores: Melhor[] = (rankRes.data ?? [])
    .filter((r): r is typeof r & { melhor_bilhete_id: string } => r.melhor_bilhete_id !== null)
    .map((r) => ({
      bilheteId: r.melhor_bilhete_id,
      nome: r.nome ?? '',
      userId: r.user_id ?? '',
      posicao: r.posicao ?? 0,
    }))

  const atualRow = atualRes.data as unknown as JogoRow | null
  const proxRow = proxRes.data as unknown as JogoRow | null

  const atual = atualRow ? await buildJogo(admin, atualRow, melhores, true) : null
  const proximo = proxRow ? await buildJogo(admin, proxRow, melhores, false) : null
  return { atual, proximo }
}
