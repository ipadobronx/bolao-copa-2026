import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type Tabela = { bilheteId: string; numero: number; pontos: number; posicao: number }

export async function GET(
  _req: Request,
  { params }: { params: { bilheteId: string } },
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // bônus do bilhete (RLS: visível pós-início)
  const { data: bonus } = await supabase
    .from('palpites_bonus')
    .select('tipo, jogador_nome, selecao:selecoes!selecao_id(nome, bandeira_emoji)')
    .eq('bilhete_id', params.bilheteId)
    .in('tipo', ['campeao', 'artilheiro'])

  let campeao: { nome: string; bandeira: string } | null = null
  let artilheiro: string | null = null
  for (const b of bonus ?? []) {
    if (b.tipo === 'campeao') {
      const sel = Array.isArray(b.selecao) ? b.selecao[0] : b.selecao
      if (sel) campeao = { nome: sel.nome, bandeira: sel.bandeira_emoji }
    } else if (b.tipo === 'artilheiro') {
      artilheiro = b.jogador_nome ?? null
    }
  }

  // tabelas do dono — user_id vem da própria view `ranking` (legível p/ autenticado,
  // evita o RLS de `bilhetes` que bloquearia ler bilhete de outro usuário)
  let tabelas: Tabela[] = []
  const { data: donoRow } = await supabase
    .from('ranking')
    .select('user_id')
    .eq('bilhete_id', params.bilheteId)
    .maybeSingle()
  if (donoRow?.user_id) {
    const { data: rows } = await supabase
      .from('ranking')
      .select('bilhete_id, numero_bilhete, pontos_totais, posicao')
      .eq('user_id', donoRow.user_id)
      .order('numero_bilhete', { ascending: true })
    tabelas = (rows ?? [])
      .filter((r): r is typeof r & { bilhete_id: string } => r.bilhete_id !== null)
      .map((r) => ({
        bilheteId: r.bilhete_id,
        numero: r.numero_bilhete ?? 0,
        pontos: r.pontos_totais ?? 0,
        posicao: r.posicao ?? 0,
      }))
  }

  const { count } = await supabase
    .from('ranking')
    .select('*', { count: 'exact', head: true })

  // palpites por jogo TRAVADO (RLS `palpites_select_own_or_started` já libera só os iniciados).
  // Lista todos os jogos já iniciados; anexa o palpite da melhor tabela (bilheteId) ou null.
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
  const palpites = (jogosTravados as unknown as JogoTravado[] ?? []).map((j) => {
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

  return NextResponse.json({ campeao, artilheiro, tabelas, totalTabelas: count ?? 0, palpites })
}
