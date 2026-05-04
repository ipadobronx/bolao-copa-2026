import { describe, it, expect } from 'vitest'
import { calcularUpdatesPalpites, calcularUpdateBonus } from '../recalculo'
import type { CopaResultadosInput } from '../pontuacao'

const COPA: CopaResultadosInput = {
  campeao_id: 10,
  vice_id: 11,
  terceiro_id: 12,
  quarto_id: 13,
  artilheiro_nome: 'Mbappe',
  revelacao_id: 14,
}

// ────────────────────────────────────────────────────────────────────────────
// calcularUpdatesPalpites
// ────────────────────────────────────────────────────────────────────────────
describe('calcularUpdatesPalpites', () => {
  const jogoGrupos = { fase: 'grupos' as const, gols_casa: 2, gols_fora: 1 }
  const jogoFinal  = { fase: 'final' as const,  gols_casa: 2, gols_fora: 1 }

  // caso 1
  it('placar exato → 10 pts', () => {
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 2, gols_fora: 1 }],
      jogoGrupos,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 10 }])
  })

  // caso 2
  it('vencedor + saldo correto → 7 pts', () => {
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 3, gols_fora: 2 }],
      jogoGrupos,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 7 }])
  })

  // caso 3
  it('só vencedor (saldo errado) → 5 pts', () => {
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 3, gols_fora: 1 }],
      jogoGrupos,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 5 }])
  })

  // caso 4 — parcial: acertou gols_casa (2) mas errou vencedor (palpitou fora ganha)
  it('parcial — acertou gols_casa mas errou vencedor → 2 pts', () => {
    // Real: 2×1 (casa vence). Palpite: 2×3 (fora vence) → gols_casa bateu
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 2, gols_fora: 3 }],
      jogoGrupos,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 2 }])
  })

  // caso 5
  it('erro total → 0 pts', () => {
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 0, gols_fora: 3 }],
      jogoGrupos,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 0 }])
  })

  // caso 6 — multiplicador fase final (×4)
  it('fase final multiplica por 4 — exato → 40 pts', () => {
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 2, gols_fora: 1 }],
      jogoFinal,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 40 }])
  })

  // caso 7 — múltiplos palpites
  it('múltiplos palpites calculados independentemente', () => {
    const r = calcularUpdatesPalpites(
      [
        { id: 'p1', gols_casa: 2, gols_fora: 1 }, // exato → 10
        { id: 'p2', gols_casa: 0, gols_fora: 3 }, // erro  →  0
      ],
      jogoGrupos,
    )
    expect(r).toEqual([
      { id: 'p1', pontos_calculados: 10 },
      { id: 'p2', pontos_calculados: 0 },
    ])
  })

  // caso 8 — idempotência
  it('idempotência — rodar 2x produz mesmo resultado', () => {
    const input = [{ id: 'p1', gols_casa: 2, gols_fora: 1 }]
    expect(calcularUpdatesPalpites(input, jogoGrupos)).toEqual(
      calcularUpdatesPalpites(input, jogoGrupos),
    )
  })

  // caso 9
  it('lista vazia → array vazio', () => {
    expect(calcularUpdatesPalpites([], jogoGrupos)).toEqual([])
  })

  // extra: parcial via gols_fora
  it('parcial — acertou gols_fora mas errou vencedor → 2 pts', () => {
    // Real: 2×1 (casa vence). Palpite: 0×1 (fora vence) → gols_fora bateu
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 0, gols_fora: 1 }],
      jogoGrupos,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 2 }])
  })

  // extra: empate não-exato → vencedor (5 pts), nunca vencedor_saldo (7 pts)
  it('empate não-exato → 5 pts (nunca 7 pts)', () => {
    // Real: 1×1. Palpite: 2×2 — acertou empate mas saldo "trivial" não dá 7
    const jogoEmpate = { fase: 'grupos' as const, gols_casa: 1, gols_fora: 1 }
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 2, gols_fora: 2 }],
      jogoEmpate,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 5 }])
  })

  // extra: fase oitavas (×2) com vencedor_saldo (7 × 2 = 14)
  it('fase oitavas multiplica por 2 — vencedor_saldo 7 → 14 pts', () => {
    const jogoOitavas = { fase: 'oitavas' as const, gols_casa: 2, gols_fora: 0 }
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 3, gols_fora: 1 }], // vencedor + saldo (ambos -2) → 7 pts × 2
      jogoOitavas,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 14 }])
  })

  // extra: Math.round aplicado (semis ×3: 2 pts base × 3 = 6, não 5.something)
  it('multiplicador com arredondamento — parcial em semis → 6 pts', () => {
    const jogoSemis = { fase: 'semis' as const, gols_casa: 2, gols_fora: 1 }
    const r = calcularUpdatesPalpites(
      [{ id: 'p1', gols_casa: 2, gols_fora: 3 }], // parcial: 2 pts × 3 = 6
      jogoSemis,
    )
    expect(r).toEqual([{ id: 'p1', pontos_calculados: 6 }])
  })
})

