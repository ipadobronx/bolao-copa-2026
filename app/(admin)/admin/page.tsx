import { KpiCard } from '@/components/admin/KpiCard'
import { SnapshotRanking } from '@/components/admin/SnapshotRanking'
import { UltimosPagamentos, type PagamentoRow } from '@/components/admin/UltimosPagamentos'
import { VendasChart, type VendaDia } from '@/components/admin/VendasChart'
import { formatBRL } from '@/lib/format/brl'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRpc = SupabaseClient<any>

type KpisRow = {
  tabelas_vendidas: number
  apostadores: number
  arrecadado: number
  pendentes: number
}

type VendasRow = { date: string; tabelas: number; receita: number }

function fillVendasDiarias(rows: VendasRow[]): VendaDia[] {
  const DIAS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
  const result: VendaDia[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0] as string
    const found = rows.find((r) => r.date === dateStr)
    result.push({
      date: dateStr,
      tabelas: found?.tabelas ?? 0,
      receita: Number(found?.receita ?? 0),
      label: DIAS[d.getDay()] as string,
    })
  }
  return result
}

export default async function AdminPage() {
  const admin = createSupabaseAdminClient()
  // Cast to bypass strict generated-types for custom RPCs not yet in Database schema
  const rpc = admin as unknown as AnyRpc

  const [kpisRes, pagamentosRes, vendasRes] = await Promise.all([
    rpc.rpc('admin_overview_kpis'),
    rpc.rpc('admin_ultimos_pagamentos', { lim: 10 }),
    rpc.rpc('admin_vendas_diarias'),
  ])

  const kpisRow = (kpisRes.data as KpisRow[] | null)?.[0]
  const kpis: KpisRow = kpisRow ?? {
    tabelas_vendidas: 0,
    apostadores: 0,
    arrecadado: 0,
    pendentes: 0,
  }

  const pagamentos = ((pagamentosRes.data as PagamentoRow[] | null) ?? []) as PagamentoRow[]
  const vendas = fillVendasDiarias((vendasRes.data as VendasRow[] | null) ?? [])
  const agora = new Date()

  return (
    <section>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-text-primary text-4xl tracking-wide">
          Painel <span className="text-danger">Admin</span>
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          Copa 2026 · Visão geral do sistema
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Arrecadado"
          value={formatBRL(Number(kpis.arrecadado))}
          icon="💰"
          colorClass="green"
        />
        <KpiCard
          label="Tabelas vendidas"
          value={String(kpis.tabelas_vendidas)}
          icon="🎫"
          colorClass="yellow"
        />
        <KpiCard
          label="Apostadores"
          value={String(kpis.apostadores)}
          icon="👥"
          colorClass="blue"
        />
        <KpiCard
          label="Pagamentos pendentes"
          value={String(kpis.pendentes)}
          icon="⏳"
          colorClass="red"
        />
      </div>

      {/* Grid: pagamentos + vendas */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Últimos pagamentos */}
        <div className="panel">
          <div className="panel-header">
            <span className="text-text-primary text-sm font-semibold">Últimos pagamentos</span>
          </div>
          <UltimosPagamentos rows={pagamentos} agora={agora} />
        </div>

        {/* Vendas por dia */}
        <div className="panel">
          <div className="panel-header">
            <span className="text-text-primary text-sm font-semibold">Vendas por dia</span>
            <span className="text-text-muted font-mono text-xs">Últimos 7 dias</span>
          </div>
          <div className="p-6">
            <VendasChart data={vendas} />
          </div>
        </div>
      </div>

      {/* Ações do sistema */}
      <div className="panel">
        <div className="panel-header">
          <span className="text-text-primary text-sm font-semibold">Ações do sistema</span>
        </div>
        <div className="p-6">
          <SnapshotRanking />
        </div>
      </div>
    </section>
  )
}
