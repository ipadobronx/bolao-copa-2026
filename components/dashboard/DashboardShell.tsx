import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { DashboardTopbarMobile } from '@/components/dashboard/DashboardTopbarMobile';

export type DashboardShellProps = {
  nome: string;
  email: string;
  totalBilhetes?: number;
  children: React.ReactNode;
};

export function DashboardShell({ nome, email, totalBilhetes, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <DashboardTopbarMobile
        nome={nome}
        email={email}
        {...(totalBilhetes !== undefined && { totalBilhetes })}
      />
      <DashboardNav className="hidden md:flex" />
      <div className="flex flex-col">
        <main className="flex-1 px-5 pt-20 pb-10 md:p-8 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
