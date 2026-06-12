import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: Request,
  { params }: { params: { bilheteId: string } },
) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const admin = createSupabaseAdminClient()
  const { data: bonus } = await admin
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
  return NextResponse.json({ campeao, artilheiro })
}
