import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReset = vi.fn();
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { resetPasswordForEmail: mockReset },
  }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://malanacopa.com.br' },
}));

import { RecuperarSenhaForm } from './RecuperarSenhaForm';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RecuperarSenhaForm', () => {
  it('chama resetPasswordForEmail com redirectTo apontando pro callback', async () => {
    mockReset.mockResolvedValue({ error: null });
    render(<RecuperarSenhaForm />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }));

    await waitFor(() => expect(mockReset).toHaveBeenCalled());
    const [emailArg, optionsArg] = mockReset.mock.calls[0]!;
    expect(emailArg).toBe('a@b.com');
    expect(optionsArg.redirectTo).toContain('/auth/callback');
    expect(optionsArg.redirectTo).toContain('next=%2Flogin%2Fredefinir-senha');
  });

  it('mostra mensagem de confirmação após envio bem-sucedido', async () => {
    mockReset.mockResolvedValue({ error: null });
    render(<RecuperarSenhaForm />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }));

    await waitFor(() => {
      expect(screen.getByText(/se este email estiver cadastrado/i)).toBeInTheDocument();
    });
  });

  it('mostra mensagem genérica mesmo quando email não existe (não vaza informação)', async () => {
    mockReset.mockResolvedValue({ error: { message: 'User not found' } });
    render(<RecuperarSenhaForm />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'naoexiste@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }));

    await waitFor(() => {
      expect(screen.getByText(/se este email estiver cadastrado/i)).toBeInTheDocument();
    });
  });

  it('valida email mal formatado client-side', async () => {
    const { toast } = await import('sonner');
    render(<RecuperarSenhaForm />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'invalido' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar link/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(mockReset).not.toHaveBeenCalled();
  });
});
