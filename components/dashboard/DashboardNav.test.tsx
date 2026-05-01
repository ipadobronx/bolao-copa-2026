import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { usePathnameMock, pushMock, refreshMock, signOutMock, toastErrorMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  signOutMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signOut: signOutMock } }),
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock },
}));

import { DashboardNav } from './DashboardNav';

beforeEach(() => {
  usePathnameMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();
  signOutMock.mockReset();
  toastErrorMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('<DashboardNav/>', () => {
  it('renderiza 8 itens — Dashboard, Comprar tabela e Ranking como links reais, 5 disabled', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    render(<DashboardNav />);
    expect(screen.getByRole('link', { name: /^dashboard$/i })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getByRole('link', { name: /comprar tabela/i })).toHaveAttribute(
      'href',
      '/comprar',
    );
    expect(screen.getByRole('link', { name: /^ranking$/i })).toHaveAttribute('href', '/ranking');

    const disabledLabels = [
      'Meus Palpites',
      'Bônus',
      'Minhas Tabelas',
      'Cashback',
      'Configurações',
    ];
    for (const label of disabledLabels) {
      const span = screen.getByText(new RegExp(`^\\s*${label}\\s*$`));
      const wrapper = span.closest('[aria-disabled="true"]');
      expect(wrapper).not.toBeNull();
    }
  });

  it('"Sair" aparece no rodapé', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    render(<DashboardNav />);
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });

  it('Dashboard ativo via aria-current="page" quando pathname casa', () => {
    usePathnameMock.mockReturnValue('/dashboard');
    render(<DashboardNav />);
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('clicar em "Sair" chama signOut + router.push("/login") + refresh + onItemClick', async () => {
    usePathnameMock.mockReturnValue('/dashboard');
    signOutMock.mockResolvedValue({ error: null });
    const onItemClick = vi.fn();
    render(<DashboardNav onItemClick={onItemClick} />);

    fireEvent.click(screen.getByRole('button', { name: /sair/i }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith('/login');
      expect(refreshMock).toHaveBeenCalledTimes(1);
      expect(onItemClick).toHaveBeenCalledTimes(1);
    });
  });

  it('signOut error → toast.error e NÃO redireciona', async () => {
    usePathnameMock.mockReturnValue('/dashboard');
    signOutMock.mockResolvedValue({ error: new Error('boom') });
    render(<DashboardNav />);

    fireEvent.click(screen.getByRole('button', { name: /sair/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(expect.stringMatching(/não consegui deslogar/i));
    });
    expect(pushMock).not.toHaveBeenCalled();
  });
});
