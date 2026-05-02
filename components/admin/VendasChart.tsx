'use client'

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
} from 'recharts'
import { formatBRL } from '@/lib/format/brl'

export type VendaDia = {
  date: string    // YYYY-MM-DD
  tabelas: number
  receita: number
  label: string   // SEG, TER, etc — pré-calculado no server
}

function CustomTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length || !payload[0]) return null
  const { date, tabelas, receita } = payload[0].payload as VendaDia
  return (
    <div className="bg-bg-elevated border-border rounded-lg border px-3 py-2 font-mono text-xs shadow-lg">
      <div className="text-text-muted mb-1">{date}</div>
      <div className="text-text-primary font-semibold">
        {tabelas} {tabelas === 1 ? 'tabela' : 'tabelas'}
      </div>
      <div className="text-accent">{formatBRL(receita)}</div>
    </div>
  )
}

export function VendasChart({ data }: { data: VendaDia[] }) {
  const hasData = data.some((d) => d.tabelas > 0)

  if (!hasData) {
    return (
      <div className="text-text-muted flex h-[200px] items-center justify-center text-sm">
        Nenhuma venda nos últimos 7 dias.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}
        />
        <Tooltip content={(props) => <CustomTooltip {...props} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar
          dataKey="tabelas"
          fill="var(--color-accent)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
