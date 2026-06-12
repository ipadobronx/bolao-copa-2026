import type { ClassePalpite } from '@/lib/pontuacao'

/** Limiar de pontos no dia que rende o 💎. Tunável. */
export const DIAMANTE_MIN_PONTOS = 25

const EMOJI_POR_CLASSE: Record<ClassePalpite, string> = {
  exato: '🔥',
  vencedor_saldo: '👍',
  vencedor: '😭',
  parcial: '😭',
  erro: '🦄',
}

/**
 * Emoji do badge a partir da classe do palpite no ÚLTIMO jogo finalizado e da
 * soma de pontos da tabela NO DIA. `classe === null` = não palpitou aquele jogo.
 * Chamada só quando existe um último jogo finalizado.
 */
export function emojiDoResultado(
  classe: ClassePalpite | null,
  pontosNoDia: number,
): string {
  if (pontosNoDia >= DIAMANTE_MIN_PONTOS) return '💎'
  if (classe === null) return '🦄'
  return EMOJI_POR_CLASSE[classe]
}
