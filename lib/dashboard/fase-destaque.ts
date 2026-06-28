import { MULTIPLICADORES } from '@/lib/pontuacao'

export type FaseDestaque = {
  titulo: string
  multiplicador: number
  multiplicadorLabel: string
  gradient: string
}

// Rótulos das fases de mata-mata (espelham LABEL_FASE de lib/ranking.ts).
const TITULO: Record<string, string> = {
  '16avos': '16avos de final',
  oitavas: 'Oitavas de final',
  quartas: 'Quartas de final',
  semis: 'Semifinais',
  disputa_terceiro: 'Disputa de 3° lugar',
  final: 'Final',
}

// Gradientes por fase (espelham PHASES de components/landing/PontuacaoSection.tsx,
// para paridade visual com a landing).
const GRADIENT: Record<string, string> = {
  '16avos': 'from-yellow-400 to-green-400/80',
  oitavas: 'from-yellow-400 to-green-400',
  quartas: 'from-yellow-500 to-green-500',
  semis: 'from-green-400 to-emerald-400',
  disputa_terceiro: 'from-green-400 to-emerald-500',
  final: 'from-green-500 to-emerald-500',
}

/**
 * Dado a fase ativa (ou a `periodoKey` de `determinarPeriodoAtual`), retorna os
 * dados de destaque do card — ou `null` quando não há multiplicador a destacar
 * (grupos, rodadas de grupos, ou chave desconhecida). O multiplicador vem de
 * `MULTIPLICADORES` (fonte única).
 */
export function faseDestaque(fase: string): FaseDestaque | null {
  const multiplicador = (MULTIPLICADORES as Record<string, number>)[fase]
  if (multiplicador === undefined || multiplicador <= 1) return null

  const titulo = TITULO[fase]
  const gradient = GRADIENT[fase]
  if (!titulo || !gradient) return null

  return { titulo, multiplicador, multiplicadorLabel: `${multiplicador}×`, gradient }
}
