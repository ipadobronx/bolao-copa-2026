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
})
