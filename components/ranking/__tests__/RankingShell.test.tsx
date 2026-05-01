import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: vi.fn(),
  }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import { RankingShell } from '../RankingShell'
import type { RankingShellProps } from '../RankingShell'

const props: RankingShellProps = {
  initialRows: [
    { userId: 'u1', nome: 'Marco', posicao: 1, pontosTotais: 472, acertosExatos: 18,
      acertosParciais: 34, totalBilhetes: 5, tendencia: null, isCurrentUser: false },
  ],
  periodoLabel: 'Grupos — Rodada 1',
  periodoRows: [],
  totalApostadores: 1,
}

describe('<RankingShell />', () => {
  it('renderiza tab Geral por padrão', () => {
    render(<RankingShell {...props} />)
    expect(screen.getAllByText('Marco').length).toBeGreaterThanOrEqual(1)
  })

  it('troca para tab Rodada ao clicar', () => {
    render(<RankingShell {...props} />)
    fireEvent.click(screen.getByRole('tab', { name: /rodada/i }))
    expect(screen.getByText(/grupos — rodada 1/i)).toBeInTheDocument()
  })

  it('exibe contagem de apostadores', () => {
    render(<RankingShell {...props} />)
    expect(screen.getByText(/1 apostador/i)).toBeInTheDocument()
  })
})
