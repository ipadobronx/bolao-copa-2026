import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(''),
}));

import { DateRangePicker } from './DateRangePicker';

beforeEach(() => {
  vi.clearAllMocks();
});

const FROM = new Date('2026-05-01T00:00:00');
const TO = new Date('2026-05-08T00:00:00');

describe('DateRangePicker', () => {
  it('renderiza todos os presets como radio buttons', () => {
    render(<DateRangePicker preset="7d" from={FROM} to={TO} />);
    expect(screen.getByRole('radio', { name: /^hoje$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^ontem$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^7 dias$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^30 dias$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^custom$/i })).toBeInTheDocument();
  });

  it('marca o preset ativo via aria-checked', () => {
    render(<DateRangePicker preset="hoje" from={FROM} to={TO} />);
    expect(screen.getByRole('radio', { name: /^hoje$/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: /^7 dias$/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('clicar em preset chama router.replace com novo preset e limpa from/to', () => {
    render(<DateRangePicker preset="7d" from={FROM} to={TO} />);
    fireEvent.click(screen.getByRole('radio', { name: /^hoje$/i }));
    expect(mockReplace).toHaveBeenCalled();
    const url = mockReplace.mock.calls[0]![0] as string;
    expect(url).toContain('preset=hoje');
    expect(url).not.toContain('from=');
    expect(url).not.toContain('to=');
  });

  it('mostra inputs de data apenas no modo custom', () => {
    const { rerender } = render(
      <DateRangePicker preset="hoje" from={FROM} to={TO} />,
    );
    expect(screen.queryByLabelText('De')).not.toBeInTheDocument();

    rerender(<DateRangePicker preset="custom" from={FROM} to={TO} />);
    expect(screen.getByLabelText('De')).toBeInTheDocument();
    expect(screen.getByLabelText('Até')).toBeInTheDocument();
  });

  it('submit no modo custom envia from/to nos params', () => {
    render(<DateRangePicker preset="custom" from={FROM} to={TO} />);
    fireEvent.click(screen.getByRole('button', { name: /aplicar/i }));
    const url = mockReplace.mock.calls[0]![0] as string;
    expect(url).toContain('preset=custom');
    expect(url).toContain('from=2026-05-01');
    expect(url).toContain('to=2026-05-08');
  });
});
