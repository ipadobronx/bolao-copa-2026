'use client'

import { BarChart2, CreditCard, Gift, LogOut, Swords, Users, type LucideIcon } from 'lucide-react'
import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

type NavItem = {
  label: string
  icon: LucideIcon
  href?: string
  comingSoon?: boolean
}

const ITEMS: NavItem[] = [
  { label: 'Overview', icon: BarChart2, href: '/admin' },
  { label: 'Apostadores', icon: Users, comingSoon: true },
  { label: 'Pagamentos', icon: CreditCard, comingSoon: true },
  { label: 'Jogos & Resultados', icon: Swords, href: '/admin/jogos' },
  { label: 'Cashbacks', icon: Gift, href: '/admin/cashbacks' },
]

export function AdminSidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Erro ao sair. Tenta de novo.')
      return
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <nav
      aria-label="Navegação admin"
      className={cn(
        'bg-bg-card border-border flex h-full flex-col border-r p-6',
        className,
      )}
    >
      {/* Logo */}
      <div className="font-display mb-8 flex items-center gap-2.5 px-2 text-2xl tracking-[2px]">
        <span
          aria-hidden="true"
          className="bg-danger text-bg-dark flex h-9 w-9 -rotate-[5deg] items-center justify-center rounded-lg text-xl font-black"
        >
          A
        </span>
        <span>
          ADMIN<span className="text-accent">26</span>
        </span>
      </div>

      {/* Nav items */}
      <div className="mb-6 space-y-1">
        <div className="text-text-muted mb-2 px-3 font-mono text-[10px] tracking-wider uppercase">
          Gestão
        </div>
        {ITEMS.map((item) => {
          const Icon = item.icon
          if (item.comingSoon) {
            return (
              <span
                key={item.label}
                aria-disabled="true"
                className="sidebar-item sidebar-item-disabled flex items-center justify-between"
                title="Em breve"
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </span>
                <span className="text-text-muted rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] tracking-wide uppercase">
                  em breve
                </span>
              </span>
            )
          }
          const active = pathname === item.href
          return (
            <Link
              key={item.label}
              href={item.href as Route}
              className={cn('sidebar-item', active && 'sidebar-item-active')}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </div>

      {/* Sign out */}
      <button type="button" onClick={handleSignOut} className="sign-out-btn">
        <LogOut className="size-4" aria-hidden="true" /> Sair
      </button>
    </nav>
  )
}
