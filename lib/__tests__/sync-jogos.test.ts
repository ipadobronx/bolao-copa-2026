import { describe, it, expect } from 'vitest'
import { calcularUpdateJogo, calcularResolucoesPlaceholder } from '../sync-jogos'
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

function makeJogoFinalizado(numero_jogo: number, gols_casa: number, gols_fora: number) {
  return { id: numero_jogo, gols_casa, gols_fora, finalizado: true, selecao_casa_id: 10, selecao_fora_id: 11, numero_jogo }
}

function makeDependent(id: number, placeholder_casa: string | null, placeholder_fora: string | null, overrides: Partial<JogoBanco> = {}): JogoBanco {
  return {
    id,
    external_id: null,
    finalizado: false,
    gols_casa: null,
    gols_fora: null,
    selecao_casa_id: null,
    selecao_fora_id: null,
    placeholder_casa,
    placeholder_fora,
    numero_jogo: id,
    fase: '16avos',
    ...overrides,
  }
}

describe('calcularResolucoesPlaceholder', () => {
  it('lista vazia → updates=[], warnings=[]', () => {
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 2, 1), [], null)
    expect(r).toEqual({ updates: [], warnings: [] })
  })

  it('vencedor lado casa — home vence 2×1', () => {
    const dep = makeDependent(49, 'Vencedor Jogo 45', null)
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 2, 1), [dep], null)
    expect(r.updates).toEqual([{ id: 49, selecao_casa_id: 10 }])
    expect(r.warnings).toHaveLength(0)
  })

  it('vencedor lado fora — away vence 0×1', () => {
    const dep = makeDependent(50, null, 'Vencedor Jogo 45')
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 0, 1), [dep], null)
    expect(r.updates).toEqual([{ id: 50, selecao_fora_id: 11 }])
  })

  it('perdedor (3º lugar) — jogo 47 termina 1×3, placeholder perdedor', () => {
    const dep = makeDependent(99, 'Perdedor Jogo 47', null)
    const jogo = { id: 47, gols_casa: 1, gols_fora: 3, finalizado: true, selecao_casa_id: 20, selecao_fora_id: 21, numero_jogo: 47 }
    const r = calcularResolucoesPlaceholder(jogo, [dep], null)
    expect(r.updates).toEqual([{ id: 99, selecao_casa_id: 20 }])
  })

  it('PEN home vence — placeholder fora aponta pra vencedor', () => {
    const dep = makeDependent(60, null, 'Vencedor Jogo 49')
    const jogo = makeJogoFinalizado(49, 1, 1)
    const r = calcularResolucoesPlaceholder(jogo, [dep], 'home')
    expect(r.updates).toEqual([{ id: 60, selecao_fora_id: 10 }])
  })

  it('selecao_*_id já preenchido → skip (idempotente)', () => {
    const dep = makeDependent(49, 'Vencedor Jogo 45', null, { selecao_casa_id: 10 })
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 2, 1), [dep], null)
    expect(r.updates).toHaveLength(0)
  })

  it('placeholder não reconhecido → warning, sem update', () => {
    const dep = makeDependent(70, 'V QF3', null)
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 2, 1), [dep], null)
    expect(r.updates).toHaveLength(0)
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]?.motivo).toMatch(/não reconhecido/i)
  })

  it('empate sem pênaltis → warning por jogo dependente', () => {
    const dep = makeDependent(49, 'Vencedor Jogo 45', null)
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 1, 1), [dep], null)
    expect(r.updates).toHaveLength(0)
    expect(r.warnings[0]?.motivo).toMatch(/empate/i)
  })

  it('jogo diferente no placeholder → skip silencioso', () => {
    const dep = makeDependent(49, 'Vencedor Jogo 46', null)
    const r = calcularResolucoesPlaceholder(makeJogoFinalizado(45, 2, 1), [dep], null)
    expect(r.updates).toHaveLength(0)
    expect(r.warnings).toHaveLength(0)
  })
})
