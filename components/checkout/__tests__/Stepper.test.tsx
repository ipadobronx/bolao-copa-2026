import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Stepper } from '../Stepper';

describe('Stepper', () => {
  it('renderiza qty inicial', () => {
    render(<Stepper qty={3} onChange={() => {}} />);
    expect(screen.getByTestId('stepper-num').textContent).toBe('3');
  });

  it('+ chama onChange com qty+1', () => {
    const onChange = vi.fn();
    render(<Stepper qty={3} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Aumentar quantidade'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('− chama onChange com qty-1', () => {
    const onChange = vi.fn();
    render(<Stepper qty={3} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Diminuir quantidade'));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('− desabilitado em qty=min (default 1)', () => {
    const onChange = vi.fn();
    render(<Stepper qty={1} onChange={onChange} />);
    expect(screen.getByLabelText('Diminuir quantidade')).toBeDisabled();
  });

  it('+ desabilitado em qty=max (default 50)', () => {
    const onChange = vi.fn();
    render(<Stepper qty={50} onChange={onChange} />);
    expect(screen.getByLabelText('Aumentar quantidade')).toBeDisabled();
  });

  it('mostra "🔒" e contagem regressiva quando qty < milestone', () => {
    render(<Stepper qty={3} onChange={() => {}} milestone={5} />);
    expect(screen.getByText(/2 tabelas/i)).toBeInTheDocument();
  });

  it('singular "tabela" quando faltam 1', () => {
    render(<Stepper qty={4} onChange={() => {}} milestone={5} />);
    expect(screen.getByText(/^1 tabela /i)).toBeInTheDocument();
  });

  it('mostra "Cashback liberado" quando qty >= milestone', () => {
    render(<Stepper qty={5} onChange={() => {}} milestone={5} />);
    expect(screen.getByText(/cashback liberado/i)).toBeInTheDocument();
  });

  it('barra de progresso width = qty/max%', () => {
    const { rerender } = render(<Stepper qty={5} onChange={() => {}} max={10} />);
    expect(screen.getByTestId('milestone-fill').style.width).toBe('50%');
    rerender(<Stepper qty={2} onChange={() => {}} max={10} />);
    expect(screen.getByTestId('milestone-fill').style.width).toBe('20%');
  });
});
