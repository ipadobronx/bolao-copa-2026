'use client';

import { cn } from '@/lib/utils';
import { useCountdown } from './useCountdown';

type Props = {
  numero: 1 | 2 | 3;
  deadline: string;
};

export function RodadaHeader({ numero, deadline }: Props) {
  const { state, parts: countdown } = useCountdown(deadline);

  const deadlineDate = new Date(deadline);
  const dateLabel = deadlineDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
  const timeLabel = deadlineDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={cn(
        'border-border bg-bg-card mb-2.5 flex items-center gap-2.5 rounded-lg border px-3.5 py-2',
        state === 'urgent' && 'border-orange-500/40 bg-orange-500/8',
        state === 'closed' && 'opacity-50',
      )}
    >
      <span
        className={cn(
          'font-mono text-[11px] font-bold',
          state === 'normal' && 'text-text-secondary',
          state === 'urgent' && 'text-orange-400',
          state === 'closed' && 'text-text-muted',
        )}
      >
        {state === 'urgent' && '⚡ '}
        {state === 'closed' && '🔒 '}
        Rodada {numero}
        {state === 'closed' && ' · encerrada'}
      </span>

      <div className="ml-auto">
        {state === 'normal' && (
          <span className="font-mono text-text-muted text-[11px]">
            fecha {dateLabel} às {timeLabel}
          </span>
        )}
        {state === 'urgent' && (
          <span className="font-mono flex items-center gap-1 text-[13px] font-bold text-orange-400">
            <Unit val={countdown.h} lbl="h" />
            <span className="mb-1.5">:</span>
            <Unit val={countdown.m} lbl="min" />
            <span className="mb-1.5">:</span>
            <Unit val={countdown.s} lbl="s" />
          </span>
        )}
        {state === 'closed' && (
          <span className="font-mono text-text-muted text-[11px]">
            desde {dateLabel} às {timeLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function Unit({ val, lbl }: { val: string; lbl: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-[15px] leading-none">{val}</span>
      <span className="text-[9px] opacity-70">{lbl}</span>
    </span>
  );
}
