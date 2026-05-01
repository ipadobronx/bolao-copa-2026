import { MatchRow } from './MatchRow';
import type { FaseJogo, JogoComSelecoes, PalpiteSalvo } from '@/lib/palpites';

const FASE_LABELS: Record<FaseJogo, string> = {
  grupos: 'Grupos',
  '16avos': '16avos de Final',
  oitavas: 'Oitavas de Final',
  quartas: 'Quartas de Final',
  semis: 'Semifinais',
  disputa_terceiro: 'Disputa pelo 3° Lugar',
  final: 'Final',
};

type Props = {
  bilheteId: string;
  fase: FaseJogo;
  jogos: JogoComSelecoes[];
  palpitesSalvos: PalpiteSalvo[];
};

export function FaseTab({ bilheteId, fase, jogos, palpitesSalvos }: Props) {
  const salvoMap = new Map(palpitesSalvos.map((p) => [p.jogo_id, p]));
  const jogosDaFase = jogos
    .filter((j) => j.fase === fase)
    .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());

  return (
    <div>
      <h2 className="font-display mb-5 text-3xl">
        <span className="text-accent">{FASE_LABELS[fase]}</span>
      </h2>
      {jogosDaFase.length === 0 ? (
        <p className="text-text-muted text-sm">Nenhum jogo nesta fase ainda.</p>
      ) : (
        jogosDaFase.map((jogo) => (
          <MatchRow
            key={jogo.id}
            bilheteId={bilheteId}
            jogo={jogo}
            palpiteSalvo={salvoMap.get(jogo.id) ?? null}
          />
        ))
      )}
    </div>
  );
}
