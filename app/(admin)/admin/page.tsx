import { DateRangePicker } from '@/components/admin/DateRangePicker'
import { KpiCard } from '@/components/admin/KpiCard'
import { RecalculoGlobalStatus } from '@/components/admin/RecalculoGlobalStatus'
import { SnapshotRanking } from '@/components/admin/SnapshotRanking'
import { UltimosPagamentos, type PagamentoRow } from '@/components/admin/UltimosPagamentos'
import { VendasChart, type VendaDia } from '@/components/admin/VendasChart'
import { parseRangeFromParams } from '@/lib/admin/date-range'
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

type SnapshotRow = {
  vendas_hoje: number
  vendas_semana: number
  vendas_mes: number
  vendas_total: number
}

type PeriodoRow = {
  vendas: number
  bilhetes_confirmados: number
  bilhetes_criados: number
  ticket_medio: number
  conversao_pix: number
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

const PRESET_LABELS: Record<string, string> = {
  hoje: 'hoje',
  ontem: 'ontem',
  '7d': 'últimos 7 dias',
  '30d': 'últimos 30 dias',
  custom: 'período custom',
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1).replace('.', ',')}%`
}

type SearchParams = { preset?: string; from?: string; to?: string }

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>
}) {
  const sp = await searchParams
  const { range, preset } = parseRangeFromParams(sp)

  const admin = createSupabaseAdminClient()
  const rpc = admin as unknown as AnyRpc

  const [kpisRes, pagamentosRes, vendasRes, snapshotRes, periodoRes] = await Promise.all([
    rpc.rpc('admin_overview_kpis'),
    rpc.rpc('admin_ultimos_pagamentos', { lim: 10 }),
    rpc.rpc('admin_vendas_diarias'),
    rpc.rpc('admin_vendas_snapshot'),
    rpc.rpc('admin_kpis_periodo', {
      p_from: range.from.toISOString(),
      p_to: range.to.toISOString(),
    }),
  ])

  const kpisRow = (kpisRes.data as KpisRow[] | null)?.[0]
  const kpis: KpisRow = kpisRow ?? {
    tabelas_vendidas: 0,
    apostadores: 0,
    arrecadado: 0,
    pendentes: 0,
  }

  const snapshotRow = (snapshotRes.data as SnapshotRow[] | null)?.[0]
  const snapshot: SnapshotRow = snapshotRow ?? {
    vendas_hoje: 0,
    vendas_semana: 0,
    vendas_mes: 0,
    vendas_total: 0,
  }

  const periodoRow = (periodoRes.data as PeriodoRow[] | null)?.[0]
  const periodo: PeriodoRow = periodoRow ?? {
    vendas: 0,
    bilhetes_confirmados: 0,
    bilhetes_criados: 0,
    ticket_medio: 0,
    conversao_pix: 0,
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

      {/* Snapshot fixo de vendas */}
      <div className="mb-8">
        <h2 className="text-text-secondary mb-3 font-mono text-xs uppercase tracking-wider">
          Snapshot de vendas
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Vendas hoje"
            value={formatBRL(Number(snapshot.vendas_hoje))}
            icon="🔥"
            colorClass="green"
            featured
          />
          <KpiCard
            label="Vendas 7 dias"
            value={formatBRL(Number(snapshot.vendas_semana))}
            icon="📅"
            colorClass="yellow"
          />
          <KpiCard
            label="Vendas mês"
            value={formatBRL(Number(snapshot.vendas_mes))}
            icon="📆"
            colorClass="blue"
          />
          <KpiCard
            label="Vendas totais"
            value={formatBRL(Number(snapshot.vendas_total))}
            icon="💰"
            colorClass="green"
          />
        </div>
      </div>

      {/* KPIs operacionais (overview F9 — preservados) */}
      <div className="mb-8">
        <h2 className="text-text-secondary mb-3 font-mono text-xs uppercase tracking-wider">
          Operacional
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Arrecadado"
            value={formatBRL(Number(kpis.arrecadado))}
            icon="💵"
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
      </div>

      {/* Análise por período (com filtro) */}
      <div className="mb-8">
        <h2 className="text-text-secondary mb-3 font-mono text-xs uppercase tracking-wider">
          Análise por período
        </h2>
        <DateRangePicker preset={preset} from={range.from} to={range.to} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Vendas no período"
            value={formatBRL(Number(periodo.vendas))}
            icon="💹"
            colorClass="green"
            hint={PRESET_LABELS[preset]}
          />
          <KpiCard
            label="Bilhetes confirmados"
            value={String(periodo.bilhetes_confirmados)}
            icon="✅"
            colorClass="yellow"
            hint={PRESET_LABELS[preset]}
          />
          <KpiCard
            label="Ticket médio"
            value={formatBRL(Number(periodo.ticket_medio))}
            icon="🧾"
            colorClass="blue"
            hint={PRESET_LABELS[preset]}
          />
          <KpiCard
            label="Conversão PIX"
            value={formatPct(Number(periodo.conversao_pix))}
            icon="⚡"
            colorClass={Number(periodo.conversao_pix) >= 0.5 ? 'green' : 'red'}
            hint={`${periodo.bilhetes_confirmados}/${periodo.bilhetes_criados}`}
          />
        </div>
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
          <div className="border-border mt-6 border-t pt-6">
            <p className="text-text-primary mb-3 text-sm font-semibold">Recálculo global de pontos</p>
            <RecalculoGlobalStatus />
          </div>
        </div>
      </div>
    </section>
  )
}
