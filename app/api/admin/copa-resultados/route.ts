import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { calcularUpdateBonus } from '@/lib/recalculo'
import type { TipoBonus } from '@/lib/pontuacao'
import type { BonusRow } from '@/lib/recalculo'

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

export async function GET() {
  const auth = await verificarAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.admin
    .from('copa_resultados')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

const CAMPO_PARA_TIPO: Record<string, TipoBonus> = {
  campeao_id:      'campeao',
  vice_id:         'vice',
  terceiro_id:     'terceiro',
  quarto_id:       'quarto',
  artilheiro_nome: 'artilheiro',
  revelacao_id:    'revelacao',
}

const putSchema = z.object({
  campeao_id:      z.number().int().positive().nullable().optional(),
  vice_id:         z.number().int().positive().nullable().optional(),
  terceiro_id:     z.number().int().positive().nullable().optional(),
  quarto_id:       z.number().int().positive().nullable().optional(),
  artilheiro_nome: z.string().min(1).nullable().optional(),
  revelacao_id:    z.number().int().positive().nullable().optional(),
  finalizada:      z.boolean().optional(),
})

export async function PUT(req: Request) {
  const auth = await verificarAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { admin } = auth

  const raw = await req.json().catch(() => null)
  const parsed = putSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const body = parsed.data

  if (body.finalizada === true) {
    const { data: current } = await admin
      .from('copa_resultados').select('*').eq('id', 1).single()
    const merged = { ...current, ...body }
    if (!merged.campeao_id || !merged.vice_id || !merged.terceiro_id ||
        !merged.quarto_id  || !merged.artilheiro_nome) {
      return NextResponse.json(
        { error: 'Preencha campeão, vice, 3º, 4º e artilheiro antes de finalizar' },
        { status: 400 },
      )
    }
  }

  const updateFields = Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined),
  )
  const { error: updateErr } = await admin
    .from('copa_resultados')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updateFields as any)
    .eq('id', 1)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  const tiposAfetados = Object.keys(body)
    .filter((k) => k in CAMPO_PARA_TIPO && body[k as keyof typeof body] !== undefined)
    .map((k) => CAMPO_PARA_TIPO[k]) as TipoBonus[]

  if (tiposAfetados.length === 0) {
    return NextResponse.json({ updated: true, total_bonus_recalculados: 0 })
  }

  let totalBonus = 0
  try {
    const { data: copaData } = await admin
      .from('copa_resultados').select('*').eq('id', 1).single()
    const { data: confirmedBilhetes } = await admin
      .from('bilhetes').select('id').eq('status_pagamento', 'confirmado')
    const confirmedIds = confirmedBilhetes?.map((b) => b.id) ?? []

    if (copaData && confirmedIds.length > 0) {
      const { data: bonusData } = await admin
        .from('palpites_bonus')
        .select('id, tipo, selecao_id, jogador_nome')
        .in('bilhete_id', confirmedIds)
        .in('tipo', tiposAfetados)

      const bonusRows: BonusRow[] = (bonusData ?? []).map((b) => ({
        id: b.id,
        tipo: b.tipo as TipoBonus,
        selecao_id: b.selecao_id,
        jogador_nome: b.jogador_nome,
      }))

      const updates = calcularUpdateBonus(bonusRows, {
        campeao_id: copaData.campeao_id,
        vice_id: copaData.vice_id,
        terceiro_id: copaData.terceiro_id,
        quarto_id: copaData.quarto_id,
        artilheiro_nome: copaData.artilheiro_nome,
        revelacao_id: copaData.revelacao_id,
      }, tiposAfetados)

      if (updates.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await admin.from('palpites_bonus').upsert(updates as any, { onConflict: 'id' })
        totalBonus = updates.length
      }
    }
  } catch (e) {
    console.error('[copa-resultados PUT] erro no recálculo de bônus:', e)
  }

  return NextResponse.json({ updated: true, total_bonus_recalculados: totalBonus })
}
