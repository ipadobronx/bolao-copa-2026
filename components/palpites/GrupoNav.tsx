'use client';

import { cn } from '@/lib/utils';

type Props = {
  grupos: string[];
  activeGrupo: string;
  onSelect: (grupo: string) => void;
};

export function GrupoNav({ grupos, activeGrupo, onSelect }: Props) {
  return (
    <div className="mb-5 overflow-x-auto pb-1">
      <div className="flex gap-1.5">
        {grupos.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onSelect(g)}
            className={cn(
              'min-w-[2.25rem] rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition-colors',
              activeGrupo === g
                ? 'bg-accent border-accent text-bg-dark'
                : 'bg-bg-elevated border-border text-text-secondary hover:text-text-primary hover:border-accent/60',
            )}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}
