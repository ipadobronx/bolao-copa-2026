'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { upsertBonus } from '@/app/(dashboard)/palpites/actions';
import { SelectionPicker } from './SelectionPicker';
import type { BonusSalvo, SelecaoBasica, TipoBonus } from '@/lib/palpites';
import { cn } from '@/lib/utils';

const TIPO_META: Record<TipoBonus, { label: string; pts: number; isText?: boolean }> = {
  campeao:    { label: '🥇 Campeão',   pts: 50 },
  vice:       { label: '🥈 Vice',       pts: 30 },
  terceiro:   { label: '🥉 3° Lugar',  pts: 15 },
  quarto:     { label: '4° Lugar',     pts: 15 },
  artilheiro: { label: '⚽ Artilheiro', pts: 25, isText: true },
  revelacao:  { label: '✨ Revelação',  pts: 15 },
};

type Props = {
  bilheteId: string;
  tipo: TipoBonus;
  selecoes: SelecaoBasica[];
  bonusSalvo: BonusSalvo | null;
  deadlinePassed: boolean;
};

export function BonusCard({ bilheteId, tipo, selecoes, bonusSalvo, deadlinePassed }: Props) {
  const meta = TIPO_META[tipo];

  const [selecaoId, setSelecaoId] = useState<number | null>(bonusSalvo?.selecao_id ?? null);
  const [jogadorNome, setJogadorNome] = useState(bonusSalvo?.jogador_nome ?? '');
  const [saving, setSaving] = useState(false);

  const selectedSelecao = selecaoId ? selecoes.find((s) => s.id === selecaoId) : null;
  const isSelected = meta.isText ? jogadorNome.trim().length > 0 : selecaoId !== null;

  async function save(newSelecaoId?: number, newNome?: string) {
    setSaving(true);
    const result = await upsertBonus(
      bilheteId,
      tipo,
      meta.isText ? undefined : newSelecaoId,
      meta.isText ? newNome : undefined,
    );
    setSaving(false);
    if (!result.ok) toast.error(result.error ?? 'Erro ao salvar bônus.');
  }

  return (
    <div
      className={cn(
        'bg-bg-card border-border rounded-2xl border p-4 transition-colors',
        isSelected && !deadlinePassed && 'border-accent/30 bg-accent/5',
      )}
    >
      <div className="font-mono text-text-muted mb-3 text-[10px] uppercase tracking-wider">
        {meta.label} · {meta.pts} pts
      </div>

      {!meta.isText && selectedSelecao && (
        <div className="mb-3 flex items-center gap-2.5">
          <span className="text-3xl">{selectedSelecao.bandeira_emoji}</span>
          <div>
            <div className="text-[15px] font-bold">{selectedSelecao.nome}</div>
            <div className="font-mono text-accent text-[11px]">
              +{meta.pts} pts se acertar
            </div>
          </div>
        </div>
      )}

      {meta.isText ? (
        <input
          type="text"
          value={jogadorNome}
          onChange={(e) => setJogadorNome(e.target.value)}
          onBlur={() => {
            if (jogadorNome.trim()) save(undefined, jogadorNome.trim());
          }}
          disabled={deadlinePassed || saving}
          placeholder="Nome do jogador…"
          maxLength={100}
          className={cn(
            'bg-bg-elevated border-border-strong text-text-primary w-full rounded-lg border px-3 py-2 text-sm outline-none',
            'focus:border-accent',
            deadlinePassed && 'cursor-not-allowed opacity-50',
          )}
        />
      ) : (
        <SelectionPicker
          selecoes={selecoes}
          value={selecaoId}
          onChange={(id) => {
            setSelecaoId(id);
            save(id);
          }}
          disabled={deadlinePassed || saving}
          placeholder="Escolher seleção →"
        />
      )}

      {tipo === 'revelacao' && (
        <p className="font-mono text-text-muted mt-2 text-[10px]">
          Admin define o critério após a Copa
        </p>
      )}
    </div>
  );
}
