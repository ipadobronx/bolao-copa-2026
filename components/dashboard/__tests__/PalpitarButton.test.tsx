import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PalpitarButton } from '../PalpitarButton'

describe('<PalpitarButton />', () => {
  it('1 tabela: link direto pro jogo', () => {
    render(<PalpitarButton jogoId={16} tabelas={[{ id: 'b1', numero: 117, pontos: 50 }]} />)
    expect(screen.getByRole('link', { name: 'Palpitar' })).toHaveAttribute('href', '/palpites/b1?jogo=16')
  })
  it('0 tabela: link pra comprar', () => {
    render(<PalpitarButton jogoId={16} tabelas={[]} />)
    expect(screen.getByRole('link', { name: 'Palpitar' })).toHaveAttribute('href', '/comprar')
  })
  it('2+ tabelas: botão (não link) que abre o seletor', () => {
    render(
      <PalpitarButton
        jogoId={16}
        tabelas={[
          { id: 'b1', numero: 117, pontos: 50 },
          { id: 'b2', numero: 120, pontos: 30 },
        ]}
      />,
    )
    expect(screen.queryByRole('link', { name: 'Palpitar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Palpitar' })).toBeInTheDocument()
  })
})
