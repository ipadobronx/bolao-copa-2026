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

  return NextResponse.json({ campeao, artilheiro, tabelas, totalTabelas: count ?? 0 })
}
