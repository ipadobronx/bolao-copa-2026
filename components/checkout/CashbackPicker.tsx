'use client';

import { calcularValorCashback, type CashbackMultiplicador } from '@/lib/cashback';

export type SelecaoElegivel = {
  id: number;
  nome: string;
  codigo_iso: string;
  bandeira_emoji: string;
  cashback_multiplicador: number;
};

type CashbackPickerProps = {
  selecoes: SelecaoElegivel[];
  selectedId: number | null;
  onChange: (selecao_cashback_id: number | null) => void;
  valor_pago: number;
};

const TIER_LABELS: Record<number, { label: string; pct: string }> = {
  5.0: { label: '5× — AZARÕES', pct: '500%' },
  3.0: { label: '3× — TIME B', pct: '300%' },
  2.0: { label: '2× — SUL-AMERICANOS', pct: '200%' },
  1.0: { label: '1× — FAVORITAS', pct: '100%' },
};

const TIER_COLORS: Record<number, string> = {
  5.0: 'bg-purple-400/10 border-purple-400/35 text-purple-300',
  3.0: 'bg-orange-400/10 border-orange-400/35 text-orange-300',
  2.0: 'bg-green-400/10 border-green-400/35 text-green-300',
  1.0: 'bg-blue-400/10 border-blue-400/35 text-blue-300',
};

const BADGE_COLORS: Record<number, string> = {
  5.0: 'bg-purple-400/20 text-purple-300',
  3.0: 'bg-orange-400/20 text-orange-300',
  2.0: 'bg-green-400/20 text-green-300',
  1.0: 'bg-blue-400/20 text-blue-300',
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function CashbackPicker({
  selecoes,
  selectedId,
  onChange,
  valor_pago,
}: CashbackPickerProps) {
  const tiers = [5.0, 3.0, 2.0, 1.0] as const;

  const handleClick = (id: number) => {
    onChange(selectedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {tiers.map((mult) => {
        const grupo = selecoes.filter((s) => s.cashback_multiplicador === mult);
        if (grupo.length === 0) return null;

        const retorno = calcularValorCashback(valor_pago, mult as CashbackMultiplicador);

        return (
          <div key={mult} className="space-y-2">
            <div className="flex items-baseline justify-between font-mono text-xs uppercase tracking-wider text-zinc-500">
              <span>{TIER_LABELS[mult]!.label}</span>
              <span>{TIER_LABELS[mult]!.pct}</span>
            </div>

            <div
              data-testid={`callout-${Math.round(mult)}`}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm ${TIER_COLORS[mult]}`}
            >
              💸 {formatBRL(valor_pago)} × {Math.round(mult)}× ={' '}
              <strong>{formatBRL(retorno)}</strong> de volta no PIX
            </div>

            <div className="space-y-1.5">
              {grupo.map((s) => {
                const selected = selectedId === s.id;
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(s.id)}
                    onKeyDown={(e) =>
                      (e.key === 'Enter' || e.key === ' ') && handleClick(s.id)
                    }
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                      selected
                        ? 'border-yellow-400 bg-yellow-400/5'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-2xl">{s.bandeira_emoji}</span>
                    <div className="flex-1 font-semibold text-zinc-100">{s.nome}</div>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${BADGE_COLORS[mult]}`}
                    >
                      {Math.round(mult)}×
                    </span>
                    {selected && (
                      <span
                        data-testid="badge-sua"
                        className="ml-1 rounded bg-yellow-400 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-950"
                      >
                        SUA
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
