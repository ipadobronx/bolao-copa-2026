'use client';

import { cn } from '@/lib/utils';
import type { FaseJogo } from '@/lib/palpites';

export type TabKey = FaseJogo | 'bonus';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'grupos',           label: 'Grupos' },
  { key: '16avos',           label: '16avos' },
  { key: 'oitavas',          label: 'Oitavas' },
  { key: 'quartas',          label: 'Quartas' },
  { key: 'semis',            label: 'Semis' },
  { key: 'disputa_terceiro', label: '3° lugar' },
  { key: 'final',            label: 'Final' },
  { key: 'bonus',            label: '🏆 Bônus' },
];

type Props = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
};

export function PalpitesTabs({ activeTab, onChange }: Props) {
  return (
    <div className="mb-6 overflow-x-auto pb-1">
      <div className="bg-bg-card border-border flex w-fit gap-1 rounded-xl border p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              'rounded-lg px-3.5 py-2 text-[12px] font-semibold whitespace-nowrap transition-colors',
              activeTab === key
                ? 'bg-accent text-bg-dark'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
