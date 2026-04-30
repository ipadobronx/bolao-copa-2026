'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Stepper } from './Stepper';
import { CashbackPicker, type SelecaoElegivel } from './CashbackPicker';
import { criarCheckout } from '@/app/(dashboard)/comprar/actions';
import { CASHBACK_VALOR_MINIMO } from '@/lib/cashback';

type FormulaCheckoutProps = {
  selecoes: SelecaoElegivel[];
  qtyInicial?: number;
  cashbackInicial?: number | null;
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function FormulaCheckout({
  selecoes,
  qtyInicial = 1,
  cashbackInicial = null,
}: FormulaCheckoutProps) {
  const [qty, setQty] = useState(qtyInicial);
  const [selecaoCashbackId, setSelecaoCashbackId] = useState<number | null>(cashbackInicial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const valor_total = qty * 20;
  const cashbackHabilitado = valor_total >= CASHBACK_VALOR_MINIMO;
  const cashbackEfetivo = cashbackHabilitado ? selecaoCashbackId : null;
  const selecaoEscolhida = selecoes.find((s) => s.id === cashbackEfetivo);

  const onChangeQty = (q: number) => {
    setQty(q);
    if (q * 20 < CASHBACK_VALOR_MINIMO) {
      setSelecaoCashbackId(null);
    }
  };

  const onSubmit = () => {
    startTransition(async () => {
      const result = await criarCheckout({
        qty,
        selecao_cashback_id: cashbackEfetivo,
      });
      if (result.ok) {
        router.push(`/comprar/${result.bilhete_principal_id}/pix`);
      } else {
        toast.error(result.mensagem);
      }
    });
  };

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <header>
        <h1 className="font-display text-3xl uppercase tracking-wider">Comprar tabelas</h1>
        <p className="text-sm text-zinc-400">R$ 20,00 por tabela · pagamento via PIX</p>
      </header>

      <section>
        <h2 className="mb-3 font-display text-lg uppercase tracking-wide">Quantas tabelas?</h2>
        <Stepper qty={qty} onChange={onChangeQty} />
      </section>

      {cashbackHabilitado && (
        <section>
          <h2 className="mb-3 font-display text-lg uppercase tracking-wide">
            Escolhe tua seleção
          </h2>
          <CashbackPicker
            selecoes={selecoes}
            selectedId={cashbackEfetivo}
            onChange={setSelecaoCashbackId}
            valor_pago={valor_total}
          />
        </section>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between font-mono text-sm">
          <span className="text-zinc-400">
            {qty} {qty === 1 ? 'tabela' : 'tabelas'}
          </span>
          <span>{formatBRL(valor_total)}</span>
        </div>
        {selecaoEscolhida && (
          <div className="mt-2 flex items-center justify-between font-mono text-xs text-green-400">
            <span>
              {selecaoEscolhida.bandeira_emoji} {selecaoEscolhida.nome} (
              {Math.round(selecaoEscolhida.cashback_multiplicador)}×)
            </span>
            <span>
              se campeã: {formatBRL(valor_total * selecaoEscolhida.cashback_multiplicador)}
            </span>
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={onSubmit}
        disabled={pending}
        className="w-full rounded-lg bg-yellow-400 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-300 disabled:opacity-50"
      >
        {pending ? 'Gerando PIX…' : `Pagar ${formatBRL(valor_total)} via PIX`}
      </button>
    </div>
  );
}
