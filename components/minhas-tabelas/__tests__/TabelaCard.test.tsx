import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TabelaCard } from '../TabelaCard'
import type { BilheteResumo } from '@/lib/palpites'

const base: BilheteResumo = {
  id: 'b1', numero_bilhete: 117, valor_pago: 20,
  status_pagamento: 'confirmado', selecao_cashback_id: null,
}

describe('<TabelaCard />', () => {
  it('mostra pontos e posição quando confirmado', () => {
    render(
      <TabelaCard bilhete={base} palpitesCount={10} selecaoCashback={null}
        pontos={50} posicao={12} totalTabelas={148} />,
    )
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText(/12ª de 148/)).toBeInTheDocument()
  })
  it('não mostra pontuação quando não confirmado', () => {
    render(
      <TabelaCard bilhete={{ ...base, status_pagamento: 'pendente' }} palpitesCount={0}
        selecaoCashback={null} pontos={null} posicao={null} totalTabelas={148} />,
    )
    expect(screen.queryByText(/de 148/)).toBeNull()
  })
})
