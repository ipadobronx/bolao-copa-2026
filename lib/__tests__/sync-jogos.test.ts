import { describe, it, expect } from 'vitest'
import { calcularUpdateJogo } from '../sync-jogos'
import type { JogoBanco } from '../sync-jogos'
import type { ParsedFixture } from '../api-football'

function makeJogo(overrides: Partial<JogoBanco> = {}): JogoBanco {
  return {
    id: 45,
    external_id: '1001',
    finalizado: false,
    gols_casa: null,
    gols_fora: null,
    selecao_casa_id: 10,
    selecao_fora_id: 11,
    placeholder_casa: null,
    placeholder_fora: null,
    numero_jogo: 45,
    fase: 'grupos',
    ...overrides,
  }
}

const parsedFT: ParsedFixture = {
  externalId: '1001',
  finalizado: true,
  gols_casa: 2,
  gols_fora: 1,
  penaltyWinnerSide: null,
}

describe('calcularUpdateJogo', () => {
  it('fixture null (NS) → null', () => {
    expect(calcularUpdateJogo(makeJogo(), null)).toBeNull()
  })

  it('jogo já finalizado no banco → null (idempotente)', () => {
    expect(calcularUpdateJogo(makeJogo({ finalizado: true, gols_casa: 2, gols_fora: 1 }), parsedFT)).toBeNull()
  })

  it('gols iguais ao banco, sem mudança → null', () => {
    const jogo = makeJogo({ gols_casa: 2, gols_fora: 1 })
    const parsed: ParsedFixture = { externalId: '1001', finalizado: false, gols_casa: 2, gols_fora: 1, penaltyWinnerSide: null }
    expect(calcularUpdateJogo(jogo, parsed)).toBeNull()
  })

  it('finalização: banco=pendente, API=FT → update com finalizado=true', () => {
    const r = calcularUpdateJogo(makeJogo(), parsedFT)
    expect(r).toEqual({ id: 45, gols_casa: 2, gols_fora: 1, finalizado: true })
  })

  it('atualização ao vivo: banco sem gols, API=2H 1×0 → update com finalizado=false', () => {
    const parsed: ParsedFixture = { externalId: '1001', finalizado: false, gols_casa: 1, gols_fora: 0, penaltyWinnerSide: null }
    const r = calcularUpdateJogo(makeJogo(), parsed)
    expect(r).toEqual({ id: 45, gols_casa: 1, gols_fora: 0, finalizado: false })
  })

  it('idempotência — rodar 2x retorna mesmo resultado', () => {
    const r1 = calcularUpdateJogo(makeJogo(), parsedFT)
    const r2 = calcularUpdateJogo(makeJogo(), parsedFT)
    expect(r1).toEqual(r2)
  })
})
