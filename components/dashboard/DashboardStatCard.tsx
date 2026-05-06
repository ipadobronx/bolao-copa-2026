// components/dashboard/DashboardStatCard.tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ColorClass = 'green' | 'yellow' | 'blue' | 'red'

const COLOR: Record<ColorClass, string> = {
  green:  'bg-success/10 text-success',
  yellow: 'bg-accent/10 text-accent',
  blue:   'bg-info/10 text-info',
  red:    'bg-danger/10 text-danger',
}

export type DashboardStatCardProps = {
  label: string
  icon: ReactNode
  colorClass: ColorClass
  children: ReactNode
  className?: string
}

export function DashboardStatCard({
  label,
  icon,
  colorClass,
  children,
  className,
}: DashboardStatCardProps) {
  return (
    <div className={cn('panel p-5', className)}>
      <div className="mb-3 flex items-center gap-3">
        <div
          aria-hidden="true"
          className={cn(
            'flex size-10 flex-shrink-0 items-center justify-center rounded-xl',
            COLOR[colorClass],
          )}
        >
          {icon}
        </div>
        <span className="text-text-muted text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}
