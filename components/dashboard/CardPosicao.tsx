// components/dashboard/CardPosicao.tsx
import { TrendingUp } from 'lucide-react'
import { DashboardStatCard } from './DashboardStatCard'
import { TrendIndicator } from './TrendIndicator'

export type CardPosicaoProps = {
  posicao: number
  totalParticipantes: number
  tendencia: number | null
}

export function CardPosicao({ posicao, totalParticipantes, tendencia }: CardPosicaoProps) {
  return (
    <DashboardStatCard label="Posição" icon={<TrendingUp className="size-5" />} colorClass="blue">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-4xl tracking-wide">#{posicao}</span>
        {tendencia !== null && <TrendIndicator delta={tendencia} />}
      </div>
      <div className="text-text-muted mt-1 font-mono text-xs">
        de {totalParticipantes.toLocaleString('pt-BR')} participantes
      </div>
    </DashboardStatCard>
  )
}
