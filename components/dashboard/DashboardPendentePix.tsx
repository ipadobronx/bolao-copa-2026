// components/dashboard/DashboardPendentePix.tsx
import Link from 'next/link'
import type { Route } from 'next'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import type { PendenteInfo } from '@/lib/dashboard/estado'

function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export type DashboardPendentePixProps = {
  pendente: PendenteInfo
  variant: 'hero' | 'banner'
}

export function DashboardPendentePix({ pendente, variant }: DashboardPendentePixProps) {
  const href = `/comprar/${pendente.bilhete_id}/pix` as Route
  const plural = pendente.qtd_pendentes > 1

  if (variant === 'banner') {
    return (
      <Link
        href={href}
        className="panel border-accent/60 bg-accent/5 hover:bg-accent/10 mb-6 flex items-center justify-between gap-3 px-5 py-3 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm">
          <AlertTriangle className="text-accent size-4 flex-shrink-0" />
          <span>
            PIX de <strong>{formatBRL(pendente.valor_total_pendente)}</strong> pendente
            {plural ? ` (${pendente.qtd_pendentes} tabelas)` : ''}
          </span>
        </span>
        <span className="text-accent inline-flex items-center gap-1 text-sm font-medium">
          Pagar <ArrowRight className="size-3" />
        </span>
      </Link>
    )
  }

  // variant === 'hero'
  return (
    <section className="panel border-accent/60 bg-accent/5 p-8 md:p-10">
      <div className="text-accent mb-2 flex items-center gap-2 font-bold">
        <AlertTriangle className="size-5" /> Você tem PIX pendente
      </div>
      <h2 className="font-display mb-3 text-2xl md:text-3xl">
        Finalize o pagamento de{' '}
        <span className="text-accent">{formatBRL(pendente.valor_total_pendente)}</span>
      </h2>
      <p className="text-text-secondary mb-1 text-sm">
        Em até 30 minutos pra não perder sua tabela.
      </p>
      <p className="text-text-muted mb-6 font-mono text-xs">
        Bilhete #{pendente.numero_bilhete}
        {plural ? ` · ${pendente.qtd_pendentes} tabelas pendentes` : ''}
      </p>
      <Link
        href={href}
        className="bg-accent text-bg-dark hover:bg-accent/90 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
      >
        Pagar agora <ArrowRight className="size-4" />
      </Link>
    </section>
  )
}
