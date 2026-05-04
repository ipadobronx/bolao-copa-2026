import type { ParsedFixture } from './api-football'

export type JogoBanco = {
  id: number
  external_id: string | null
  finalizado: boolean
  gols_casa: number | null
  gols_fora: number | null
  selecao_casa_id: number | null
  selecao_fora_id: number | null
  placeholder_casa: string | null
  placeholder_fora: string | null
  numero_jogo: number
  fase: string
}

export type JogoUpdate = {
  id: number
  gols_casa: number
  gols_fora: number
  finalizado: boolean
}

export type PlaceholderUpdate = {
  id: number
  selecao_casa_id?: number
  selecao_fora_id?: number
}

export type PlaceholderWarning = {
  jogo_id: number
  motivo: string
}

export function calcularUpdateJogo(
  jogo: JogoBanco,
  parsed: ParsedFixture | null,
): JogoUpdate | null {
  if (parsed === null) return null
  if (jogo.finalizado) return null

  const novosGolsCasa = parsed.gols_casa ?? jogo.gols_casa
  const novosGolsFora = parsed.gols_fora ?? jogo.gols_fora

  if (
    novosGolsCasa === jogo.gols_casa &&
    novosGolsFora === jogo.gols_fora &&
    parsed.finalizado === jogo.finalizado
  ) return null

  if (novosGolsCasa === null || novosGolsFora === null) return null

  return { id: jogo.id, gols_casa: novosGolsCasa, gols_fora: novosGolsFora, finalizado: parsed.finalizado }
}
