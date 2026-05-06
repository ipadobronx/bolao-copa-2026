// components/dashboard/DashboardHeader.tsx
import { UserBadge } from '@/components/dashboard/UserBadge';

export type DashboardHeaderProps = {
  nome: string;
  email: string;
  subtitle: string;
  totalBilhetes?: number;
};

function primeiroNome(nome: string): string {
  const trimmed = nome.trim();
  if (!trimmed) return 'Apostador';
  return trimmed.split(/\s+/)[0]!;
}

export function DashboardHeader({ nome, email, subtitle, totalBilhetes }: DashboardHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-[38px] leading-none tracking-wide">
          Salve, <span className="text-accent">{primeiroNome(nome)}</span> 👋
        </h1>
        <p className="font-body text-text-secondary mt-2 text-sm">{subtitle}</p>
      </div>
      <UserBadge nome={nome} email={email} {...(totalBilhetes !== undefined && { totalBilhetes })} />
    </header>
  );
}