// ────────────────────────────────────────────────────────────────────────────
// calcularUpdateBonus
// ────────────────────────────────────────────────────────────────────────────
describe('calcularUpdateBonus', () => {
  // caso 1
  it('acertou campeão → 50 pts', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'campeao', selecao_id: 10 }],
      COPA,
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 50 }])
  })

  // caso 2
  it('errou campeão → 0 pts', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'campeao', selecao_id: 5 }],
      COPA,
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 0 }])
  })

  // caso 3 — normalização de acento
  it('artilheiro com acento normalizado → 25 pts', () => {
    // 'Mbappé' deve igualar 'Mbappe' após NFD + remoção de diacríticos
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'artilheiro', jogador_nome: 'Mbappé' }],
      COPA,
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 25 }])
  })

  // caso 4 — resultado null no banco
  it('resultado null no banco (vice não definido) → 0 pts', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'vice', selecao_id: 11 }],
      { ...COPA, vice_id: null },
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 0 }])
  })

  // caso 5 — selecao_id null no bilhete
  it('selecao_id null no bilhete → 0 pts', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'campeao', selecao_id: null }],
      COPA,
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 0 }])
  })

  // caso 6 — jogador_nome null no bilhete
  it('jogador_nome null no bilhete → 0 pts', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'artilheiro', jogador_nome: null }],
      COPA,
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 0 }])
  })

  // caso 7 — filtro de tipo
  it('filtro de tipo — só recalcula campeão, ignora vice', () => {
    const rows = [
      { id: 'b1', tipo: 'campeao' as const, selecao_id: 10 },
      { id: 'b2', tipo: 'vice'   as const, selecao_id: 11 },
    ]
    const r = calcularUpdateBonus(rows, COPA, ['campeao'])
    expect(r).toHaveLength(1)
    expect(r[0]).toEqual({ id: 'b1', pontos_calculados: 50 })
  })

  // caso 8 — filtro vazio
  it('filtro vazio → array vazio', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'campeao', selecao_id: 10 }],
      COPA,
      [],
    )
    expect(r).toEqual([])
  })

  // caso 9 — sem filtro processa todos
  it('sem filtro — processa todos os tipos fornecidos', () => {
    const rows = [
      { id: 'b1', tipo: 'campeao'   as const, selecao_id: 10 },
      { id: 'b2', tipo: 'vice'      as const, selecao_id: 11 },
      { id: 'b3', tipo: 'revelacao' as const, selecao_id: 14 },
    ]
    const r = calcularUpdateBonus(rows, COPA)
    expect(r).toHaveLength(3)
    expect(r.find((x) => x.id === 'b1')?.pontos_calculados).toBe(50)
    expect(r.find((x) => x.id === 'b2')?.pontos_calculados).toBe(30)
    expect(r.find((x) => x.id === 'b3')?.pontos_calculados).toBe(15)
  })

  // extra: terceiro, quarto, vice com pontos corretos
  it('acertou vice → 30 pts', () => {
    const r = calcularUpdateBonus([{ id: 'b1', tipo: 'vice', selecao_id: 11 }], COPA)
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 30 }])
  })

  it('acertou terceiro → 15 pts', () => {
    const r = calcularUpdateBonus([{ id: 'b1', tipo: 'terceiro', selecao_id: 12 }], COPA)
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 15 }])
  })

  it('acertou revelacao → 15 pts', () => {
    const r = calcularUpdateBonus([{ id: 'b1', tipo: 'revelacao', selecao_id: 14 }], COPA)
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 15 }])
  })

  // extra: artilheiro case insensitive + espaços extras
  it('artilheiro com maiúsculas e espaços extras → 25 pts', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'artilheiro', jogador_nome: '  MBAPPE  ' }],
      COPA,
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 25 }])
  })

  // extra: artilheiro errado → 0
  it('artilheiro errado → 0 pts', () => {
    const r = calcularUpdateBonus(
      [{ id: 'b1', tipo: 'artilheiro', jogador_nome: 'Ronaldo' }],
      COPA,
    )
    expect(r).toEqual([{ id: 'b1', pontos_calculados: 0 }])
  })

  // extra: lista vazia → array vazio
  it('lista vazia → array vazio', () => {
    expect(calcularUpdateBonus([], COPA)).toEqual([])
  })

  // extra: idempotência
  it('idempotência — rodar 2x produz mesmo resultado', () => {
    const rows = [{ id: 'b1', tipo: 'campeao' as const, selecao_id: 10 }]
    expect(calcularUpdateBonus(rows, COPA)).toEqual(calcularUpdateBonus(rows, COPA))
  })
})
