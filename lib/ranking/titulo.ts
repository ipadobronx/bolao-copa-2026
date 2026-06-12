export type Selo = { emoji: string; label: string }

/**
 * Selo de desempenho por percentil no ranking (posicao 1 = topo).
 * top 10% Bruxo · top 33% Embalado · meio Na média · fundo 33% Pé-frio · fundo 10% Chutador.
 */
export function tituloDesempenho(posicao: number, total: number): Selo {
  if (total <= 0) return { emoji: '😎', label: 'Na média' }
  const pct = posicao / total // 0..1, menor = melhor
  if (pct <= 0.1) return { emoji: '🧙', label: 'Bruxo' }
  if (pct <= 0.33) return { emoji: '🔥', label: 'Embalado' }
  if (pct <= 0.66) return { emoji: '😎', label: 'Na média' }
  if (pct <= 0.9) return { emoji: '🥶', label: 'Pé-frio' }
  return { emoji: '🤡', label: 'Chutador' }
}
