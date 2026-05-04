import type { FaseJogo } from './pontuacao'

export type ApiFixtureStatus =
  | 'NS' | 'LIVE' | '1H' | 'HT' | '2H' | 'ET' | 'BT' | 'P'
  | 'FT' | 'AET' | 'PEN' | 'PST' | 'CANC' | 'ABD' | 'AWD' | 'WO'

export type ApiFixture = {
  fixture: { id: number; date: string; status: { short: ApiFixtureStatus } }
  teams: { home: { id: number; name: string }; away: { id: number; name: string } }
  goals: { home: number | null; away: number | null }
  score: { penalty: { home: number | null; away: number | null } }
  league: { round: string }
}

export type ParsedFixture = {
  externalId: string
  finalizado: boolean
  gols_casa: number | null
  gols_fora: number | null
  penaltyWinnerSide: 'home' | 'away' | null
} | null

// Nomes API-Football → nomes do banco (PT). Validar contra API antes do 1º deploy.
export const TEAM_NAME_MAP: Record<string, string> = {
  'Brazil': 'Brasil',
  'France': 'França',
  'Germany': 'Alemanha',
  'Spain': 'Espanha',
  'England': 'Inglaterra',
  'Portugal': 'Portugal',
  'Netherlands': 'Holanda',
  'Argentina': 'Argentina',
  'Belgium': 'Bélgica',
  'Switzerland': 'Suíça',
  'Norway': 'Noruega',
  'Colombia': 'Colômbia',
  'Uruguay': 'Uruguai',
  'Italy': 'Itália',
  'Croatia': 'Croácia',
  'Denmark': 'Dinamarca',
  'Austria': 'Áustria',
  'Serbia': 'Sérvia',
  'Poland': 'Polônia',
  'USA': 'Estados Unidos',
  'Mexico': 'México',
  'Canada': 'Canadá',
  'Costa Rica': 'Costa Rica',
  'Panama': 'Panamá',
  'Jamaica': 'Jamaica',
  'Japan': 'Japão',
  'South Korea': 'Coreia do Sul',
  'Iran': 'Irã',
  'Saudi Arabia': 'Arábia Saudita',
  'Australia': 'Austrália',
  'Morocco': 'Marrocos',
  'Senegal': 'Senegal',
  'Nigeria': 'Nigéria',
  'Cameroon': 'Camarões',
  'Egypt': 'Egito',
  'Ghana': 'Gana',
  'South Africa': 'África do Sul',
  'Tunisia': 'Tunísia',
  'Algeria': 'Argélia',
  'Ecuador': 'Equador',
  'Venezuela': 'Venezuela',
  'Paraguay': 'Paraguai',
  'Chile': 'Chile',
  'Bolivia': 'Bolívia',
  'Peru': 'Peru',
  'New Zealand': 'Nova Zelândia',
  'Jordan': 'Jordânia',
  'Iraq': 'Iraque',
}

export const ROUND_FASE_MAP: Record<string, FaseJogo> = {
  'Group Stage': 'grupos',
  'Round of 32': '16avos',
  'Round of 16': 'oitavas',
  'Quarter-finals': 'quartas',
  'Semi-finals': 'semis',
  '3rd Place Final': 'disputa_terceiro',
  'Final': 'final',
}

const API_BASE = 'https://v3.football.api-sports.io'

// serverEnv is imported lazily inside apiFetch so it is never evaluated during
// Vitest test collection (where env vars are not set). parseFixture is pure and
// does not depend on serverEnv at all.
async function apiFetch(path: string): Promise<ApiFixture[]> {
  const { serverEnv } = await import('./env-server')
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-apisports-key': serverEnv.API_FOOTBALL_KEY },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as { response: ApiFixture[] }
  return json.response
}

export async function fetchFixtures(externalIds: string[]): Promise<ApiFixture[]> {
  if (externalIds.length === 0) return []
  return apiFetch(`/fixtures?ids=${externalIds.join('-')}`)
}

export async function fetchAllFixtures(league: number, season: number): Promise<ApiFixture[]> {
  return apiFetch(`/fixtures?league=${league}&season=${season}`)
}

export async function fetchFixturesByDate(date: string): Promise<ApiFixture[]> {
  return apiFetch(`/fixtures?date=${date}&league=1&season=2026`)
}

const IGNORABLE: ApiFixtureStatus[] = ['NS', 'PST', 'CANC', 'ABD', 'AWD', 'WO']
const LIVE_STATUSES: ApiFixtureStatus[] = ['LIVE', '1H', 'HT', '2H', 'ET', 'BT', 'P']
const FINISHED: ApiFixtureStatus[] = ['FT', 'AET', 'PEN']

export function parseFixture(fixture: ApiFixture): ParsedFixture {
  const status = fixture.fixture.status.short
  if (IGNORABLE.includes(status)) return null
  if (!LIVE_STATUSES.includes(status) && !FINISHED.includes(status)) return null

  const isFinished = FINISHED.includes(status)
  let penaltyWinnerSide: 'home' | 'away' | null = null

  if (status === 'PEN') {
    const ph = fixture.score.penalty.home ?? 0
    const pa = fixture.score.penalty.away ?? 0
    penaltyWinnerSide = ph >= pa ? 'home' : 'away'
  }

  return {
    externalId: String(fixture.fixture.id),
    finalizado: isFinished,
    gols_casa: fixture.goals.home,
    gols_fora: fixture.goals.away,
    penaltyWinnerSide,
  }
}
