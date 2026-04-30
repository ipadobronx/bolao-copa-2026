import Link from 'next/link';
import type { Route } from 'next';
import { formatDataRelativa } from '@/lib/format/data-relativa';
import type { Database } from '@/lib/supabase/types';

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
};

const FASE_LABEL: Record<FaseEnum, string> = {
  grupos: 'Grupos',
  '16avos': '16-avos',
  oitavas: 'Oitavas',
  quartas: 'Quartas',
  semis: 'Semis',
  disputa_terceiro: 'Disputa de 3º',
  final: 'Final',
};

export function JogoRow({ jogo, agora = new Date() }: JogoRowProps) {
  const { date, hour } = formatDataRelativa({ data: new Date(jogo.data_hora), agora });
  const tbd = !jogo.casa || !jogo.fora;

  return (
    <li className="border-border grid grid-cols-1 items-center gap-3 border-b px-6 py-5 text-center last:border-b-0 md:grid-cols-[120px_1fr_auto_1fr_120px] md:text-left">
      <div className="font-mono text-xs">
        <div className="text-text-primary font-semibold">{date}</div>
        <div className="text-text-muted">{hour}</div>
      </div>

      <div className="flex items-center justify-center gap-3 font-semibold md:justify-start">
        {jogo.casa ? (
          <>
            <span aria-hidden="true" className="text-[28px] leading-none">
              {jogo.casa.bandeira_emoji}
            </span>
            <span>{jogo.casa.nome}</span>
          </>
        ) : (
          <span className="text-text-muted text-sm font-mono">{jogo.placeholder_casa ?? 'TBD'}</span>
        )}
      </div>

      <div className="text-text-muted text-base">×</div>

      <div className="flex items-center justify-center gap-3 font-semibold md:justify-end md:text-right">
        {jogo.fora ? (
          <>
            <span>{jogo.fora.nome}</span>
            <span aria-hidden="true" className="text-[28px] leading-none">
              {jogo.fora.bandeira_emoji}
            </span>
          </>
        ) : (
          <span className="text-text-muted text-sm font-mono">{jogo.placeholder_fora ?? 'TBD'}</span>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 md:justify-end">
        {tbd ? (
          <span
            aria-disabled="true"
            title="Aguarde os times serem definidos"
            className="btn-sm pointer-events-none cursor-not-allowed opacity-50"
          >
            Palpitar
          </span>
        ) : (
          <Link href={`/palpites/${jogo.id}` as Route} className="btn-sm">
            Palpitar
          </Link>
        )}
        <span className="text-text-muted hidden font-mono text-[10px] uppercase tracking-wider md:inline">
          {FASE_LABEL[jogo.fase]}
        </span>
      </div>
    </li>
  );
}
