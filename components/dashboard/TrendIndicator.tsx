// components/dashboard/TrendIndicator.tsx
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TrendIndicatorProps = {
  delta: number
  unit?: 'pts' | 'pos'
  className?: string
}

export function TrendIndicator({ delta, unit, className }: TrendIndicatorProps) {
  if (delta === 0) {
    return (
      <span
        className={cn(
          'text-text-muted inline-flex items-center gap-1 text-xs font-medium',
          className,
        )}
        aria-label="sem variação"
      >
        <Minus className="size-3" />
      </span>
    )
  }

  const positivo = delta > 0
  const valor = Math.abs(delta)
  const sufixo = unit === 'pts' ? ' pts' : ''

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        positivo ? 'text-success' : 'text-danger',
        className,
      )}
      aria-label={positivo ? `subiu ${valor}${sufixo}` : `caiu ${valor}${sufixo}`}
    >
      {positivo ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {valor}
      {sufixo}
    </span>
  )
}
