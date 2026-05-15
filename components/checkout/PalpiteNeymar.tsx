'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Gift } from 'lucide-react';
import { BandeiraImg } from '@/components/ui/BandeiraImg';
import { salvarPalpiteNeymar } from '@/app/(dashboard)/comprar/actions';

type PalpiteNeymarProps = {
  palpiteAtual: boolean | null;
  deadline: string;
  pergunta: string;
};

const formatDeadline = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

export function PalpiteNeymar({ palpiteAtual, deadline, pergunta }: PalpiteNeymarProps) {
  const [resposta, setResposta] = useState<boolean | null>(palpiteAtual);
  const [pending, startTransition] = useTransition();

  const aberto = new Date(deadline).getTime() > Date.now();

  const handle = (nova: boolean) => {
    if (!aberto || pending) return;
    if (resposta === nova) return;
    const previa = resposta;
    setResposta(nova); // optimistic
    startTransition(async () => {
      const result = await salvarPalpiteNeymar({ resposta: nova });
      if (result.ok) {
        toast.success('Palpite salvo!');
      } else {
        setResposta(previa); // rollback
        if (result.error === 'deadline') {
          toast.error('Janela de respostas encerrada.');
        } else {
          toast.error(result.mensagem ?? 'Não rolou. Tenta de novo.');
        }
      }
    });
  };

  const respostaTexto = resposta === true ? 'SIM' : resposta === false ? 'NÃO' : null;

  return (
    <section data-testid="palpite-neymar">
      <h2 className="mb-3 font-display text-lg uppercase tracking-wide">Palpite bônus</h2>
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="flex items-center gap-2 font-semibold text-zinc-100">
          <BandeiraImg emoji="🇧🇷" nome="Brasil" size={22} />
          <span>{pergunta}</span>
        </p>

        {aberto ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {([true, false] as const).map((valor) => {
                const selected = resposta === valor;
                return (
                  <button
                    key={valor ? 'sim' : 'nao'}
                    type="button"
                    onClick={() => handle(valor)}
                    disabled={pending}
                    data-testid={`neymar-${valor ? 'sim' : 'nao'}`}
                    aria-pressed={selected}
                    className={`relative rounded-lg border px-3 py-3 font-display text-lg uppercase tracking-wide transition disabled:opacity-50 ${
                      selected
                        ? 'border-yellow-400 bg-yellow-400/10 text-yellow-300'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    {valor ? 'SIM' : 'NÃO'}
                    {selected && (
                      <span
                        data-testid="badge-sua-neymar"
                        className="absolute right-2 top-2 rounded bg-yellow-400 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-950"
                      >
                        SUA
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="flex items-center gap-1.5 font-mono text-xs text-zinc-400">
              <Gift size={12} className="text-yellow-400" />
              Se acertar, ganha 1 tabela grátis · respostas até {formatDeadline(deadline)}
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-300">
            {respostaTexto ? (
              <>
                Você palpitou: <strong className="text-yellow-300">{respostaTexto}</strong> ·
                respostas encerradas em {formatDeadline(deadline)}
              </>
            ) : (
              <>Respostas encerradas em {formatDeadline(deadline)}.</>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
