// components/dashboard/CardProgresso.tsx
import { CheckCircle2 } from 'lucide-react'
import { DashboardStatCard } from './DashboardStatCard'

export type CardProgressoProps = {
  porcentagem: number
  preenchidos: number
  total: number
  totalBilhetes: number
}

export function CardProgresso({ porcentagem, preenchidos, total, totalBilhetes }: CardProgressoProps) {
  return (
    <DashboardStatCard label="Palpites" icon={<CheckCircle2 className="size-5" />} colorClass="green">
      <div className="font-display text-4xl tracking-wide">{porcentagem}%</div>
      <div
        className="bg-bg-elevated mt-3 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Palpites preenchidos"
        aria-valuenow={porcentagem}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="bg-accent h-full transition-[width]"
          style={{ width: `${porcentagem}%` }}
        />
      </div>
      <div className="text-text-muted mt-2 font-mono text-xs">
        {preenchidos}/{total} palpites preenchidos
        {totalBilhetes > 1 ? ` · ${totalBilhetes} tabelas` : ''}
      </div>
    </DashboardStatCard>
  )
}
