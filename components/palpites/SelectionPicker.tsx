'use client';

import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

import { BandeiraImg } from '@/components/ui/BandeiraImg';
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
  const [open, setOpen] = useState(false);

  const selected = value != null ? selecoes.find((s) => s.id === value) ?? null : null;

  const byGrupo = new Map<string, SelecaoBasica[]>();
  for (const s of selecoes) {
    const g = s.grupo ?? 'Outros';
    if (!byGrupo.has(g)) byGrupo.set(g, []);
    byGrupo.get(g)!.push(s);
  }
  const grupos = [...byGrupo.entries()].sort(([a], [b]) => a.localeCompare(b));

  const handleSelect = (id: number) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'bg-bg-elevated border-border-strong text-text-primary flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm outline-none transition-colors',
            'focus:border-accent hover:border-border',
            disabled && 'cursor-not-allowed opacity-50',
            !selected && 'text-text-muted',
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {selected ? (
              <>
                <BandeiraImg
                  emoji={selected.bandeira_emoji}
                  nome={selected.nome}
                  size={20}
                />
                <span className="truncate text-text-primary">{selected.nome}</span>
              </>
            ) : (
              <span>{placeholder}</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="bg-bg-card border-border z-50 max-h-[60vh] w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-xl border p-1 shadow-2xl outline-none"
        >
          <ul role="listbox" className="space-y-2">
            {grupos.map(([grupo, times]) => (
              <li key={grupo}>
                <div className="font-mono text-text-muted px-2 pt-2 text-[10px] uppercase tracking-wider">
                  Grupo {grupo}
                </div>
                <ul className="mt-1">
                  {times.map((s) => {
                    const isSelected = s.id === value;
                    return (
                      <li key={s.id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelect(s.id)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors',
                            'hover:bg-bg-elevated focus:bg-bg-elevated focus:outline-none',
                            isSelected && 'bg-accent/10 text-accent',
                          )}
                        >
                          <BandeiraImg emoji={s.bandeira_emoji} nome={s.nome} size={20} />
                          <span className="flex-1 truncate">{s.nome}</span>
                          {isSelected && (
                            <Check className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
