import { cn } from '@/lib/utils'

type KpiCardProps = {
  label: string
  value: string
  icon: string
  colorClass: 'green' | 'yellow' | 'blue' | 'red'
}

const COLOR: Record<KpiCardProps['colorClass'], string> = {
  green:  'bg-success/10 text-success',
  yellow: 'bg-accent/10 text-accent',
  blue:   'bg-info/10 text-info',
  red:    'bg-danger/10 text-danger',
}

export function KpiCard({ label, value, icon, colorClass }: KpiCardProps) {
  return (
    <div className="panel flex items-center gap-4 p-5">
      <div
        aria-hidden="true"
        className={cn(
          'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-2xl',
          COLOR[colorClass],
        )}
      >
        {icon}
      </div>
      <div>
        <div className="text-text-muted text-xs font-medium uppercase tracking-wide">
          {label}
        </div>
        <div className="font-display text-text-primary mt-0.5 text-2xl tracking-wide">
          {value}
        </div>
      </div>
    </div>
  )
}
