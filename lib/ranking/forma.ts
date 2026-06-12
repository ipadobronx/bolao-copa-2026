import type { ClassePalpite } from '@/lib/pontuacao'

export type CorForma = 'verde' | 'cinza' | 'vermelho' | 'vazio'

const COR_POR_CLASSE: Record<ClassePalpite, CorForma> = {
  exato: 'verde',
  vencedor_saldo: 'cinza',
  vencedor: 'cinza',
  parcial: 'vermelho',
  erro: 'vermelho',
}

/**
 * Cor da bolinha de "forma" (estilo classificação do Google), a partir da classe
 * do palpite num jogo finalizado. `null` = não palpitou aquele jogo → 'vazio'.
 *   verde   = placar exato
 *   cinza   = acertou o vencedor (com ou sem saldo)
 *   vermelho = errou ou só acertou gols de um time (0 ou 2 pts)
 */
export function corDaForma(classe: ClassePalpite | null): CorForma {
  if (classe === null) return 'vazio'
  return COR_POR_CLASSE[classe]
}
