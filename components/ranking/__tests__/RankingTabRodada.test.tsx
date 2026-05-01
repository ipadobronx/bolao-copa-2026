import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RankingTabRodada } from '../RankingTabRodada'
import type { RankingRowData } from '../RankingRow'

const rows: RankingRowData[] = [
  { userId: 'u1', nome: 'Ana', posicao: 1, pontosTotais: 20, acertosExatos: 2, acertosParciais: 0, totalBilhetes: 1, tendencia: null, isCurrentUser: false },
]

describe('<RankingTabRodada />', () => {
  it('exibe o label do período', () => {
    render(<RankingTabRodada label="Grupos — Rodada 1" rows={rows} />)
    expect(screen.getByText(/grupos — rodada 1/i)).toBeInTheDocument()
  })

  it('renderiza a tabela com dados', () => {
    render(<RankingTabRodada label="Oitavas de final" rows={rows} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  it('estado vazio quando rows = []', () => {
    render(<RankingTabRodada label="Grupos — Rodada 1" rows={[]} />)
    expect(screen.getByText(/nenhum ponto registrado/i)).toBeInTheDocument()
  })
})
