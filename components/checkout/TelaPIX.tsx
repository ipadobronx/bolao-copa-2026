'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Status = 'pendente' | 'confirmado' | 'expirado' | 'cancelado';

type Resumo = {
  qty: number;
  cashback?: { selecao: string; multiplicador: number; bandeira: string };
};

type TelaPIXProps = {
  bilheteId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiraEm: string;
  valorTotal: number;
  resumo: Resumo;
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatMMSS = (sec: number) => {
  if (sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function TelaPIX({
  bilheteId,
  qrCode,
  qrCodeBase64,
  expiraEm,
  valorTotal,
  resumo,
}: TelaPIXProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('pendente');
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const diff = new Date(expiraEm).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkout/${bilheteId}/status`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as { status: Status; expira_em: string };
      setStatus(json.status);
    } catch {
      /* silencioso; tenta de novo no próximo tick */
    }
  }, [bilheteId]);

  // Polling 3s
  useEffect(() => {
    if (status !== 'pendente') return;
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [status, poll]);

  // Countdown 1s
  useEffect(() => {
    const iv = setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Countdown bate 0 → força um poll extra
  useEffect(() => {
    if (secondsLeft === 0 && status === 'pendente') {
      void poll();
    }
  }, [secondsLeft, status, poll]);

  // Auto-redirect em confirmado
  useEffect(() => {
    if (status === 'confirmado') {
      toast.success('Pagamento confirmado!');
      const timer = setTimeout(() => {
        router.push(`/palpites?bilhete=${bilheteId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
    return;
  }, [status, bilheteId, router]);

  const onCopy = () => {
    navigator.clipboard.writeText(qrCode).then(
      () => toast.success('Código copiado!'),
      () => toast.error('Erro ao copiar'),
    );
  };

  const onRetry = () => {
    const params = new URLSearchParams();
    params.set('qty', String(resumo.qty));
    router.push(`/comprar?${params.toString()}`);
  };

  // Estado: confirmado
  if (status === 'confirmado') {
    return (
      <div className="mx-auto max-w-sm px-4 py-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-400/20 px-3 py-1.5 font-mono text-xs font-semibold text-green-400">
          ✓ PAGAMENTO CONFIRMADO
        </div>
        <div className="mx-auto my-6 grid h-20 w-20 place-items-center rounded-full bg-green-400/15 text-4xl text-green-400">
          ⚽
        </div>
        <p className="text-sm text-zinc-200">
          {resumo.qty} {resumo.qty === 1 ? 'bilhete liberado' : 'bilhetes liberados'} pra
          palpitar.
        </p>
        <p className="mt-1 text-xs text-zinc-500">redirecionando…</p>
      </div>
    );
  }

  // Estado: expirado / cancelado
  if (status === 'expirado' || status === 'cancelado') {
    return (
      <div className="mx-auto max-w-sm px-4 py-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-400/15 px-3 py-1.5 font-mono text-xs font-semibold text-red-400">
          ⏱ TEMPO ESGOTADO
        </div>
        <div className="bg-red-400/12 mx-auto my-6 grid h-16 w-16 place-items-center rounded-full text-3xl">
          ⌛
        </div>
        <p className="text-sm text-zinc-100">
          <strong>Bilhete expirou</strong>
        </p>
        <p className="mb-6 mt-2 text-xs text-zinc-500">
          Você não pagou em 30min. Sem stress —<br />
          nenhum valor foi cobrado.
        </p>
        <button
          onClick={onRetry}
          className="w-full rounded-lg bg-yellow-400 px-4 py-3 font-bold text-zinc-950"
        >
          GERAR NOVO PIX
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-2 w-full rounded-lg border border-zinc-800 px-4 py-3 text-sm text-zinc-100"
        >
          Voltar
        </button>
      </div>
    );
  }

  // Estado: pendente (default)
  return (
    <div className="mx-auto max-w-sm space-y-4 px-4 py-6">
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-400/15 px-3 py-1.5 font-mono text-xs font-semibold text-orange-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
          AGUARDANDO PAGAMENTO
        </div>
      </div>

      <div className="text-center">
        <h1 className="font-display text-3xl">{formatBRL(valorTotal)}</h1>
        <p className="text-xs text-zinc-500">via PIX · Mercado Pago</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span>
            {resumo.qty} {resumo.qty === 1 ? 'tabela' : 'tabelas'}
          </span>
          <span className="font-mono">{formatBRL(valorTotal)}</span>
        </div>
        {resumo.cashback && (
          <div className="mt-2 flex justify-between border-t border-dashed border-zinc-800 pt-2 text-xs text-green-400">
            <span>
              {resumo.cashback.bandeira} {resumo.cashback.selecao}{' '}
              {Math.round(resumo.cashback.multiplicador)}×
            </span>
            <span className="font-mono">
              {formatBRL(valorTotal * resumo.cashback.multiplicador)} se campeã
            </span>
          </div>
        )}
      </div>

      <div className="mx-auto w-52 rounded-xl bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${qrCodeBase64}`}
          alt="QR code PIX"
          className="aspect-square w-full"
        />
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs">
        <span className="flex-1 truncate text-zinc-500">{qrCode}</span>
        <button
          onClick={onCopy}
          className="rounded bg-yellow-400 px-2 py-1 text-xs font-bold text-zinc-950"
        >
          COPIAR
        </button>
      </div>

      <div className="text-center">
        <p className="text-xs text-zinc-500">Expira em</p>
        <p className="font-mono text-xl font-bold text-orange-400">{formatMMSS(secondsLeft)}</p>
      </div>

      <p className="border-t border-dashed border-zinc-800 pt-3 text-center text-xs text-zinc-500">
        Abre o app do banco · escaneia o QR ou cola o código
        <br />
        Confirmação automática em segundos
      </p>
    </div>
  );
}
