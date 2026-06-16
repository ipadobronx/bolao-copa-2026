import { JogoRow, type JogoRowData } from '@/components/dashboard/JogoRow';
import type { TabelaPalpite } from '@/components/dashboard/PalpitarButton';

export type ProximosJogosPanelProps = {
  jogos: JogoRowData[];
  errored?: boolean;
  agora?: Date;
  tabelas?: TabelaPalpite[];
};

export function ProximosJogosPanel({ jogos, errored = false, agora, tabelas = [] }: ProximosJogosPanelProps) {
  return (
    <section className="panel border-[#1b1b1e] bg-[#08080a]">
      <header className="panel-header">
        <div className="flex items-center gap-2.5 text-base font-bold">
          <span aria-hidden="true" className="bg-success animate-pulse-dot size-2 rounded-full" />
          Próximos jogos · Copa 2026
        </div>
      </header>
      {errored ? (
        <div className="text-text-muted px-6 py-12 text-center">
          <p className="font-body text-sm">
            Não foi possível carregar os próximos jogos. Tenta atualizar a página.
          </p>
        </div>
      ) : jogos.length === 0 ? (
        <div className="text-text-muted px-6 py-12 text-center">
          <p className="font-display text-2xl">A Copa acabou. Bola pra frente. ⚽</p>
        </div>
      ) : (
        <ul>
          {jogos.map((jogo) => (
            <JogoRow key={jogo.id} jogo={jogo} agora={agora} tabelas={tabelas} />
          ))}
        </ul>
      )}
    </section>
  );
}
