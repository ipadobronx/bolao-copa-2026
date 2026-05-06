// components/dashboard/CardPontos.tsx
import { Trophy } from 'lucide-react'
import { DashboardStatCard } from './DashboardStatCard'
import { TrendIndicator } from './TrendIndicator'

export type CardPontosProps = {
  pontos: number
  numeroBilhete: number
  totalBilhetes: number
  tendencia: number | null
}

export function CardPontos({ pontos, numeroBilhete, totalBilhetes, tendencia }: CardPontosProps) {
  return (
    <DashboardStatCard label="Pontuação" icon={<Trophy className="size-5" />} colorClass="yellow">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-4xl tracking-wide">{pontos}</span>
        {tendencia !== null && <TrendIndicator delta={tendencia} unit="pts" />}
      </div>
      <div className="text-text-muted mt-1 font-mono text-xs">
        Bilhete #{numeroBilhete}
        {totalBilhetes > 1 ? ' · sua melhor tabela' : ''}
      </div>
    </DashboardStatCard>
  )
}
