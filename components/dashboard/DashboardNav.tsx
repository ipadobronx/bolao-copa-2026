'use client';

import {
  Award,
  DollarSign,
  Home,
  LogOut,
  Settings,
  ShoppingCart,
  Target,
  Ticket,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserBadge } from '@/components/dashboard/UserBadge';
import { cn } from '@/lib/utils';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type NavLink = {
  label: string;
  icon: LucideIcon;
  href?: string;
  disabledHint?: string;
};

const PRINCIPAL: NavLink[] = [
  { label: 'Dashboard', icon: Home, href: '/dashboard' },
  { label: 'Meus Palpites', icon: Trophy, href: '/palpites' },
  { label: 'Ranking', icon: Award, href: '/ranking' },
  { label: 'Bônus', icon: Target, href: '/palpites?tab=bonus' },
];

const CONTA: NavLink[] = [
  { label: 'Comprar tabela', icon: ShoppingCart, href: '/comprar' },
  { label: 'Minhas Tabelas', icon: Ticket, href: '/minhas-tabelas' },
  { label: 'Cashback', icon: DollarSign, disabledHint: 'Em breve (F11)' },
  { label: 'Configurações', icon: Settings, disabledHint: 'Em breve' },
];

export type DashboardNavProps = {
  className?: string;
  onItemClick?: () => void;
  // Optional user identity to render at the top of the nav. Used by the
  // mobile drawer (TopbarMobile) so the user knows whose account is open
  // while the dashboard header is hidden by the drawer overlay. Desktop
  // sidebar doesn't pass it because the dash-header already shows UserBadge.
  showUser?: { nome: string; email: string };
};

export function DashboardNav({ className, onItemClick, showUser }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Não consegui deslogar. Tenta de novo.');
      return;
    }
    onItemClick?.();
    router.push('/login');
    router.refresh();
  }

  return (
    <nav
      aria-label="Navegação do painel"
      className={cn('bg-bg-card border-border flex h-full flex-col border-r p-6', className)}
    >
      <div className="font-display mb-8 flex items-center gap-2.5 px-2 text-2xl tracking-[2px]">
        <span
          aria-hidden="true"
          className="bg-accent text-bg-dark flex h-9 w-9 -rotate-[5deg] items-center justify-center rounded-lg text-xl font-black"
        >
          B
        </span>
        <span>
          BOLÃO<span className="text-accent">26</span>
        </span>
      </div>

      {showUser ? (
        <div className="border-border mb-6 border-b pb-6">
          <UserBadge nome={showUser.nome} email={showUser.email} />
        </div>
      ) : null}

      <Section label="Principal">
        {PRINCIPAL.map((item) => (
          <NavItem
            key={item.label}
            item={item}
            pathname={pathname}
            {...(onItemClick ? { onClick: onItemClick } : {})}
          />
        ))}
      </Section>

      <Section label="Conta">
        {CONTA.map((item) => (
          <NavItem
            key={item.label}
            item={item}
            pathname={pathname}
            {...(onItemClick ? { onClick: onItemClick } : {})}
          />
        ))}
      </Section>

      <button type="button" onClick={handleSignOut} className="sign-out-btn">
        <LogOut className="size-4" aria-hidden="true" /> Sair
      </button>
    </nav>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-text-muted mb-2 px-3 font-mono text-[10px] tracking-wider uppercase">
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NavItem({
  item,
  pathname,
  onClick,
}: {
  item: NavLink;
  pathname: string | null;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  if (!item.href) {
    return (
      <span
        aria-disabled="true"
        {...(item.disabledHint ? { title: item.disabledHint } : {})}
        className="sidebar-item sidebar-item-disabled"
      >
        <Icon className="size-4" aria-hidden="true" /> {item.label}
      </span>
    );
  }
  const active = pathname === item.href;
  return (
    <Link
      href={item.href as Route}
      {...(onClick ? { onClick } : {})}
      className={cn('sidebar-item', active && 'sidebar-item-active')}
      {...(active ? { 'aria-current': 'page' as const } : {})}
    >
      <Icon className="size-4" aria-hidden="true" /> {item.label}
    </Link>
  );
}
