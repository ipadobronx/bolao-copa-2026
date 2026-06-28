// components/dashboard/CardFaseDestaque.tsx
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FaseDestaque } from '@/lib/dashboard/fase-destaque'

/**
 * Card de destaque no topo do dashboard: anuncia a fase atual do mata-mata e o
 * multiplicador de pontos vigente. Renderizado só quando há multiplicador a
 * destacar (ver `faseDestaque`). Visual fiel ao design system (dark + accent).
 */
export function CardFaseDestaque({ titulo, multiplicadorLabel, gradient }: FaseDestaque) {
  return (
    <div className="panel relative mb-6 overflow-hidden border border-accent/30 p-5">
      {/* faixa de gradiente da fase (paridade visual com a landing) */}
      <div
        aria-hidden="true"
        className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', gradient)}
      />
      <div className="text-text-muted flex items-center gap-2">
        <Zap className="text-accent size-4" />
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider">
          Fase atual
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-display text-3xl leading-none tracking-wide sm:text-4xl">
            {titulo}
          </div>
          <p className="text-text-muted mt-2 text-xs sm:text-sm">
            Mata-mata: cada acerto vale mais. Capricha no palpite!
          </p>
        </div>
        <div className="text-right">
          <div className="text-text-muted font-mono text-[10px] uppercase tracking-wider">
            pontos valendo
          </div>
          <div className="text-accent font-mono text-4xl font-bold tabular-nums sm:text-5xl">
            {multiplicadorLabel}
          </div>
        </div>
      </div>
    </div>
  )
}
