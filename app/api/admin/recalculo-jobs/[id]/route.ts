import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const TIMEOUT_MINUTOS = 10

type AdminAuthError = { error: string; status: 401 | 403 }
type AdminAuthOk = { admin: ReturnType<typeof createSupabaseAdminClient> }

async function verificarAdmin(): Promise<AdminAuthError | AdminAuthOk> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 }
  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Acesso negado', status: 403 }
  return { admin: createSupabaseAdminClient() }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  const { id } = await params

  const { data: job, error } = await admin
    .from('recalculo_jobs')
    .select('id, status, total_processados, erro_msg, started_at, finished_at')
    .eq('id', id)
    .single()

  if (error || !job) return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })

  // Watchdog: job stuck in 'processando' for > TIMEOUT_MINUTOS → auto-mark as erro
  if (job.status === 'processando') {
    const startedAt = new Date(job.started_at)
    const minutosDecorridos = (Date.now() - startedAt.getTime()) / 60_000
    if (minutosDecorridos > TIMEOUT_MINUTOS) {
      const erroMsg = `Timeout: processo não respondeu após ${TIMEOUT_MINUTOS} minutos`
      await admin
        .from('recalculo_jobs')
        .update({ status: 'erro', erro_msg: erroMsg, finished_at: new Date().toISOString() })
        .eq('id', id)
      return NextResponse.json({ ...job, status: 'erro', erro_msg: erroMsg })
    }
  }

  return NextResponse.json(job)
}
