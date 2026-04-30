import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CashbackPicker, type SelecaoElegivel } from '../CashbackPicker';

const SELECOES: SelecaoElegivel[] = [
  { id: 1, nome: 'Noruega', codigo_iso: 'NOR', bandeira_emoji: '🇳🇴', cashback_multiplicador: 5.0 },
  { id: 2, nome: 'Colômbia', codigo_iso: 'COL', bandeira_emoji: '🇨🇴', cashback_multiplicador: 5.0 },
  { id: 3, nome: 'Portugal', codigo_iso: 'POR', bandeira_emoji: '🇵🇹', cashback_multiplicador: 3.0 },
  { id: 4, nome: 'Brasil', codigo_iso: 'BRA', bandeira_emoji: '🇧🇷', cashback_multiplicador: 2.0 },
  { id: 5, nome: 'França', codigo_iso: 'FRA', bandeira_emoji: '🇫🇷', cashback_multiplicador: 1.0 },
];

describe('CashbackPicker', () => {
  it('renderiza todas as seleções passadas', () => {
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={null} onChange={() => {}} valor_pago={100} />,
    );
    expect(screen.getByText('Noruega')).toBeInTheDocument();
    expect(screen.getByText('Brasil')).toBeInTheDocument();
    expect(screen.getByText('França')).toBeInTheDocument();
  });

  it('agrupa em tiers 5× / 3× / 2× / 1×', () => {
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={null} onChange={() => {}} valor_pago={100} />,
    );
    expect(screen.getByText(/5× — AZARÕES/i)).toBeInTheDocument();
    expect(screen.getByText(/3× — TIME B/i)).toBeInTheDocument();
    expect(screen.getByText(/2× — SUL-AMERICANOS/i)).toBeInTheDocument();
    expect(screen.getByText(/1× — FAVORITAS/i)).toBeInTheDocument();
  });

  it('callout do tier 5× mostra valor × 5', () => {
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={null} onChange={() => {}} valor_pago={100} />,
    );
    expect(screen.getByTestId('callout-5')).toHaveTextContent(/R\$\s*100/);
    expect(screen.getByTestId('callout-5')).toHaveTextContent(/R\$\s*500/);
  });

  it('callout atualiza com valor_pago dinâmico', () => {
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={null} onChange={() => {}} valor_pago={200} />,
    );
    expect(screen.getByTestId('callout-5')).toHaveTextContent(/R\$\s*1\.000/);
    expect(screen.getByTestId('callout-2')).toHaveTextContent(/R\$\s*400/);
  });

  it('clicar numa seleção chama onChange com o id', () => {
    const onChange = vi.fn();
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={null} onChange={onChange} valor_pago={100} />,
    );
    fireEvent.click(screen.getByText('Brasil').closest('[role="button"]')!);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('clicar na selecionada chama onChange(null) — toggle', () => {
    const onChange = vi.fn();
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={4} onChange={onChange} valor_pago={100} />,
    );
    fireEvent.click(screen.getByText('Brasil').closest('[role="button"]')!);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('marca a selecionada com badge SUA', () => {
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={4} onChange={() => {}} valor_pago={100} />,
    );
    expect(screen.getByTestId('badge-sua')).toBeInTheDocument();
  });

  it('lista vazia → não renderiza tiers', () => {
    render(
      <CashbackPicker selecoes={[]} selectedId={null} onChange={() => {}} valor_pago={100} />,
    );
    expect(screen.queryByText(/5×/)).toBeNull();
  });

  it('keyboard Enter aciona seleção', () => {
    const onChange = vi.fn();
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={null} onChange={onChange} valor_pago={100} />,
    );
    const row = screen.getByText('Brasil').closest('[role="button"]')!;
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('keyboard Space aciona seleção', () => {
    const onChange = vi.fn();
    render(
      <CashbackPicker selecoes={SELECOES} selectedId={null} onChange={onChange} valor_pago={100} />,
    );
    const row = screen.getByText('Brasil').closest('[role="button"]')!;
    fireEvent.keyDown(row, { key: ' ' });
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
