import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PodioSection, type PodioEntry } from '../PodioSection'

const top3: PodioEntry[] = [
  { userId: 'u1', nome: 'Marco Cardoso', posicao: 1, pontosTotais: 472, totalBilhetes: 5, isCurrentUser: false },
  { userId: 'u2', nome: 'Ana Beatriz',   posicao: 2, pontosTotais: 458, totalBilhetes: 2, isCurrentUser: false },
  { userId: 'u3', nome: 'Rafael Santos', posicao: 3, pontosTotais: 445, totalBilhetes: 8, isCurrentUser: true  },
]

describe('<PodioSection />', () => {
  it('renderiza os 3 nomes', () => {
    render(<PodioSection entries={top3} />)
    expect(screen.getByText('Marco Cardoso')).toBeInTheDocument()
    expect(screen.getByText('Ana Beatriz')).toBeInTheDocument()
    expect(screen.getByText('Rafael Santos')).toBeInTheDocument()
  })

  it('exibe pontuações', () => {
    render(<PodioSection entries={top3} />)
    expect(screen.getByText('472')).toBeInTheDocument()
  })

  it('exibe badge "Você" para o usuário logado', () => {
    render(<PodioSection entries={top3} />)
    expect(screen.getByText(/você/i)).toBeInTheDocument()
  })

  it('não renderiza nada quando entries vazio', () => {
    const { container } = render(<PodioSection entries={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
