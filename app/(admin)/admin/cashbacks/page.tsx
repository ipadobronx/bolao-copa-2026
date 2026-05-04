import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { CashbacksClient } from './CashbacksClient'

export default async function CashbacksPage() {
  const admin = createSupabaseAdminClient()

  const [kpisRes, bilhetesRes, selecoesRes, copaRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).rpc('admin_cashbacks_kpis'),
    admin
      .from('bilhetes')
      .select(
        'id, numero_bilhete, valor_pago, cashback_multiplicador_snapshot, cashback_pago, cashback_pago_em, cashback_pago_por, selecao_cashback_id, user_id',
      )
      .eq('status_pagamento', 'confirmado')
      .not('selecao_cashback_id', 'is', null)
      .gte('valor_pago', 100)
      .order('numero_bilhete', { ascending: true }),
    admin
      .from('selecoes')
      .select('id, nome, codigo_iso, bandeira_emoji, cashback_multiplicador')
      .gt('cashback_multiplicador', 0)
      .order('cashback_multiplicador', { ascending: true }),
    admin.from('copa_resultados').select('finalizada, campeao_id').eq('id', 1).single(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bilhetes = (bilhetesRes.data ?? []) as any[]

  // Busca nomes de apostadores e dos admins que pagaram numa query única
  const userIds = [
    ...new Set([
      ...bilhetes.map((b) => b.user_id).filter(Boolean),
      ...bilhetes.map((b) => b.cashback_pago_por).filter(Boolean),
    ]),
  ] as string[]

  const { data: profiles } =
    userIds.length > 0
      ? await admin.from('profiles').select('id, nome').in('id', userIds)
      : { data: [] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.nome as string]))

  const bilhetesComNomes = bilhetes.map((b) => ({
    ...b,
    apostador_nome: profileMap.get(b.user_id as string) ?? '—',
    pago_por_nome: b.cashback_pago_por
      ? (profileMap.get(b.cashback_pago_por as string) ?? '—')
      : null,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kpis = ((kpisRes as any).data as any[])?.[0] ?? {
    exposicao_total: 0,
    pior_cenario_selecao: '—',
    pior_cenario_valor: 0,
    bilhetes_elegiveis: 0,
    a_pagar_agora: null,
  }

  return (
    <section>
      <div className="mb-8">
        <h1 className="font-display text-text-primary text-4xl tracking-wide">
          Cash<span className="text-accent">backs</span>
        </h1>
        <p className="text-text-muted mt-1 text-sm">Copa 2026 · Exposição financeira por seleção</p>
      </div>
      <CashbacksClient
        kpis={kpis}
        bilhetes={bilhetesComNomes}
        selecoes={selecoesRes.data ?? []}
        copaResultados={copaRes.data ?? { finalizada: false, campeao_id: null }}
      />
    </section>
  )
}
