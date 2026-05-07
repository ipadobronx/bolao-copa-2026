'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  DATE_RANGE_PRESETS,
  toDateInputValue,
  type DateRangePreset,
} from '@/lib/admin/date-range';
import { cn } from '@/lib/utils';

type Props = {
  preset: DateRangePreset;
  from: Date;
  to: Date;
};

export function DateRangePicker({ preset, from, to }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [customFrom, setCustomFrom] = useState(toDateInputValue(from));
  const [customTo, setCustomTo] = useState(toDateInputValue(to));

  const updateParams = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => {
      router.replace(`/admin?${params.toString()}` as never);
    });
  };

  const handlePreset = (p: DateRangePreset) => {
    if (p === 'custom') {
      updateParams({ preset: 'custom', from: customFrom, to: customTo });
    } else {
      updateParams({ preset: p, from: null, to: null });
    }
  };

  const applyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ preset: 'custom', from: customFrom, to: customTo });
  };

  return (
    <div
      className={cn(
        'mb-4 flex flex-col gap-3 rounded-xl border border-border bg-bg-card p-4',
        'sm:flex-row sm:items-center sm:gap-4',
      )}
      data-pending={pending ? 'true' : undefined}
    >
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Período">
        {DATE_RANGE_PRESETS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={preset === opt.value}
            onClick={() => handlePreset(opt.value)}
            disabled={pending}
            className={cn(
              'rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors',
              preset === opt.value
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-bg-elevated text-text-secondary hover:border-border-strong hover:text-text-primary',
              pending && 'opacity-50',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <form onSubmit={applyCustom} className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            aria-label="De"
            className="bg-bg-elevated border-border-strong text-text-primary rounded-md border px-2 py-1 font-mono text-xs"
          />
          <span className="text-text-muted text-xs">até</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            aria-label="Até"
            className="bg-bg-elevated border-border-strong text-text-primary rounded-md border px-2 py-1 font-mono text-xs"
          />
          <button
            type="submit"
            disabled={pending}
            className="bg-accent text-bg-dark rounded-md px-3 py-1 font-mono text-xs font-bold uppercase disabled:opacity-50"
          >
            Aplicar
          </button>
        </form>
      )}
    </div>
  );
}
