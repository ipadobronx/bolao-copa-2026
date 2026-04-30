import { iniciais } from '@/lib/format/iniciais';

export type UserBadgeProps = {
  nome: string;
  email: string;
};

export function UserBadge({ nome, email }: UserBadgeProps) {
  const handle = email.split('@')[0]?.toLowerCase() ?? 'apostador';
  const nomeExibido = nome.trim() || 'Apostador';
  return (
    <div className="bg-bg-card border-border flex items-center gap-2.5 rounded-full border px-3.5 py-2">
      <div
        aria-hidden="true"
        className="text-bg-dark flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-[13px] font-extrabold"
      >
        {iniciais(nomeExibido)}
      </div>
      <div className="text-[13px] leading-tight">
        <div className="font-semibold">{nomeExibido}</div>
        <div className="text-text-muted font-mono text-[11px]">@{handle} · 0 tabelas</div>
      </div>
    </div>
  );
}
