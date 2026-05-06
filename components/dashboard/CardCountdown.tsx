// components/dashboard/CardCountdown.tsx
import { Clock } from 'lucide-react'
import { DashboardStatCard } from './DashboardStatCard'
import { formatDiasHoras } from '@/lib/dashboard/countdown'

export type CardCountdownProps = {
  copaInicio: Date
  agora?: Date    // injectable pra testes (opcional; default = new Date())
}

export function CardCountdown({ copaInicio, agora = new Date() }: CardCountdownProps) {
  const { dias, horas } = formatDiasHoras(agora, copaInicio)
  return (
    <DashboardStatCard label="Copa começa em" icon={<Clock className="size-5" />} colorClass="red">
      <div className="flex items-baseline gap-3">
        <div>
          <span className="font-display text-4xl tracking-wide">{dias}</span>
          <span className="text-text-muted ml-1 text-sm">dias</span>
        </div>
        <div>
          <span className="font-display text-2xl tracking-wide">{horas}</span>
          <span className="text-text-muted ml-1 text-sm">h</span>
        </div>
      </div>
      <div className="text-text-muted mt-2 font-mono text-xs">11 de junho · Estados Unidos</div>
    </DashboardStatCard>
  )
}
