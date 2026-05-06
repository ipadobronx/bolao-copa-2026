import type { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchFixtures, fetchFixturesByDate, parseFixture, TEAM_NAME_MAP } from './api-football'
import { calcularUpdateJogo, calcularResolucoesPlaceholder } from './sync-jogos'
import { calcularUpdatesPalpites } from './recalculo'
import type { JogoBanco, JogoUpdate } from './sync-jogos'
import type { JogoFinalizado, PalpiteRow } from './recalculo'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export type SyncResult = {
  jogos_verificados: number
  jogos_atualizados: number
  placeholders_resolvidos: number
  erros: { jogo_id?: number; mensagem: string }[]
  status: 'sucesso' | 'parcial' | 'erro'
}

export async function runSync(
  admin: AdminClient,
  fonte: 'cron' | 'manual',
): Promise<SyncResult> {
  const erros: { jogo_id?: number; mensagem: string }[] = []
  let jogos_atualizados = 0
  let placeholders_resolvidos = 0
  const logId = await iniciarLog(admin, fonte)

  try {
    const agora = Date.now()
    const de = new Date(agora - 3 * 60 * 60 * 1000).toISOString()
    const ate = new Date(agora + 1 * 60 * 60 * 1000).toISOString()

    // 1. Busca jogos com external_id na janela
    const { data: jogosData, error: jogosErr } = await admin
      .from('jogos')
      .select('id, external_id, finalizado, gols_casa, gols_fora, selecao_casa_id, selecao_fora_id, placeholder_casa, placeholder_fora, numero_jogo, fase')
      .eq('finalizado', false)
      .not('external_id', 'is', null)
      .gte('data_hora', de)
      .lte('data_hora', ate)

    if (jogosErr) throw new Error(jogosErr.message)
    const jogosComId = (jogosData ?? []) as JogoBanco[]

    // 2. Lazy match para jogos sem external_id na janela
    const { data: semIdData } = await admin
      .from('jogos')
      .select('id, external_id, finalizado, gols_casa, gols_fora, selecao_casa_id, selecao_fora_id, placeholder_casa, placeholder_fora, numero_jogo, fase, data_hora, selecao_casa:selecoes!selecao_casa_id(nome), selecao_fora:selecoes!selecao_fora_id(nome)')
      .eq('finalizado', false)
      .is('external_id', null)
      .not('selecao_casa_id', 'is', null)
      .not('selecao_fora_id', 'is', null)
      .gte('data_hora', de)
      .lte('data_hora', ate)

    if ((semIdData ?? []).length > 0) {
      const today = new Date().toISOString().split('T')[0] ?? new Date().toISOString().substring(0, 10)
      try {
        const todayFixtures = await fetchFixturesByDate(today)
        for (const j of semIdData ?? []) {
          const casaNome = (j.selecao_casa as { nome: string } | null)?.nome
          const foraNome = (j.selecao_fora as { nome: string } | null)?.nome
          const matched = todayFixtures.find((f) => {
            const hNome = TEAM_NAME_MAP[f.teams.home.name]
            const aNome = TEAM_NAME_MAP[f.teams.away.name]
            if (!hNome || !aNome) return false
            if (hNome !== casaNome || aNome !== foraNome) return false
            const diff = Math.abs(new Date(f.fixture.date).getTime() - new Date(j.data_hora as string).getTime())
            return diff < 30 * 60 * 1000
          })
          if (matched) {
            const extId = String(matched.fixture.id)
            await admin.from('jogos').update({ external_id: extId }).eq('id', j.id)
            jogosComId.push({ ...(j as JogoBanco), external_id: extId })
          }
        }
      } catch {
        erros.push({ mensagem: 'lazy match falhou — API indisponível' })
      }
    }

    // 3. Early return se nenhum jogo na janela
    if (jogosComId.length === 0) {
      await finalizarLog(admin, logId, fonte, 0, 0, 0, [], 'sucesso')
      return { jogos_verificados: 0, jogos_atualizados: 0, placeholders_resolvidos: 0, erros: [], status: 'sucesso' }
    }

    // 4. Busca fixtures da API (1 request)
    const externalIds = jogosComId.map((j) => j.external_id!)
    const fixtures = await fetchFixtures(externalIds)
    const fixtureMap = new Map(fixtures.map((f) => [String(f.fixture.id), f]))

    // 5. Busca jogos dependentes (para resolução de placeholder)
    const { data: phData } = await admin
      .from('jogos')
      .select('id, external_id, finalizado, gols_casa, gols_fora, selecao_casa_id, selecao_fora_id, placeholder_casa, placeholder_fora, numero_jogo, fase')
      .or('selecao_casa_id.is.null,selecao_fora_id.is.null')
    const jogosComPlaceholder = (phData ?? []) as JogoBanco[]

    // 6. Processar cada jogo
    for (const jogo of jogosComId) {
      const fixture = fixtureMap.get(jogo.external_id!)
      if (!fixture) continue

      const parsed = parseFixture(fixture)
      const update = calcularUpdateJogo(jogo, parsed)
      if (!update) continue

      const { error: upErr } = await admin
        .from('jogos')
        .update({ gols_casa: update.gols_casa, gols_fora: update.gols_fora, finalizado: update.finalizado })
        .eq('id', jogo.id)
      if (upErr) { erros.push({ jogo_id: jogo.id, mensagem: upErr.message }); continue }

      jogos_atualizados++

      // 7. Recálculo e placeholder apenas quando jogo acabou de ser finalizado
      if (update.finalizado && !jogo.finalizado) {
        try {
          await recalcularJogo(admin, jogo, update)
        } catch (e) {
          erros.push({ jogo_id: jogo.id, mensagem: `Recálculo falhou: ${e instanceof Error ? e.message : 'erro'}` })
        }

        const jogoParaPlaceholder = {
          ...update,
          selecao_casa_id: jogo.selecao_casa_id!,
          selecao_fora_id: jogo.selecao_fora_id!,
          numero_jogo: jogo.numero_jogo,
        }
        const penaltyWinnerSide = parsed?.penaltyWinnerSide ?? null
        const { updates: phUpdates, warnings: phWarnings } = calcularResolucoesPlaceholder(
          jogoParaPlaceholder,
          jogosComPlaceholder,
          penaltyWinnerSide,
        )
        for (const ph of phUpdates) {
          const payload: { selecao_casa_id?: number; selecao_fora_id?: number } = {}
          if (ph.selecao_casa_id !== undefined) payload.selecao_casa_id = ph.selecao_casa_id
          if (ph.selecao_fora_id !== undefined) payload.selecao_fora_id = ph.selecao_fora_id
          await admin.from('jogos').update(payload).eq('id', ph.id)
          placeholders_resolvidos++
        }
        for (const w of phWarnings) {
          erros.push({ jogo_id: w.jogo_id, mensagem: w.motivo })
        }
      }
    }

    const status = erros.length === 0 ? 'sucesso' : jogos_atualizados > 0 ? 'parcial' : 'erro'
    await finalizarLog(admin, logId, fonte, jogosComId.length, jogos_atualizados, placeholders_resolvidos, erros, status)
    return { jogos_verificados: jogosComId.length, jogos_atualizados, placeholders_resolvidos, erros, status }
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'Erro desconhecido'
    erros.push({ mensagem })
    await finalizarLog(admin, logId, fonte, 0, 0, 0, erros, 'erro')
    return { jogos_verificados: 0, jogos_atualizados: 0, placeholders_resolvidos: 0, erros, status: 'erro' }
  }
}

