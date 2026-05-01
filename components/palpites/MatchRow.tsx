'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { upsertPalpite } from '@/app/(dashboard)/palpites/actions';
import { computeMatchEstado } from '@/lib/palpites';
import type { JogoComSelecoes, PalpiteSalvo } from '@/lib/palpites';
import { cn } from '@/lib/utils';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type Props = {
  bilheteId: string;
  jogo: JogoComSelecoes;
  palpiteSalvo: PalpiteSalvo | null;
};

export function MatchRow({ bilheteId, jogo, palpiteSalvo }: Props) {
  const estado = computeMatchEstado(jogo, new Date());

  const [golsCasa, setGolsCasa] = useState<string>(
    palpiteSalvo !== null ? String(palpiteSalvo.gols_casa) : '',
  );
  const [golsFora, setGolsFora] = useState<string>(
    palpiteSalvo !== null ? String(palpiteSalvo.gols_fora) : '',
  );
  const [saveState, setSaveState] = useState<SaveState>(
    palpiteSalvo !== null ? 'saved' : 'idle',
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const golsCasaRef = useRef(golsCasa);
  const golsForaRef = useRef(golsFora);

  useEffect(() => { golsCasaRef.current = golsCasa; }, [golsCasa]);
  useEffect(() => { golsForaRef.current = golsFora; }, [golsFora]);

  const triggerSave = useCallback(() => {
    const c = parseInt(golsCasaRef.current);
    const f = parseInt(golsForaRef.current);
    if (isNaN(c) || isNaN(f)) return;

    setSaveState('saving');
    upsertPalpite(bilheteId, jogo.id, c, f).then((result) => {
      if (result.ok) {
        setSaveState('saved');
      } else {
        setSaveState('error');
        toast.error(result.error ?? 'Erro ao salvar.');
      }
    });
  }, [bilheteId, jogo.id]);

  function handleChange(field: 'casa' | 'fora', raw: string) {
    const value = raw.replace(/\D/g, '').slice(0, 2);
    if (field === 'casa') setGolsCasa(value);
    else setGolsFora(value);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(triggerSave, 1000);
  }

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const isReadonly = estado !== 'open';

  const nomeCasa = jogo.selecao_casa?.nome ?? jogo.placeholder_casa ?? '?';
  const nomeFora = jogo.selecao_fora?.nome ?? jogo.placeholder_fora ?? '?';
  const isoCasa = jogo.selecao_casa?.codigo_iso ?? null;
  const isoFora = jogo.selecao_fora?.codigo_iso ?? null;

  const dataHora = new Date(jogo.data_hora);
  const dateStr = dataHora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const timeStr = dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={cn(
        'bg-bg-card border-border grid items-center gap-2 rounded-xl border p-3.5 transition-colors sm:gap-3',
        'grid-cols-[70px_1fr_auto_1fr_100px]',
        estado === 'open' && saveState === 'saved' && 'border-green-500/25',
        estado === 'finalized' && 'border-accent/15',
        estado === 'locked' && 'opacity-70',
      )}
    >
      {/* Meta */}
      <div className="font-mono text-text-muted text-[10px] leading-relaxed">
        Jogo {jogo.numero_jogo}
        <br />
        {dateStr} · {timeStr}
      </div>

      {/* Casa */}
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <FlagImg iso={isoCasa} nome={nomeCasa} />
        <span className={cn('hidden sm:inline', isReadonly && 'text-text-secondary')}>
          {nomeCasa}
        </span>
      </div>

      {/* Score */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <ScoreInput
            value={estado === 'finalized' ? String(jogo.gols_casa ?? '') : golsCasa}
            onChange={(v) => handleChange('casa', v)}
            readonly={isReadonly}
            variant={estado === 'finalized' ? 'result' : 'normal'}
          />
          <span className="font-mono text-text-muted text-sm">×</span>
          <ScoreInput
            value={estado === 'finalized' ? String(jogo.gols_fora ?? '') : golsFora}
            onChange={(v) => handleChange('fora', v)}
            readonly={isReadonly}
            variant={estado === 'finalized' ? 'result' : 'normal'}
          />
        </div>
        {estado === 'finalized' && palpiteSalvo && (
          <span className="font-mono text-text-muted text-[9px]">
            meu: {palpiteSalvo.gols_casa}×{palpiteSalvo.gols_fora}
          </span>
        )}
      </div>

      {/* Fora */}
      <div className="flex items-center justify-end gap-1.5 text-sm font-semibold">
        <span className={cn('hidden sm:inline', isReadonly && 'text-text-secondary')}>
          {nomeFora}
        </span>
        <FlagImg iso={isoFora} nome={nomeFora} />
      </div>

      {/* Chip */}
      <div className="text-right">
        <StatusChip estado={estado} saveState={saveState} pts={palpiteSalvo?.pontos_calculados ?? null} />
      </div>
    </div>
  );
}

function FlagImg({ iso, nome }: { iso: string | null; nome: string }) {
  if (!iso) return <span className="text-xl">🏆</span>;
  return (
    <img
      src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`}
      alt={nome}
      width={28}
      height={21}
      className="rounded-sm object-cover"
    />
  );
}

function ScoreInput({
  value,
  onChange,
  readonly,
  variant,
}: {
  value: string;
  onChange: (v: string) => void;
  readonly: boolean;
  variant: 'normal' | 'result';
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={99}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readonly}
      placeholder="?"
      className={cn(
        'h-11 w-11 rounded-lg border text-center font-mono text-lg font-bold outline-none',
        variant === 'normal' &&
          !readonly &&
          'bg-bg-elevated border-border-strong text-text-primary focus:border-accent',
        variant === 'normal' &&
          readonly &&
          'bg-bg-dark border-border text-text-muted cursor-not-allowed',
        variant === 'result' && 'bg-bg-dark border-accent/20 text-accent cursor-not-allowed',
      )}
    />
  );
}

function StatusChip({
  estado,
  saveState,
  pts,
}: {
  estado: ReturnType<typeof computeMatchEstado>;
  saveState: SaveState;
  pts?: number | null;
}) {
  const base = 'font-mono rounded-full px-2.5 py-1 text-[10px] whitespace-nowrap';

  if (estado === 'finalized') {
    return pts !== null && pts !== undefined ? (
      <span className={`${base} bg-accent/10 text-accent font-bold`}>{pts} pts</span>
    ) : (
      <span className={`${base} bg-accent/10 text-accent`}>finalizado</span>
    );
  }

  if (estado === 'locked') {
    return <span className={`${base} bg-slate-500/10 text-slate-500`}>🔒 Fechado</span>;
  }

  if (saveState === 'saving') {
    return <span className={`${base} bg-slate-400/10 text-slate-400`}>Salvando…</span>;
  }
  if (saveState === 'saved') {
    return <span className={`${base} bg-green-500/10 text-green-400`}>✓ Salvo</span>;
  }
  if (saveState === 'error') {
    return <span className={`${base} bg-red-500/10 text-red-400`}>Erro</span>;
  }
  return <span className={`${base} bg-yellow-500/10 text-yellow-400`}>● Pendente</span>;
}
