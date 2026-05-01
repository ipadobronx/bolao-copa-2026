import Link from 'next/link';
import type { BilheteResumo, SelecaoBasica } from '@/lib/palpites';

type Props = {
  bilhete: BilheteResumo;
  palpitesCount: number;
  selecaoCashback: SelecaoBasica | null;
};

const TOTAL_JOGOS = 104;

export function TabelaCard({ bilhete, palpitesCount, selecaoCashback }: Props) {
  const confirmado = bilhete.status_pagamento === 'confirmado';
  const pct = Math.round((palpitesCount / TOTAL_JOGOS) * 100);

  return (
    <div
      className={
        'bg-bg-card border-border rounded-2xl border p-5 transition-colors ' +
        (confirmado ? 'hover:border-border-strong' : 'opacity-55')
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-2xl tracking-wide">
          Tabela #{bilhete.numero_bilhete}
        </span>
        <StatusBadge status={bilhete.status_pagamento} />
      </div>

      <div className="bg-bg-elevated mb-1.5 h-1 rounded-full">
        <div
          className="bg-accent h-full rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="font-mono text-text-muted flex justify-between text-[11px]">
        <span>{palpitesCount} / {TOTAL_JOGOS} preenchidos</span>
        <span>{pct}%</span>
      </div>

      <div className="border-border mt-3 border-t pt-3 text-sm">
        {selecaoCashback ? (
          <span className="text-text-secondary">
            {selecaoCashback.bandeira_emoji} Cashback {selecaoCashback.nome}
          </span>
        ) : (
          <span className="text-text-muted">Sem cashback</span>
        )}
      </div>

      <div className="mt-4">
        {confirmado ? (
          <Link
            href={`/palpites/${bilhete.id}`}
            className="bg-accent text-bg-dark block w-full rounded-lg py-2 text-center text-sm font-bold"
          >
            Preencher palpites →
          </Link>
        ) : (
          <span className="bg-bg-elevated text-text-muted block w-full cursor-not-allowed rounded-lg py-2 text-center text-sm">
            {bilhete.status_pagamento === 'pendente'
              ? 'Aguardando pagamento PIX'
              : 'Bilhete expirado'}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BilheteResumo['status_pagamento'] }) {
  const map = {
    confirmado: 'bg-green-500/10 text-green-400',
    pendente: 'bg-yellow-500/10 text-yellow-400',
    expirado: 'bg-red-500/10 text-red-400',
    cancelado: 'bg-red-500/10 text-red-400',
  } as const;
  const label = {
    confirmado: '✓ Confirmado',
    pendente: '⏳ Pendente',
    expirado: '✗ Expirado',
    cancelado: '✗ Cancelado',
  } as const;
  return (
    <span className={`font-mono rounded-full px-2.5 py-0.5 text-[10px] ${map[status]}`}>
      {label[status]}
    </span>
  );
}
