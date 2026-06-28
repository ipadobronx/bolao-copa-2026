import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CardFaseDestaque } from '../CardFaseDestaque'

describe('<CardFaseDestaque />', () => {
  it('mostra o rótulo de fase, o título e o multiplicador em destaque', () => {
    render(
      <CardFaseDestaque
        titulo="16avos de final"
        multiplicador={1.5}
        multiplicadorLabel="1.5×"
        gradient="from-yellow-400 to-green-400/80"
      />,
    )
    expect(screen.getByText(/fase atual/i)).toBeInTheDocument()
    expect(screen.getByText('16avos de final')).toBeInTheDocument()
    expect(screen.getByText('1.5×')).toBeInTheDocument()
  })

  it('inclui um subtítulo sobre o mata-mata valer mais', () => {
    render(
      <CardFaseDestaque
        titulo="Final"
        multiplicador={4}
        multiplicadorLabel="4×"
        gradient="from-green-500 to-emerald-500"
      />,
    )
    expect(screen.getByText('Final')).toBeInTheDocument()
    expect(screen.getByText('4×')).toBeInTheDocument()
    expect(screen.getByText(/vale mais/i)).toBeInTheDocument()
  })
})
