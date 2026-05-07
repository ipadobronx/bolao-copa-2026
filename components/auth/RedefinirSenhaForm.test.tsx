import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const mockUpdateUser = vi.fn();
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { updateUser: mockUpdateUser },
  }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }));

import { RedefinirSenhaForm } from './RedefinirSenhaForm';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RedefinirSenhaForm', () => {
  it('chama updateUser com nova senha e redireciona pro dashboard', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    render(<RedefinirSenhaForm />);

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'novasenha123' } });
    fireEvent.change(screen.getByLabelText(/confirma/i), { target: { value: 'novasenha123' } });
    fireEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'novasenha123' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('rejeita senhas que não coincidem', async () => {
    const { toast } = await import('sonner');
    render(<RedefinirSenhaForm />);

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'senha1' } });
    fireEvent.change(screen.getByLabelText(/confirma/i), { target: { value: 'senha2' } });
    fireEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('As senhas não coincidem.'));
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('rejeita senha curta', async () => {
    const { toast } = await import('sonner');
    render(<RedefinirSenhaForm />);

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText(/confirma/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('mostra erro quando supabase retorna erro de sessão', async () => {
    const { toast } = await import('sonner');
    mockUpdateUser.mockResolvedValue({ error: { message: 'Auth session missing!' } });
    render(<RedefinirSenhaForm />);

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'novasenha123' } });
    fireEvent.change(screen.getByLabelText(/confirma/i), { target: { value: 'novasenha123' } });
    fireEvent.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });
});
