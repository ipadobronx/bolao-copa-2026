import { cn } from '@/lib/utils'

type KpiCardProps = {
  label: string
  value: string
  icon: string
  colorClass: 'green' | 'yellow' | 'blue' | 'red'
  /** Destaque visual (cor do valor + fundo + ícone maior). Usar pra 1 card por bloco. */
  featured?: boolean | undefined
  /** Texto secundário pequeno abaixo do valor (ex: "vs ontem"). */
  hint?: string | undefined
}

const COLOR: Record<KpiCardProps['colorClass'], string> = {
  green:  'bg-success/10 text-success',
  yellow: 'bg-accent/10 text-accent',
  blue:   'bg-info/10 text-info',
  red:    'bg-danger/10 text-danger',
}

const FEATURED_VALUE_COLOR: Record<KpiCardProps['colorClass'], string> = {
  green:  'text-success',
  yellow: 'text-accent',
  blue:   'text-info',
  red:    'text-danger',
}

export function KpiCard({ label, value, icon, colorClass, featured, hint }: KpiCardProps) {
  return (
    <div
      className={cn(
        'panel flex items-center gap-4 p-5',
        featured && 'border-accent/30',
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'flex flex-shrink-0 items-center justify-center rounded-xl',
          featured ? 'h-14 w-14 text-3xl' : 'h-12 w-12 text-2xl',
          COLOR[colorClass],
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-text-muted text-xs font-medium uppercase tracking-wide">
          {label}
        </div>
        <div
          className={cn(
            'font-display mt-0.5 tracking-wide',
            featured
              ? cn('text-3xl sm:text-4xl', FEATURED_VALUE_COLOR[colorClass])
              : 'text-text-primary text-2xl',
          )}
        >
          {value}
        </div>
        {hint && (
          <div className="font-mono text-text-muted mt-0.5 text-[10px] uppercase tracking-wider">
            {hint}
          </div>
        )}
      </div>
    </div>
  )
}
