import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { calcularForma } from '@/lib/ranking/badges'

type Tabela = { bilheteId: string; numero: number; pontos: number; posicao: number; exatos: number }
type BonusSel = { nome: string; bandeira: string } | null

export async function GET(
  _req: Request,
  { params }: { params: { bilheteId: string } },
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // bônus (6 tipos) — RLS já libera pós-início
  const { data: bonus } = await supabase
    .from('palpites_bonus')
    .select('tipo, jogador_nome, selecao:selecoes!selecao_id(nome, bandeira_emoji)')
    .eq('bilhete_id', params.bilheteId)
    .in('tipo', ['campeao', 'vice', 'terceiro', 'quarto', 'artilheiro', 'revelacao'])

  const selOf = (b: { selecao: unknown }): BonusSel => {
    const s = (Array.isArray(b.selecao) ? b.selecao[0] : b.selecao) as
      | { nome: string; bandeira_emoji: string }
      | null
      | undefined
    return s ? { nome: s.nome, bandeira: s.bandeira_emoji } : null
  }
  let campeao: BonusSel = null
  let vice: BonusSel = null
  let terceiro: BonusSel = null
  let quarto: BonusSel = null
  let revelacao: BonusSel = null
  let artilheiro: string | null = null
  for (const b of bonus ?? []) {
    if (b.tipo === 'campeao') campeao = selOf(b)
    else if (b.tipo === 'vice') vice = selOf(b)
    else if (b.tipo === 'terceiro') terceiro = selOf(b)
    else if (b.tipo === 'quarto') quarto = selOf(b)
    else if (b.tipo === 'revelacao') revelacao = selOf(b)
    else if (b.tipo === 'artilheiro') artilheiro = b.jogador_nome ?? null
  }

  // tabelas + stats — via view `ranking` (user_id do dono vem da própria view)
  let tabelas: Tabela[] = []
  let donoUserId: string | null = null
  const { data: donoRow } = await supabase
    .from('ranking')
    .select('user_id')
    .eq('bilhete_id', params.bilheteId)
    .maybeSingle()
  if (donoRow?.user_id) {
    donoUserId = donoRow.user_id
    const { data: rows } = await supabase
      .from('ranking')
      .select('bilhete_id, numero_bilhete, pontos_totais, posicao, acertos_exatos')
      .eq('user_id', donoRow.user_id)
      .order('numero_bilhete', { ascending: true })
    tabelas = (rows ?? [])
      .filter((r): r is typeof r & { bilhete_id: string } => r.bilhete_id !== null)
      .map((r) => ({
        bilheteId: r.bilhete_id,
        numero: r.numero_bilhete ?? 0,
        pontos: r.pontos_totais ?? 0,
        posicao: r.posicao ?? 0,
        exatos: r.acertos_exatos ?? 0,
      }))
  }
  const self = tabelas.find((t) => t.bilheteId === params.bilheteId) ?? null

  const { count } = await supabase.from('ranking').select('*', { count: 'exact', head: true })

  // forma (últimos 5) da tabela pedida — via admin (jogos finalizados, públicos)
  let forma: string[] = []
  if (donoUserId) {
    const admin = createSupabaseAdminClient()
    const formaMap = await calcularForma(admin, [
      { userId: donoUserId, melhorBilheteId: params.bilheteId },
    ])
    forma = formaMap.get(donoUserId) ?? []
  }

  // palpites por jogo TRAVADO (RLS já libera só os iniciados)
  const agoraIso = new Date().toISOString()
  const { data: jogosTravados } = await supabase
    .from('jogos')
    .select(
      'id, numero_jogo, data_hora, finalizado, gols_casa, gols_fora, placeholder_casa, placeholder_fora, ' +
        'selecao_casa:selecoes!selecao_casa_id(nome, bandeira_emoji), ' +
        'selecao_fora:selecoes!selecao_fora_id(nome, bandeira_emoji)',
    )
    .lte('data_hora', agoraIso)
    .order('data_hora', { ascending: false })

  const { data: meusPalps } = await supabase
    .from('palpites')
    .select('jogo_id, gols_casa, gols_fora, pontos_calculados')
    .eq('bilhete_id', params.bilheteId)
  const palpMap = new Map<number, { gc: number; gf: number; pts: number | null }>()
  for (const p of meusPalps ?? []) {
    palpMap.set(p.jogo_id, { gc: p.gols_casa, gf: p.gols_fora, pts: p.pontos_calculados })
  }

  type JogoTravado = {
    id: number
    numero_jogo: number | null
    data_hora: string
    finalizado: boolean | null
    gols_casa: number | null
    gols_fora: number | null
    placeholder_casa: string | null
    placeholder_fora: string | null
    selecao_casa: { nome: string; bandeira_emoji: string } | { nome: string; bandeira_emoji: string }[] | null
    selecao_fora: { nome: string; bandeira_emoji: string } | { nome: string; bandeira_emoji: string }[] | null
  }
  const palpites = ((jogosTravados as unknown as JogoTravado[]) ?? []).map((j) => {
    const c = Array.isArray(j.selecao_casa) ? j.selecao_casa[0] : j.selecao_casa
    const f = Array.isArray(j.selecao_fora) ? j.selecao_fora[0] : j.selecao_fora
    const meu = palpMap.get(j.id)
    return {
      numeroJogo: j.numero_jogo,
      dataHora: j.data_hora,
      casa: c?.nome ?? j.placeholder_casa ?? '?',
      fora: f?.nome ?? j.placeholder_fora ?? '?',
      bandeiraCasa: c?.bandeira_emoji ?? null,
      bandeiraFora: f?.bandeira_emoji ?? null,
      palpiteCasa: meu?.gc ?? null,
      palpiteFora: meu?.gf ?? null,
      realCasa: j.gols_casa,
      realFora: j.gols_fora,
      finalizado: j.finalizado,
      pontos: meu?.pts ?? null,
    }
  })

  return NextResponse.json({
    campeao,
    vice,
    terceiro,
    quarto,
    revelacao,
    artilheiro,
    numero: self?.numero ?? 0,
    pontos: self?.pontos ?? 0,
    posicao: self?.posicao ?? 0,
    exatos: self?.exatos ?? 0,
    forma,
    tabelas,
    totalTabelas: count ?? 0,
    palpites,
  })
}
