import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RankingRow, type RankingRowData } from '../RankingRow'

const base: RankingRowData = {
  userId: 'user-1',
  nome: 'Marco Cardoso',
  posicao: 4,
  pontosTotais: 287,
  acertosExatos: 8,
  acertosParciais: 20,
  totalBilhetes: 3,
  tendencia: null,
  isCurrentUser: false,
  emoji: null,
  clube: null,
}

describe('<RankingRow />', () => {
  it('renderiza nome e pontos', () => {
    render(<table><tbody><RankingRow data={base} /></tbody></table>)
    expect(screen.getByText('Marco Cardoso')).toBeInTheDocument()
    expect(screen.getByText('287')).toBeInTheDocument()
  })

  it('exibe posição numérica', () => {
    render(<table><tbody><RankingRow data={base} /></tbody></table>)
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('exibe acertos exatos e parciais', () => {
    render(<table><tbody><RankingRow data={base} /></tbody></table>)
    expect(screen.getAllByText(/8/)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/20/)[0]).toBeInTheDocument()
  })

  it('exibe badge "Você" quando isCurrentUser=true', () => {
    render(<table><tbody><RankingRow data={{ ...base, isCurrentUser: true }} /></tbody></table>)
    expect(screen.getByText(/você/i)).toBeInTheDocument()
  })

  it('não exibe badge "Você" quando isCurrentUser=false', () => {
    render(<table><tbody><RankingRow data={base} /></tbody></table>)
    expect(screen.queryByText(/você/i)).toBeNull()
  })

  it('tendência positiva exibe ▲', () => {
    render(<table><tbody><RankingRow data={{ ...base, tendencia: 2 }} /></tbody></table>)
    expect(screen.getByText(/▲/)).toBeInTheDocument()
  })

  it('tendência negativa exibe ▼', () => {
    render(<table><tbody><RankingRow data={{ ...base, tendencia: -1 }} /></tbody></table>)
    expect(screen.getByText(/▼/)).toBeInTheDocument()
  })

  it('tendência zero ou null exibe ━', () => {
    render(<table><tbody><RankingRow data={{ ...base, tendencia: 0 }} /></tbody></table>)
    expect(screen.getByText('━')).toBeInTheDocument()
  })

  it('tendência null também exibe ━', () => {
    render(<table><tbody><RankingRow data={{ ...base, tendencia: null }} /></tbody></table>)
    expect(screen.getAllByText('━')[0]).toBeInTheDocument()
  })

  it('exibe "1 tabela" no singular', () => {
    render(<table><tbody><RankingRow data={{ ...base, totalBilhetes: 1 }} /></tbody></table>)
    expect(screen.getByText('1 tabela')).toBeInTheDocument()
  })

  it('exibe "N tabelas" no plural', () => {
    render(<table><tbody><RankingRow data={{ ...base, totalBilhetes: 5 }} /></tbody></table>)
    expect(screen.getByText('5 tabelas')).toBeInTheDocument()
  })

  it('aplica classe trend-up na tendência positiva', () => {
    render(<table><tbody><RankingRow data={{ ...base, tendencia: 2 }} /></tbody></table>)
    const el = screen.getByText(/▲/)
    expect(el).toHaveClass('trend-up')
  })

  it('aplica classe trend-down na tendência negativa', () => {
    render(<table><tbody><RankingRow data={{ ...base, tendencia: -1 }} /></tbody></table>)
    const el = screen.getByText(/▼/)
    expect(el).toHaveClass('trend-down')
  })

  it('aplica classe trend-same na tendência zero', () => {
    render(<table><tbody><RankingRow data={{ ...base, tendencia: 0 }} /></tbody></table>)
    const el = screen.getByText('━')
    expect(el).toHaveClass('trend-same')
  })

  it('aplica classe rank-pos-gold para posição 1', () => {
    render(<table><tbody><RankingRow data={{ ...base, posicao: 1, pontosTotais: 472 }} /></tbody></table>)
    const pos = screen.getByText('1')
    expect(pos).toHaveClass('rank-pos-gold')
  })

  it('aplica classe rank-pos-silver para posição 2', () => {
    render(<table><tbody><RankingRow data={{ ...base, posicao: 2, pontosTotais: 458 }} /></tbody></table>)
    const pos = screen.getByText('2')
    expect(pos).toHaveClass('rank-pos-silver')
  })

  it('aplica classe rank-pos-bronze para posição 3', () => {
    render(<table><tbody><RankingRow data={{ ...base, posicao: 3, pontosTotais: 445 }} /></tbody></table>)
    const pos = screen.getByText('3')
    expect(pos).toHaveClass('rank-pos-bronze')
  })

  it('renderiza emoji quando presente', () => {
    render(<table><tbody><RankingRow data={{ ...base, emoji: '🔥' }} /></tbody></table>)
    expect(screen.getByText('🔥')).toBeInTheDocument()
  })
  it('renderiza escudo quando há clube', () => {
    render(<table><tbody><RankingRow data={{ ...base, clube: 'nautico' }} /></tbody></table>)
    expect(screen.getByAltText('Náutico')).toBeInTheDocument()
  })
  it('não renderiza escudo sem clube', () => {
    render(<table><tbody><RankingRow data={base} /></tbody></table>)
    expect(screen.queryByAltText('Náutico')).toBeNull()
  })
})
