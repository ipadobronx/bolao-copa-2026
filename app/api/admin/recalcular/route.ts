import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { calcularUpdatesPalpites, calcularUpdateBonus } from '@/lib/recalculo'
import type { TipoBonus, CopaResultadosInput } from '@/lib/pontuacao'
import type { JogoFinalizado, PalpiteRow, BonusRow } from '@/lib/recalculo'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const tiposBonusEnum = z.enum([
  'campeao', 'vice', 'terceiro', 'quarto', 'artilheiro', 'revelacao',
])

const bodySchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('jogo'),
    jogoId: z.number().int().positive(),
    gols_casa: z.number().int().min(0).optional(),
    gols_fora: z.number().int().min(0).optional(),
  }),
  z.object({
    tipo: z.literal('bonus'),
    bonusTipos: z.array(tiposBonusEnum).optional(),
  }),
  z.object({ tipo: z.literal('global') }),
])

// ─── Helper: verificar admin ──────────────────────────────────────────────────

type AdminAuthError = { error: string; status: 401 | 403 }
type AdminAuthOk = { admin: ReturnType<typeof createSupabaseAdminClient> }

async function verificarAdmin(): Promise<AdminAuthError | AdminAuthOk> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return { error: 'Acesso negado', status: 403 }

  return { admin: createSupabaseAdminClient() }
}

// ─── Helper: recalcular bônus de uma lista de tipos ──────────────────────────

async function recalcularBonus(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  bonusTipos?: TipoBonus[],
): Promise<{ total: number; error?: string }> {
  const { data: copaData } = await admin
    .from('copa_resultados')
    .select('campeao_id, vice_id, terceiro_id, quarto_id, artilheiro_nome, revelacao_id')
    .eq('id', 1)
    .single()

  if (!copaData) return { total: 0 }

  const resultados: CopaResultadosInput = {
    campeao_id: copaData.campeao_id,
    vice_id: copaData.vice_id,
    terceiro_id: copaData.terceiro_id,
    quarto_id: copaData.quarto_id,
    artilheiro_nome: copaData.artilheiro_nome,
    revelacao_id: copaData.revelacao_id,
  }

  const { data: confirmedBilhetes } = await admin
    .from('bilhetes')
    .select('id')
    .eq('status_pagamento', 'confirmado')
  const confirmedIds = confirmedBilhetes?.map((b) => b.id) ?? []
  if (confirmedIds.length === 0) return { total: 0 }

  let query = admin
    .from('palpites_bonus')
    .select('id, tipo, selecao_id, jogador_nome')
    .in('bilhete_id', confirmedIds)

  if (bonusTipos && bonusTipos.length > 0) {
    query = query.in('tipo', bonusTipos)
  }

  const { data: bonusData, error: bonusErr } = await query
  if (bonusErr) return { total: 0, error: bonusErr.message }

  const bonusRows: BonusRow[] = (bonusData ?? []).map((b) => ({
    id: b.id,
    tipo: b.tipo as TipoBonus,
    selecao_id: b.selecao_id,
    jogador_nome: b.jogador_nome,
  }))

  const updates = calcularUpdateBonus(bonusRows, resultados, bonusTipos)
  if (updates.length > 0) {
    const { error: updateErr } = await admin
      .from('palpites_bonus')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(updates as any, { onConflict: 'id' })
    if (updateErr) return { total: 0, error: updateErr.message }
  }

  return { total: updates.length }
}

// ─── Helper: processamento global assíncrono (fire-and-forget) ───────────────

