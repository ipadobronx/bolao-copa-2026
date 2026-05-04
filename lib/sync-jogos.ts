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
  if (jogo.finalizado) return null // once finalized, score is authoritative — API corrections require manual admin intervention

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

const VENCEDOR_RE = /Vencedor Jogo (\d+)/i
const PERDEDOR_RE = /Perdedor Jogo (\d+)/i

function determinarWinnerLoser(
  jogo: { gols_casa: number; gols_fora: number; selecao_casa_id: number; selecao_fora_id: number },
  penaltyWinnerSide: 'home' | 'away' | null,
): { winnerId: number; loserId: number } | null {
  if (jogo.gols_casa > jogo.gols_fora) return { winnerId: jogo.selecao_casa_id, loserId: jogo.selecao_fora_id }
  if (jogo.gols_fora > jogo.gols_casa) return { winnerId: jogo.selecao_fora_id, loserId: jogo.selecao_casa_id }
  if (penaltyWinnerSide === 'home') return { winnerId: jogo.selecao_casa_id, loserId: jogo.selecao_fora_id }
  if (penaltyWinnerSide === 'away') return { winnerId: jogo.selecao_fora_id, loserId: jogo.selecao_casa_id }
  return null
}

export function calcularResolucoesPlaceholder(
  jogoFinalizado: JogoUpdate & { selecao_casa_id: number; selecao_fora_id: number; numero_jogo: number },
  jogosComPlaceholder: JogoBanco[],
  penaltyWinnerSide: 'home' | 'away' | null,
): { updates: PlaceholderUpdate[]; warnings: PlaceholderWarning[] } {
  const updates: PlaceholderUpdate[] = []
  const warnings: PlaceholderWarning[] = []
  const winner = determinarWinnerLoser(jogoFinalizado, penaltyWinnerSide)
  const num = jogoFinalizado.numero_jogo

  for (const jogo of jogosComPlaceholder) {
    const update: PlaceholderUpdate = { id: jogo.id }
    let mudou = false

    for (const lado of [
      { placeholder: jogo.placeholder_casa, resolvidoId: jogo.selecao_casa_id, campo: 'selecao_casa_id' as const },
      { placeholder: jogo.placeholder_fora, resolvidoId: jogo.selecao_fora_id, campo: 'selecao_fora_id' as const },
    ]) {
      if (!lado.placeholder || lado.resolvidoId !== null) continue

      const vM = VENCEDOR_RE.exec(lado.placeholder)
      const pM = PERDEDOR_RE.exec(lado.placeholder)

      if (vM) {
        if (Number(vM[1]) !== num) continue
        if (!winner) { warnings.push({ jogo_id: jogo.id, motivo: `Empate sem winner de pênaltis — Jogo ${num}` }); continue }
        update[lado.campo] = winner.winnerId; mudou = true
      } else if (pM) {
        if (Number(pM[1]) !== num) continue
        if (!winner) { warnings.push({ jogo_id: jogo.id, motivo: `Empate sem winner de pênaltis — Jogo ${num}` }); continue }
        update[lado.campo] = winner.loserId; mudou = true
      } else {
        warnings.push({ jogo_id: jogo.id, motivo: `Placeholder não reconhecido: "${lado.placeholder}"` })
      }
    }

    if (mudou) updates.push(update)
  }

  return { updates, warnings }
}
