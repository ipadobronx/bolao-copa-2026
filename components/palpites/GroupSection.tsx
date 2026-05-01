import { RodadaSection } from './RodadaSection';
import { inferirRodadas } from '@/lib/palpites';
import type { JogoComSelecoes, PalpiteSalvo } from '@/lib/palpites';

type Props = {
  bilheteId: string;
  grupo: string;
  jogos: JogoComSelecoes[];
  palpitesSalvos: PalpiteSalvo[];
};

export function GroupSection({ bilheteId, grupo, jogos, palpitesSalvos }: Props) {
  const rodadas = inferirRodadas(jogos);

  return (
    <div id={`grupo-${grupo}`} className="mb-6 scroll-mt-4">
      <div className="mb-1 mt-7 flex items-center gap-2.5">
        <h3 className="font-display text-xl tracking-wide">Grupo {grupo}</h3>
        <span className="bg-bg-elevated font-mono text-text-muted rounded-full px-2.5 py-0.5 text-[11px]">
          {jogos.length} jogos
        </span>
      </div>
      {rodadas.map((rodada) => (
        <RodadaSection
          key={rodada.numero}
          bilheteId={bilheteId}
          rodada={rodada}
          palpitesSalvos={palpitesSalvos}
        />
      ))}
    </div>
  );
}