async function processarGlobal(
  jobId: string,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<void> {
  let total = 0

  try {
    const { data: confirmedBilhetes } = await admin
      .from('bilhetes')
      .select('id')
      .eq('status_pagamento', 'confirmado')
    const confirmedIds = confirmedBilhetes?.map((b) => b.id) ?? []

    const { data: jogosFinalizados } = await admin
      .from('jogos')
      .select('id, fase, gols_casa, gols_fora')
      .eq('finalizado', true)

    for (const jogo of jogosFinalizados ?? []) {
      if (jogo.gols_casa == null || jogo.gols_fora == null) continue

      const jogoInput: JogoFinalizado = {
        fase: jogo.fase as JogoFinalizado['fase'],
        gols_casa: jogo.gols_casa,
        gols_fora: jogo.gols_fora,
      }

      const { data: palpitesData } = await admin
        .from('palpites')
        .select('id, gols_casa, gols_fora')
        .eq('jogo_id', jogo.id)
        .in('bilhete_id', confirmedIds)

      const palpites: PalpiteRow[] = (palpitesData ?? []).map((p) => ({
        id: p.id,
        gols_casa: p.gols_casa,
        gols_fora: p.gols_fora,
      }))

      const updates = calcularUpdatesPalpites(palpites, jogoInput)
      if (updates.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await admin.from('palpites').upsert(updates as any, { onConflict: 'id' })
        total += updates.length
      }
    }

    const bonusResult = await recalcularBonus(admin)
    total += bonusResult.total

    await admin
      .from('recalculo_jobs')
      .update({ status: 'concluido', total_processados: total, finished_at: new Date().toISOString() })
      .eq('id', jobId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    await admin
      .from('recalculo_jobs')
      .update({ status: 'erro', erro_msg: msg, finished_at: new Date().toISOString() })
      .eq('id', jobId)
  }
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = await verificarAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { admin } = auth

  const raw = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const body = parsed.data

  // ── tipo: 'jogo' ──────────────────────────────────────────────────────────
  if (body.tipo === 'jogo') {
    const { jogoId, gols_casa, gols_fora } = body

    if (gols_casa !== undefined && gols_fora !== undefined) {
      const { error: jogoErr } = await admin
        .from('jogos')
        .update({ gols_casa, gols_fora, finalizado: true })
        .eq('id', jogoId)
      if (jogoErr) {
        return NextResponse.json({ error: jogoErr.message }, { status: 500 })
      }
    }

    const { data: jogoData, error: fetchJogoErr } = await admin
      .from('jogos')
      .select('fase, gols_casa, gols_fora, finalizado')
      .eq('id', jogoId)
      .single()

    if (fetchJogoErr || !jogoData) {
      return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })
    }
    if (!jogoData.finalizado) {
      return NextResponse.json({ error: 'Jogo não está finalizado' }, { status: 400 })
    }
    if (jogoData.gols_casa == null || jogoData.gols_fora == null) {
      return NextResponse.json({ error: 'Placar incompleto no banco' }, { status: 400 })
    }

    const jogo: JogoFinalizado = {
      fase: jogoData.fase as JogoFinalizado['fase'],
      gols_casa: jogoData.gols_casa,
      gols_fora: jogoData.gols_fora,
    }

    const { data: confirmedBilhetes } = await admin
      .from('bilhetes')
      .select('id')
      .eq('status_pagamento', 'confirmado')
    const confirmedIds = confirmedBilhetes?.map((b) => b.id) ?? []

    if (confirmedIds.length === 0) {
      return NextResponse.json({ total: 0 })
    }

    const { data: palpitesData, error: palpitesErr } = await admin
      .from('palpites')
      .select('id, gols_casa, gols_fora')
      .eq('jogo_id', jogoId)
      .in('bilhete_id', confirmedIds)

    if (palpitesErr) {
      return NextResponse.json({ error: palpitesErr.message }, { status: 500 })
    }

    const palpites: PalpiteRow[] = (palpitesData ?? []).map((p) => ({
      id: p.id,
      gols_casa: p.gols_casa,
      gols_fora: p.gols_fora,
    }))

    const updates = calcularUpdatesPalpites(palpites, jogo)
    if (updates.length > 0) {
      const { error: updateErr } = await admin
        .from('palpites')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(updates as any, { onConflict: 'id' })
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ total: updates.length })
  }

  // ── tipo: 'bonus' ────────────────────────────────────────────────────────
  if (body.tipo === 'bonus') {
    const result = await recalcularBonus(admin, body.bonusTipos as TipoBonus[] | undefined)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ total: result.total })
  }

  // ── tipo: 'global' ───────────────────────────────────────────────────────
  if (body.tipo === 'global') {
    const { data: job, error: jobErr } = await admin
      .from('recalculo_jobs')
      .insert({ escopo: 'global', status: 'processando' })
      .select('id')
      .single()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Falha ao criar job' }, { status: 500 })
    }

    // Vercel Fluid Compute keeps the process alive after the response returns,
    // so this Promise continues executing even after we send the 202.
    processarGlobal(job.id, createSupabaseAdminClient()).catch((err) => {
      console.error('[recalcular-global] erro não capturado:', err)
    })

    return NextResponse.json({ jobId: job.id }, { status: 202 })
  }

  return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
}
