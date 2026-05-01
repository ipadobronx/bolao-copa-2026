export type FaseJogo =
  | 'grupos'
  | '16avos'
  | 'oitavas'
  | 'quartas'
  | 'semis'
  | 'disputa_terceiro'
  | 'final';

export type TipoBonus =
  | 'campeao'
  | 'vice'
  | 'terceiro'
  | 'quarto'
  | 'artilheiro'
  | 'revelacao';

export type StatusPagamento = 'pendente' | 'confirmado' | 'expirado' | 'cancelado';

export type SelecaoBasica = {
  id: number;
  nome: string;
  bandeira_emoji: string;
  codigo_iso?: string | null;
  grupo: string | null;
};

export type JogoComSelecoes = {
  id: number;
  numero_jogo: number;
  fase: FaseJogo;
  data_hora: string;
  finalizado: boolean;
  gols_casa: number | null;
  gols_fora: number | null;
  selecao_casa_id: number | null;
  selecao_fora_id: number | null;
  placeholder_casa: string | null;
  placeholder_fora: string | null;
  selecao_casa: SelecaoBasica | null;
  selecao_fora: SelecaoBasica | null;
};

export type PalpiteSalvo = {
  jogo_id: number;
  gols_casa: number;
  gols_fora: number;
  pontos_calculados: number | null;
};

export type BonusSalvo = {
  tipo: TipoBonus;
  selecao_id: number | null;
  jogador_nome: string | null;
};

export type BilheteResumo = {
  id: string;
  numero_bilhete: number;
  valor_pago: number;
  status_pagamento: StatusPagamento;
  selecao_cashback_id: number | null;
};

export type MatchEstado = 'open' | 'locked' | 'finalized';

export type Rodada = {
  numero: 1 | 2 | 3;
  jogos: JogoComSelecoes[];
  deadline: string;
};

export function computeMatchEstado(jogo: JogoComSelecoes, agora: Date): MatchEstado {
  if (jogo.finalizado) return 'finalized';
  if (new Date(jogo.data_hora) <= agora) return 'locked';
  return 'open';
}

export function inferirRodadas(jogosDoGrupo: JogoComSelecoes[]): Rodada[] {
  const sorted = [...jogosDoGrupo].sort(
    (a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime(),
  );

  const chunks: [JogoComSelecoes[], JogoComSelecoes[], JogoComSelecoes[]] = [
    sorted.slice(0, 2),
    sorted.slice(2, 4),
    sorted.slice(4, 6),
  ];

  return chunks.map((jogos, i) => ({
    numero: (i + 1) as 1 | 2 | 3,
    jogos,
    deadline: jogos.reduce((min, j) =>
      new Date(j.data_hora) < new Date(min) ? j.data_hora : min,
      jogos[0]!.data_hora,
    ),
  }));
}

export function groupGamesByGrupo(jogos: JogoComSelecoes[]): Map<string, JogoComSelecoes[]> {
  const map = new Map<string, JogoComSelecoes[]>();

  for (const jogo of jogos) {
    if (jogo.fase !== 'grupos') continue;
    const grupo = jogo.selecao_casa?.grupo ?? jogo.selecao_fora?.grupo;
    if (!grupo) continue;
    const list = map.get(grupo) ?? [];
    list.push(jogo);
    map.set(grupo, list);
  }

  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}
