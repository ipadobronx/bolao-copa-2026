import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { isElegivelPagamento } from '@/lib/cashback-pagamento'

const bodySchema = z.object({
  bilheteIds: z.array(z.string().uuid()).min(1).max(100),
})

async function verificarAdmin() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 as const, userId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return { error: 'Acesso negado', status: 403 as const, userId: null }

  return { error: null, status: null, userId: user.id }
}

export async function POST(req: Request) {
  const auth = await verificarAdmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status! })
  }
  const adminUserId = auth.userId!

  const raw = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { bilheteIds } = parsed.data

  const admin = createSupabaseAdminClient()

  const { data: copaData } = await admin
    .from('copa_resultados')
    .select('finalizada, campeao_id')
    .eq('id', 1)
    .single()

  const copa = {
    finalizada: copaData?.finalizada ?? false,
    campeao_id: copaData?.campeao_id ?? null,
  }

  const { data: bilhetes, error: bilhetesErr } = await admin
    .from('bilhetes')
    .select(
      'id, valor_pago, selecao_cashback_id, cashback_multiplicador_snapshot, cashback_pago, status_pagamento',
    )
    .in('id', bilheteIds)

  if (bilhetesErr) {
    return NextResponse.json({ error: bilhetesErr.message }, { status: 500 })
  }

  const bilhetesMap = new Map((bilhetes ?? []).map((b) => [b.id, b]))
  const idsParaMarcar: string[] = []
  let jaEstavamPagos = 0

  for (const id of bilheteIds) {
    const b = bilhetesMap.get(id)
    if (!b) {
      return NextResponse.json({ error: 'Bilhete não encontrado', bilheteId: id }, { status: 422 })
    }
    if (b.status_pagamento !== 'confirmado') {
      return NextResponse.json({ error: 'Bilhete não confirmado', bilheteId: id }, { status: 422 })
    }

    const resultado = isElegivelPagamento(b, copa)
    if (!resultado.elegivel) {
      if (resultado.motivo === 'ja_pago') {
        jaEstavamPagos++
        continue
      }
      return NextResponse.json({ error: resultado.motivo, bilheteId: id }, { status: 422 })
    }
    idsParaMarcar.push(id)
  }

  if (idsParaMarcar.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (admin.from('bilhetes') as any)
      .update({
        cashback_pago: true,
        cashback_pago_em: new Date().toISOString(),
        cashback_pago_por: adminUserId,
      })
      .in('id', idsParaMarcar)
      .eq('cashback_pago', false) // idempotência no banco
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    marcados: idsParaMarcar.length,
    ja_estavam_pagos: jaEstavamPagos,
    total_solicitados: bilheteIds.length,
  })
}
