import { describe, expect, it } from 'vitest';
import {
  computeMatchEstado,
  groupGamesByGrupo,
  inferirRodadas,
  type JogoComSelecoes,
} from '@/lib/palpites';

function makeJogo(overrides: Partial<JogoComSelecoes>): JogoComSelecoes {
  return {
    id: 1,
    numero_jogo: 1,
    fase: 'grupos',
    data_hora: new Date(Date.now() + 86400000).toISOString(),
    finalizado: false,
    gols_casa: null,
    gols_fora: null,
    selecao_casa_id: 1,
    selecao_fora_id: 2,
    placeholder_casa: null,
    placeholder_fora: null,
    selecao_casa: { id: 1, nome: 'Brasil', bandeira_emoji: '🇧🇷', grupo: 'B' },
    selecao_fora: { id: 2, nome: 'Argentina', bandeira_emoji: '🇦🇷', grupo: 'B' },
    ...overrides,
  };
}

const AGORA = new Date('2026-06-15T12:00:00Z');

describe('computeMatchEstado', () => {
  it('finalizado → "finalized"', () => {
    const j = makeJogo({ finalizado: true, data_hora: '2026-06-11T16:00:00Z' });
    expect(computeMatchEstado(j, AGORA)).toBe('finalized');
  });

  it('data_hora passada e não finalizado → "locked"', () => {
    const j = makeJogo({ data_hora: '2026-06-14T16:00:00Z', finalizado: false });
    expect(computeMatchEstado(j, AGORA)).toBe('locked');
  });

  it('data_hora futura → "open"', () => {
    const j = makeJogo({ data_hora: '2026-06-16T16:00:00Z', finalizado: false });
    expect(computeMatchEstado(j, AGORA)).toBe('open');
  });

  it('finalizado prevalece sobre data passada', () => {
    const j = makeJogo({ data_hora: '2026-06-10T16:00:00Z', finalizado: true });
    expect(computeMatchEstado(j, AGORA)).toBe('finalized');
  });
});

describe('inferirRodadas', () => {
  const jogos = [
    makeJogo({ id: 1, data_hora: '2026-06-11T16:00:00Z' }),
    makeJogo({ id: 2, data_hora: '2026-06-11T19:00:00Z' }),
    makeJogo({ id: 3, data_hora: '2026-06-15T16:00:00Z' }),
    makeJogo({ id: 4, data_hora: '2026-06-15T19:00:00Z' }),
    makeJogo({ id: 5, data_hora: '2026-06-19T16:00:00Z' }),
    makeJogo({ id: 6, data_hora: '2026-06-19T19:00:00Z' }),
  ];

  it('retorna 3 rodadas com 2 jogos cada', () => {
    const rodadas = inferirRodadas(jogos);
    expect(rodadas).toHaveLength(3);
    rodadas.forEach((r) => expect(r.jogos).toHaveLength(2));
  });

  it('rodadas são ordenadas por numero 1, 2, 3', () => {
    const rodadas = inferirRodadas(jogos);
    expect(rodadas.map((r) => r.numero)).toEqual([1, 2, 3]);
  });

  it('deadline de cada rodada é o min(data_hora) dos seus jogos', () => {
    const rodadas = inferirRodadas(jogos);
    expect(rodadas[0].deadline).toBe('2026-06-11T16:00:00Z');
    expect(rodadas[1].deadline).toBe('2026-06-15T16:00:00Z');
    expect(rodadas[2].deadline).toBe('2026-06-19T16:00:00Z');
  });

  it('funciona com jogos desordenados como input', () => {
    const shuffled = [jogos[4], jogos[2], jogos[0], jogos[5], jogos[3], jogos[1]];
    const rodadas = inferirRodadas(shuffled);
    expect(rodadas[0].jogos.map((j) => j.id).sort()).toEqual([1, 2]);
    expect(rodadas[2].jogos.map((j) => j.id).sort()).toEqual([5, 6]);
  });
});

describe('groupGamesByGrupo', () => {
  const jogoGrupoA1 = makeJogo({
    id: 1,
    selecao_casa: { id: 1, nome: 'México', bandeira_emoji: '🇲🇽', grupo: 'A' },
    selecao_fora: { id: 2, nome: 'Canadá', bandeira_emoji: '🇨🇦', grupo: 'A' },
  });
  const jogoGrupoA2 = makeJogo({
    id: 2,
    selecao_casa: { id: 3, nome: 'EUA', bandeira_emoji: '🇺🇸', grupo: 'A' },
    selecao_fora: { id: 4, nome: 'Jamaica', bandeira_emoji: '🇯🇲', grupo: 'A' },
  });
  const jogoGrupoB = makeJogo({
    id: 3,
    selecao_casa: { id: 5, nome: 'Brasil', bandeira_emoji: '🇧🇷', grupo: 'B' },
    selecao_fora: { id: 6, nome: 'Argentina', bandeira_emoji: '🇦🇷', grupo: 'B' },
  });
  const jogoOitavas = makeJogo({
    id: 4,
    fase: 'oitavas',
    selecao_casa_id: null,
    selecao_casa: null,
  });

  it('agrupa apenas jogos com fase="grupos"', () => {
    const map = groupGamesByGrupo([jogoGrupoA1, jogoGrupoA2, jogoGrupoB, jogoOitavas]);
    expect([...map.keys()]).toEqual(['A', 'B']);
  });

  it('grupo A tem 2 jogos', () => {
    const map = groupGamesByGrupo([jogoGrupoA1, jogoGrupoA2, jogoGrupoB]);
    expect(map.get('A')).toHaveLength(2);
  });

  it('grupos são retornados em ordem A, B, C…', () => {
    const jogoC = makeJogo({
      id: 5,
      selecao_casa: { id: 7, nome: 'X', bandeira_emoji: '', grupo: 'C' },
      selecao_fora: { id: 8, nome: 'Y', bandeira_emoji: '', grupo: 'C' },
    });
    const map = groupGamesByGrupo([jogoGrupoB, jogoC, jogoGrupoA1]);
    expect([...map.keys()]).toEqual(['A', 'B', 'C']);
  });
});
