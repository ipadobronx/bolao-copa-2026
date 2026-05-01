import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RankingTabGeral } from '../RankingTabGeral'
import type { RankingRowData } from '../RankingRow'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const rows: RankingRowData[] = [
  { userId: 'u1', nome: 'Marco', posicao: 1, pontosTotais: 472, acertosExatos: 18, acertosParciais: 34, totalBilhetes: 5, tendencia: null, isCurrentUser: false },
  { userId: 'u2', nome: 'Ana',   posicao: 2, pontosTotais: 458, acertosExatos: 15, acertosParciais: 38, totalBilhetes: 2, tendencia: 1,    isCurrentUser: false },
  { userId: 'u3', nome: 'Rafael',posicao: 3, pontosTotais: 445, acertosExatos: 16, acertosParciais: 31, totalBilhetes: 8, tendencia: -1,   isCurrentUser: true  },
]

describe('<RankingTabGeral />', () => {
  it('renderiza pódio e tabela quando há dados', () => {
    render(<RankingTabGeral rows={rows} />)
    expect(screen.getAllByText('Marco').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('estado vazio quando rows = []', () => {
    render(<RankingTabGeral rows={[]} />)
    expect(screen.getByText(/ranking ainda está vazio/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /comprar tabela/i })).toBeInTheDocument()
  })

  it('não renderiza pódio no estado vazio', () => {
    render(<RankingTabGeral rows={[]} />)
    expect(screen.queryByText(/🥇/)).toBeNull()
  })
})