async function recalcularJogo(admin: AdminClient, jogo: JogoBanco, update: JogoUpdate) {
  const jogoFinalizado: JogoFinalizado = {
    fase: jogo.fase as JogoFinalizado['fase'],
    gols_casa: update.gols_casa,
    gols_fora: update.gols_fora,
  }
  const { data: bilhetes } = await admin.from('bilhetes').select('id').eq('status_pagamento', 'confirmado')
  const confirmedIds = (bilhetes ?? []).map((b) => b.id)
  if (confirmedIds.length === 0) return

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

  const updates = calcularUpdatesPalpites(palpites, jogoFinalizado)
  if (updates.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await admin.from('palpites').upsert(updates as any, { onConflict: 'id' })
  }
}

async function iniciarLog(admin: AdminClient, fonte: 'cron' | 'manual'): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any).from('sync_jogos_log').insert({ fonte, status: 'processando' }).select('id').single()
  return (data?.id as string | undefined) ?? ''
}

async function finalizarLog(
  admin: AdminClient,
  logId: string,
  fonte: 'cron' | 'manual',
  jogos_verificados: number,
  jogos_atualizados: number,
  placeholders_resolvidos: number,
  erros: { jogo_id?: number; mensagem: string }[],
  status: 'sucesso' | 'parcial' | 'erro',
) {
  // sync_jogos_log is not yet in generated types — cast to any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbl = (admin as any).from('sync_jogos_log')
  if (!logId) {
    await tbl.insert({
      fonte, jogos_verificados, jogos_atualizados, placeholders_resolvidos, erros, status,
      finalizado_em: new Date().toISOString(),
    })
    return
  }
  await tbl.update({
    jogos_verificados, jogos_atualizados, placeholders_resolvidos, erros, status,
    finalizado_em: new Date().toISOString(),
  }).eq('id', logId)
}
