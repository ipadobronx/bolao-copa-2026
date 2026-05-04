import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

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

const patchSchema = z.object({
  selecao_casa_id: z.number().int().positive().nullable().optional(),
  selecao_fora_id: z.number().int().positive().nullable().optional(),
}).refine(
  (d) => d.selecao_casa_id !== undefined || d.selecao_fora_id !== undefined,
  { message: 'Pelo menos um campo deve ser fornecido' },
)

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verificarAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const jogoId = Number(id)
  if (!Number.isInteger(jogoId) || jogoId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const raw = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const updateFields = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await auth.admin
    .from('jogos')
    .update(updateFields as any)
    .eq('id', jogoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updated: true })
}
