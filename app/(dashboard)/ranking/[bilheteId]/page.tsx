// app/(dashboard)/ranking/[bilheteId]/page.tsx
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PerfilPublico } from '@/components/ranking/PerfilPublico'

export default async function PerfilPublicoPage({
  params,
}: {
  params: { bilheteId: string }
}) {
  const supabase = await createSupabaseServerClient()

  const [{ data: rankingRow }, { data: bilhete }] = await Promise.all([
    supabase
      .from('ranking')
      .select('user_id, nome, posicao, pontos_totais, acertos_exatos')
      .eq('bilhete_id', params.bilheteId)
      .single(),
    supabase
      .from('bilhetes')
      .select('numero_bilhete, valor_pago, selecao_cashback_id, status_pagamento')
      .eq('id', params.bilheteId)
      .single(),
  ])

  if (!rankingRow || !bilhete || bilhete.status_pagamento !== 'confirmado') notFound()

  const { data: totalRow } = await supabase
    .from('ranking_usuarios')
    .select('total_bilhetes')
    .eq('user_id', rankingRow.user_id ?? '')
    .single()

  let selecaoCashback: { nome: string; bandeira: string } | null = null
  if (bilhete.selecao_cashback_id) {
    const { data: selecao } = await supabase
      .from('selecoes')
      .select('nome, bandeira_emoji')
      .eq('id', bilhete.selecao_cashback_id)
      .single()
    if (selecao) selecaoCashback = { nome: selecao.nome, bandeira: selecao.bandeira_emoji }
  }

  return (
    <PerfilPublico
      userId={rankingRow.user_id ?? ''}
      nome={rankingRow.nome ?? ''}
      numeroBilhete={bilhete.numero_bilhete}
      totalBilhetes={totalRow?.total_bilhetes ?? 1}
      posicao={rankingRow.posicao ?? 0}
      pontosTotais={rankingRow.pontos_totais ?? 0}
      acertosExatos={rankingRow.acertos_exatos ?? 0}
      selecaoCashback={selecaoCashback}
      valorPago={bilhete.valor_pago}
    />
  )
}
