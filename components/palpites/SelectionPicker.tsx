'use client';

import type { SelecaoBasica } from '@/lib/palpites';
import { cn } from '@/lib/utils';

type Props = {
  selecoes: SelecaoBasica[];
  value: number | null;
  onChange: (id: number) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function SelectionPicker({
  selecoes,
  value,
  onChange,
  disabled = false,
  placeholder = 'Escolher seleção…',
}: Props) {
  const byGrupo = new Map<string, SelecaoBasica[]>();
  for (const s of selecoes) {
    const g = s.grupo ?? 'Outros';
    if (!byGrupo.has(g)) byGrupo.set(g, []);
    byGrupo.get(g)!.push(s);
  }
  const grupos = [...byGrupo.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <select
      value={value ?? ''}
      onChange={(e) => {
        const id = parseInt(e.target.value);
        if (!isNaN(id)) onChange(id);
      }}
      disabled={disabled}
      className={cn(
        'bg-bg-elevated border-border-strong text-text-primary w-full rounded-lg border px-3 py-2 text-sm outline-none',
        'focus:border-accent',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <option value="">{placeholder}</option>
      {grupos.map(([grupo, times]) => (
        <optgroup key={grupo} label={`Grupo ${grupo}`}>
          {times.map((s) => (
            <option key={s.id} value={s.id}>
              {s.bandeira_emoji} {s.nome}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
