import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { JogoResumoCard } from '../JogoResumoCard'
import type { JogoResumo } from '@/lib/dashboard/resumo-jogo'

const base: JogoResumo = {
  numeroJogo: 16,
  dataHora: '2026-06-15T22:00:00Z',
  casa: 'Irã',
  fora: 'Nova Zelândia',
  bandeiraCasa: '🇮🇷',
  bandeiraFora: '🇳🇿',
  finalizado: false,
  realCasa: null,
  realFora: null,
  total: 3,
  tendencia: { casa: 2, empate: 1, fora: 0 },
  topPlacares: [
    { gc: 1, gf: 0, count: 2 },
    { gc: 1, gf: 1, count: 1 },
  ],
  palpites: [
    { userId: 'u1', nome: 'Dionísio', gc: 1, gf: 0, pts: null, isLider: true },
    { userId: 'u2', nome: 'Ana Luyza', gc: 1, gf: 1, pts: null, isLider: false },
  ],
}

describe('<JogoResumoCard />', () => {
  it('jogo atual: confronto, lista de nomes, sem lockbox', () => {
    render(<JogoResumoCard jogo={base} proximo={false} />)
    expect(screen.getByText('Irã')).toBeInTheDocument()
    expect(screen.getByText('Dionísio')).toBeInTheDocument()
    expect(screen.getByText('Ana Luyza')).toBeInTheDocument()
    expect(screen.queryByText(/aparece quando o jogo travar/i)).toBeNull()
  })

  it('próximo: lockbox e sem nomes', () => {
    render(<JogoResumoCard jogo={{ ...base, palpites: null }} proximo />)
    expect(screen.getByText(/aparece quando o jogo travar/i)).toBeInTheDocument()
    expect(screen.queryByText('Dionísio')).toBeNull()
  })
})
