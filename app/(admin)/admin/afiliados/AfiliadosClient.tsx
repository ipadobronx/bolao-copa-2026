'use client';

import { useMemo, useState } from 'react';
import { Copy, Plus, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { KpiCard } from '@/components/admin/KpiCard';
import { formatBRL } from '@/lib/format/brl';

export type AfiliadoStats = {
  afiliado_id: string;
  codigo: string;
  nome: string;
  comissao_pct: number;
  total_vendas: number;
  bilhetes_vendidos: number;
  comissao_devida: number;
  comissao_paga: number;
  saldo: number;
};

const SITE_URL = 'https://malanacopa.com.br';

function refLink(codigo: string) {
  return `${SITE_URL}?ref=${codigo}`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Link copiado');
  } catch {
    toast.error('Não consegui copiar — copie manualmente');
  }
}

export function AfiliadosClient({ initialRows }: { initialRows: AfiliadoStats[] }) {
  const [rows] = useState(initialRows);
  const [criarOpen, setCriarOpen] = useState(false);
  const [pagarFor, setPagarFor] = useState<AfiliadoStats | null>(null);

  const kpis = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.total_afiliados++;
        acc.total_vendas += r.total_vendas;
        acc.comissao_devida += r.comissao_devida;
        acc.comissao_paga += r.comissao_paga;
        return acc;
      },
      { total_afiliados: 0, total_vendas: 0, comissao_devida: 0, comissao_paga: 0 },
    );
  }, [rows]);

  return (
    <>
      {/* KPIs */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Afiliados ativos"
          value={String(kpis.total_afiliados)}
          icon="🤝"
          colorClass="blue"
        />
        <KpiCard
          label="Vendas via afiliados"
          value={formatBRL(kpis.total_vendas)}
          icon="💸"
          colorClass="green"
        />
        <KpiCard
          label="Comissão devida"
          value={formatBRL(kpis.comissao_devida)}
          icon="📒"
          colorClass="yellow"
        />
        <KpiCard
          label="Comissão paga"
          value={formatBRL(kpis.comissao_paga)}
          icon="✅"
          colorClass="green"
        />
      </div>

      {/* Header da lista + criar */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-text-muted font-mono text-xs uppercase tracking-wider">
          Afiliados ({rows.length})
        </p>
        <button
          type="button"
          onClick={() => setCriarOpen(true)}
          className="bg-accent text-bg-dark flex items-center gap-2 rounded-lg px-4 py-2 font-semibold transition hover:opacity-90"
        >
          <Plus className="size-4" /> Criar afiliado
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="panel text-text-muted p-8 text-center text-sm">
          Nenhum afiliado cadastrado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.afiliado_id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary text-lg font-semibold">{r.nome}</span>
                    <span className="text-text-muted font-mono text-xs">
                      · {r.comissao_pct.toFixed(2).replace('.', ',')}%
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(refLink(r.codigo))}
                    className="text-text-muted hover:text-accent mt-1 flex items-center gap-1.5 font-mono text-xs"
                    title="Copiar link"
                  >
                    <span className="truncate">{refLink(r.codigo)}</span>
                    <Copy className="size-3 flex-shrink-0" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPagarFor(r)}
                  disabled={r.saldo <= 0}
                  className="border-border text-text-primary flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition hover:border-white/30 disabled:opacity-40"
                >
                  <Wallet className="size-4" /> Registrar pagamento
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label="Bilhetes" value={String(r.bilhetes_vendidos)} />
                <Stat label="Vendas" value={formatBRL(r.total_vendas)} />
                <Stat label="Devida" value={formatBRL(r.comissao_devida)} />
                <Stat label="Paga" value={formatBRL(r.comissao_paga)} />
                <Stat
                  label="Saldo"
                  value={formatBRL(r.saldo)}
                  highlight={r.saldo > 0 ? 'yellow' : 'muted'}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {criarOpen && <CriarAfiliadoModal onClose={() => setCriarOpen(false)} />}
      {pagarFor && (
        <RegistrarPagamentoModal afiliado={pagarFor} onClose={() => setPagarFor(null)} />
      )}
    </>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'yellow' | 'muted';
}) {
  const valueClass =
    highlight === 'yellow'
      ? 'text-accent'
      : highlight === 'muted'
        ? 'text-text-muted'
        : 'text-text-primary';
  return (
    <div>
      <div className="text-text-muted font-mono text-[10px] uppercase tracking-wider">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="panel w-full max-w-md p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-text-primary text-2xl tracking-wide">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-xl"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CriarAfiliadoModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [contato, setContato] = useState('');
  const [comissaoPct, setComissaoPct] = useState('10');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const r = await fetch('/api/admin/afiliados', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          codigo: codigo.trim().toLowerCase(),
          contato: contato.trim() || null,
          comissao_pct: Number(comissaoPct),
          notes: notes.trim() || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j.error || 'Erro ao criar afiliado');
        return;
      }
      toast.success('Afiliado criado');
      onClose();
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <ModalShell title="Criar afiliado" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Nome*">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            className="border-border bg-bg-elevated text-text-primary w-full rounded border px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
          />
        </Field>
        <Field
          label="Código*"
          hint="Vai virar o ?ref=código no link. Apenas a-z, 0-9, _ ou -."
        >
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toLowerCase())}
            required
            pattern="[a-z0-9_-]{3,30}"
            className="border-border bg-bg-elevated text-text-primary w-full rounded border px-3 py-2 font-mono text-sm focus:border-white/30 focus:outline-none"
            placeholder="ex: jose"
          />
        </Field>
        <Field label="Contato (email/whatsapp)">
          <input
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            maxLength={120}
            className="border-border bg-bg-elevated text-text-primary w-full rounded border px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
          />
        </Field>
        <Field label="Comissão %*">
          <input
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={comissaoPct}
            onChange={(e) => setComissaoPct(e.target.value)}
            required
            className="border-border bg-bg-elevated text-text-primary w-full rounded border px-3 py-2 font-mono text-sm focus:border-white/30 focus:outline-none"
          />
        </Field>
        <Field label="Notes (interno)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={2}
            className="border-border bg-bg-elevated text-text-primary w-full rounded border px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="bg-accent text-bg-dark rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
          >
            {pending ? 'Criando…' : 'Criar'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function RegistrarPagamentoModal({
  afiliado,
  onClose,
}: {
  afiliado: AfiliadoStats;
  onClose: () => void;
}) {
  const [valor, setValor] = useState(afiliado.saldo > 0 ? afiliado.saldo.toFixed(2) : '');
  const [referencia, setReferencia] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const r = await fetch('/api/admin/afiliados/pagamentos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          afiliado_id: afiliado.afiliado_id,
          valor: Number(valor),
          metodo: 'pix',
          referencia: referencia.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j.error || 'Erro ao registrar pagamento');
        return;
      }
      toast.success('Pagamento registrado');
      onClose();
      window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <ModalShell title={`Pagar ${afiliado.nome}`} onClose={onClose}>
      <p className="text-text-muted mb-3 font-mono text-xs">
        Saldo atual: {formatBRL(afiliado.saldo)}
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Valor (R$)*">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
            className="border-border bg-bg-elevated text-text-primary w-full rounded border px-3 py-2 font-mono text-sm focus:border-white/30 focus:outline-none"
          />
        </Field>
        <Field label="Referência (ID PIX)">
          <input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            maxLength={120}
            className="border-border bg-bg-elevated text-text-primary w-full rounded border px-3 py-2 font-mono text-sm focus:border-white/30 focus:outline-none"
          />
        </Field>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={2}
            className="border-border bg-bg-elevated text-text-primary w-full rounded border px-3 py-2 text-sm focus:border-white/30 focus:outline-none"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="bg-success text-bg-dark rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
          >
            {pending ? 'Registrando…' : 'Registrar pagamento'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-text-secondary mb-1 block font-mono text-[11px] uppercase tracking-wider">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-text-muted mt-1 block text-[11px]">{hint}</span>
      )}
    </label>
  );
}
