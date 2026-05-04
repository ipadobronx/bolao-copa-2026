import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { runSync } from '@/lib/sync-runner'

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
  const result = await runSync(admin, 'manual')
  return NextResponse.json(result)
}
