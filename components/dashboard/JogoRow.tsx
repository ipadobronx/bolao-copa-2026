import { formatDataRelativa } from '@/lib/format/data-relativa';
import type { Database } from '@/lib/supabase/types';
import { BandeiraImg } from '@/components/ui/BandeiraImg';
import { PalpitarButton, type TabelaPalpite } from '@/components/dashboard/PalpitarButton';

type FaseEnum = Database['public']['Enums']['fase_jogo'];

export type JogoRowData = {
  id: number;
  data_hora: string;
  fase: FaseEnum;
  placeholder_casa: string | null;
  placeholder_fora: string | null;
  casa: { nome: string; bandeira_emoji: string } | null;
  fora: { nome: string; bandeira_emoji: string } | null;
};

export type JogoRowProps = {
  jogo: JogoRowData;
  agora?: Date | undefined; // override pra testes; default = new Date()
  tabelas?: TabelaPalpite[];
};

export function JogoRow({ jogo, agora = new Date(), tabelas = [] }: JogoRowProps) {
  const { date, hour } = formatDataRelativa({ data: new Date(jogo.data_hora), agora });
  const tbd = !jogo.casa || !jogo.fora;

  return (
    <li className="border-border flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <div className="w-14 shrink-0 font-mono text-[11px] leading-tight">
        <div className="text-text-primary font-semibold">{date}</div>
        <div className="text-text-muted">{hour}</div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-sm font-semibold">
        {jogo.casa ? (
          <>
            <BandeiraImg emoji={jogo.casa.bandeira_emoji} nome={jogo.casa.nome} size={20} />
            <span className="truncate">{jogo.casa.nome}</span>
          </>
        ) : (
          <span className="text-text-muted truncate font-mono text-xs">
            {jogo.placeholder_casa ?? 'TBD'}
          </span>
        )}

        <span className="text-text-muted shrink-0 px-0.5">×</span>

        {jogo.fora ? (
          <>
            <span className="truncate">{jogo.fora.nome}</span>
            <BandeiraImg emoji={jogo.fora.bandeira_emoji} nome={jogo.fora.nome} size={20} />
          </>
        ) : (
          <span className="text-text-muted truncate font-mono text-xs">
            {jogo.placeholder_fora ?? 'TBD'}
          </span>
        )}
      </div>

      <div className="shrink-0">
        {tbd ? (
          <span
            aria-disabled="true"
            title="Aguarde os times serem definidos"
            className="btn-sm pointer-events-none cursor-not-allowed opacity-50"
          >
            Palpitar
          </span>
        ) : (
          <PalpitarButton jogoId={jogo.id} tabelas={tabelas} />
        )}
      </div>
    </li>
  );
}
