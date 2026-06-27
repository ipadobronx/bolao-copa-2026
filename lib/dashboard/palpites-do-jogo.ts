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

/**
 * Agrega os palpites do "slot" de jogo atual e do próximo slot. Cada slot é o
 * conjunto de jogos que compartilham o mesmo horário (ex.: 2 jogos simultâneos
 * às 16h viram 2 cards). Agrega sobre o melhor bilhete de cada pessoa.
 */
export async function montarPalpitesDoJogo(): Promise<{
  atuais: JogoResumo[]
  proximos: JogoResumo[]
}> {
  const admin = createSupabaseAdminClient()
  const agora = new Date().toISOString()

  // 1) Descobre o horário do slot atual (jogo travado mais recente) e do próximo.
  const [slotAtualRes, slotProxRes, rankRes] = await Promise.all([
    admin.from('jogos').select('data_hora').lte('data_hora', agora).order('data_hora', { ascending: false }).limit(1).maybeSingle(),
    admin.from('jogos').select('data_hora').gt('data_hora', agora).order('data_hora', { ascending: true }).limit(1).maybeSingle(),
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

  const tProximo = slotProxRes.data?.data_hora ?? null

  // Só tratamos como "jogo atual" o slot travado mais recente se ele for de HOJE
  // (Brasília). Senão o painel ficaria mostrando jogos já encerrados de um dia
  // anterior no topo, escondendo os de hoje. Entre rodadas, atuais fica vazio e
  // só aparecem os próximos.
  const diaBRT = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  const tAtualRaw = slotAtualRes.data?.data_hora ?? null
  const tAtual = tAtualRaw && diaBRT(tAtualRaw) === diaBRT(agora) ? tAtualRaw : null

  // 2) Busca todos os jogos de cada slot (mesmo horário exato).
  const [atuaisRes, proxRes] = await Promise.all([
    tAtual
      ? admin.from('jogos').select(JOGO_COLS).eq('data_hora', tAtual).order('numero_jogo')
      : Promise.resolve({ data: [] as JogoRow[] }),
    tProximo
      ? admin.from('jogos').select(JOGO_COLS).eq('data_hora', tProximo).order('numero_jogo')
      : Promise.resolve({ data: [] as JogoRow[] }),
  ])

  const atuaisRows = (atuaisRes.data ?? []) as unknown as JogoRow[]
  const proxRows = (proxRes.data ?? []) as unknown as JogoRow[]

  const atuais = await Promise.all(atuaisRows.map((j) => buildJogo(admin, j, melhores, true)))
  const proximos = await Promise.all(proxRows.map((j) => buildJogo(admin, j, melhores, false)))
  return { atuais, proximos }
}
