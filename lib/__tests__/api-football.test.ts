import { describe, it, expect } from 'vitest'
import { parseFixture } from '../api-football'
import type { ApiFixture } from '../api-football'

function makeFixture(overrides: Partial<ApiFixture> = {}): ApiFixture {
  return {
    fixture: { id: 1001, date: '2026-06-11T16:00:00+00:00', status: { short: 'NS' } },
    teams: { home: { id: 10, name: 'Brazil' }, away: { id: 11, name: 'Mexico' } },
    goals: { home: null, away: null },
    score: { penalty: { home: null, away: null } },
    league: { round: 'Group Stage' },
    ...overrides,
  }
}

describe('parseFixture', () => {
  it('NS → null', () => {
    expect(parseFixture(makeFixture({ fixture: { id: 1, date: '', status: { short: 'NS' } } }))).toBeNull()
  })

  it('PST → null', () => {
    expect(parseFixture(makeFixture({ fixture: { id: 1, date: '', status: { short: 'PST' } } }))).toBeNull()
  })

  it('FT normal → finalizado=true, gols corretos, sem penalty', () => {
    const f = makeFixture({
      fixture: { id: 1001, date: '', status: { short: 'FT' } },
      goals: { home: 2, away: 1 },
    })
    expect(parseFixture(f)).toEqual({
      externalId: '1001',
      finalizado: true,
      gols_casa: 2,
      gols_fora: 1,
      penaltyWinnerSide: null,
    })
  })

  it('AET → finalizado=true, sem penalty', () => {
    const f = makeFixture({
      fixture: { id: 1002, date: '', status: { short: 'AET' } },
      goals: { home: 1, away: 0 },
    })
    const r = parseFixture(f)
    expect(r?.finalizado).toBe(true)
    expect(r?.penaltyWinnerSide).toBeNull()
  })

  it('PEN — home vence → penaltyWinnerSide=home', () => {
    const f = makeFixture({
      fixture: { id: 1003, date: '', status: { short: 'PEN' } },
      goals: { home: 1, away: 1 },
      score: { penalty: { home: 4, away: 2 } },
    })
    const r = parseFixture(f)
    expect(r?.finalizado).toBe(true)
    expect(r?.gols_casa).toBe(1)
    expect(r?.gols_fora).toBe(1)
    expect(r?.penaltyWinnerSide).toBe('home')
  })

  it('PEN — away vence → penaltyWinnerSide=away', () => {
    const f = makeFixture({
      fixture: { id: 1004, date: '', status: { short: 'PEN' } },
      goals: { home: 0, away: 0 },
      score: { penalty: { home: 3, away: 5 } },
    })
    expect(parseFixture(f)?.penaltyWinnerSide).toBe('away')
  })

  it('2H (ao vivo) → finalizado=false, gols atualizados', () => {
    const f = makeFixture({
      fixture: { id: 1005, date: '', status: { short: '2H' } },
      goals: { home: 0, away: 1 },
    })
    expect(parseFixture(f)).toEqual({
      externalId: '1005',
      finalizado: false,
      gols_casa: 0,
      gols_fora: 1,
      penaltyWinnerSide: null,
    })
  })

  it('HT → finalizado=false', () => {
    const f = makeFixture({
      fixture: { id: 1006, date: '', status: { short: 'HT' } },
      goals: { home: 1, away: 1 },
    })
    expect(parseFixture(f)?.finalizado).toBe(false)
  })

  it('1H com goals null → finalizado=false, gols null', () => {
    const f = makeFixture({
      fixture: { id: 1007, date: '', status: { short: '1H' } },
      goals: { home: null, away: null },
    })
    expect(parseFixture(f)).toEqual({
      externalId: '1007',
      finalizado: false,
      gols_casa: null,
      gols_fora: null,
      penaltyWinnerSide: null,
    })
  })
})
