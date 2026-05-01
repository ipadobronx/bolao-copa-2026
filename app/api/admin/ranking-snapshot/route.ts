import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const bodySchema = z.object({
  periodo: z.string().min(1),
  force: z.boolean().optional().default(false),
})

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const { periodo, force } = parsed.data
  const admin = createSupabaseAdminClient()

  if (!force) {
    const { data: existing } = await admin
      .from('ranking_snapshots')
      .select('id')
      .eq('periodo', periodo)
      .limit(1)
      .maybeSingle()
    if (existing) return NextResponse.json({ exists: true }, { status: 409 })
  }

  const { data: ranking } = await admin
    .from('ranking_usuarios')
    .select('user_id, posicao, pontos_totais')

  if (!ranking?.length) return NextResponse.json({ ok: true, count: 0 })

  const rows = ranking.map((r) => ({
    user_id: r.user_id!,
    posicao: r.posicao!,
    pontos_totais: r.pontos_totais!,
    periodo,
  }))

  const { error } = await admin
    .from('ranking_snapshots')
    .upsert(rows, { onConflict: 'user_id,periodo' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: rows.length })
}
