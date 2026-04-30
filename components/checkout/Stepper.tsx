'use client';

import { Minus, Plus, Lock, Gift } from 'lucide-react';

type StepperProps = {
  qty: number;
  onChange: (qty: number) => void;
  min?: number;
  max?: number;
  milestone?: number;
};

export function Stepper({ qty, onChange, min = 1, max = 50, milestone = 5 }: StepperProps) {
  const fillPct = Math.min(100, (qty / max) * 100);
  const milestonePct = Math.min(100, (milestone / max) * 100);
  const liberado = qty >= milestone;
  const faltam = milestone - qty;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
        <button
          type="button"
          aria-label="Diminuir quantidade"
          onClick={() => onChange(qty - 1)}
          disabled={qty <= min}
          className="grid h-9 w-9 place-items-center rounded-md bg-zinc-800 font-mono text-yellow-400 disabled:opacity-30"
        >
          <Minus size={18} />
        </button>
        <span
          data-testid="stepper-num"
          className="font-mono text-2xl font-semibold text-yellow-400"
        >
          {qty}
        </span>
        <button
          type="button"
          aria-label="Aumentar quantidade"
          onClick={() => onChange(qty + 1)}
          disabled={qty >= max}
          className="grid h-9 w-9 place-items-center rounded-md bg-zinc-800 font-mono text-yellow-400 disabled:opacity-30"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="relative h-1.5 overflow-hidden rounded-full bg-zinc-900">
        <div
          data-testid="milestone-fill"
          className="h-full bg-yellow-400 transition-[width] duration-300"
          style={{ width: `${fillPct}%` }}
        />
        <div
          className="absolute -top-1 h-3.5 w-0.5 bg-yellow-400"
          style={{ left: `${milestonePct}%` }}
          aria-hidden
        />
      </div>

      <div
        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm ${
          liberado ? 'bg-green-400/10 text-green-400' : 'bg-zinc-800/40 text-zinc-400'
        }`}
      >
        {liberado ? (
          <>
            <Gift size={14} /> Cashback liberado!
          </>
        ) : (
          <>
            <Lock size={14} /> {faltam} {faltam === 1 ? 'tabela' : 'tabelas'} pra liberar cashback
          </>
        )}
      </div>
    </div>
  );
}
