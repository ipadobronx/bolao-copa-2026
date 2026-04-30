import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { signInWithOtpMock, toastErrorMock } = vi.hoisted(() => ({
  signInWithOtpMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithOtp: signInWithOtpMock },
  }),
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock },
}));

import { LoginForm } from './LoginForm';

beforeEach(() => {
  signInWithOtpMock.mockReset();
  toastErrorMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('<LoginForm/>', () => {
  it('renderiza inputs e botão "Receber link" no estado inicial', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /receber link/i })).not.toBeDisabled();
  });

  it('mostra erros inline quando submete com inputs inválidos', () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'nao-eh-email' } });
    fireEvent.submit(screen.getByRole('button', { name: /receber link/i }).closest('form')!);
    expect(screen.getByText(/pelo menos 2 caracteres/i)).toBeInTheDocument();
    expect(screen.getByText(/email inválido/i)).toBeInTheDocument();
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  it('submit válido transiciona idle → sending → sent', async () => {
    // Use a deferred promise so we can observe the intermediate 'sending' state
    // before signInWithOtp resolves.
    let resolveSignIn: (value: { error: null }) => void = () => {};
    signInWithOtpMock.mockReturnValue(
      new Promise<{ error: null }>((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    render(<LoginForm defaultNext="/dashboard" />);

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Jonatas Pereira' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jonatas@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /receber link/i }).closest('form')!);

    // sending state: button disabled with "Enviando..."
    expect(await screen.findByText(/enviando/i)).toBeInTheDocument();

    // Now resolve the OTP promise → component should transition to 'sent'
    resolveSignIn({ error: null });

    // sent state: card shown with email
    await waitFor(() => {
      expect(screen.getByText(/link enviado pra/i)).toBeInTheDocument();
    });
    expect(screen.getByText('jonatas@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reenviar \(60s\)/i })).toBeDisabled();

    // verify the supabase call had the right shape
    expect(signInWithOtpMock).toHaveBeenCalledTimes(1);
    const arg = signInWithOtpMock.mock.calls[0]![0];
    expect(arg.email).toBe('jonatas@example.com');
    expect(arg.options.data).toEqual({ full_name: 'Jonatas Pereira' });
    expect(arg.options.emailRedirectTo).toBe(
      'http://localhost:3000/auth/callback?next=%2Fdashboard',
    );
  });

  it('submit com nome vazio não passa "data" pro signInWithOtp (re-login)', async () => {
    signInWithOtpMock.mockResolvedValue({ error: null });
    render(<LoginForm />);

    // Não preenche nome; só email.
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'antonio@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /receber link/i }).closest('form')!);

    await waitFor(() => {
      expect(signInWithOtpMock).toHaveBeenCalledTimes(1);
    });

    const arg = signInWithOtpMock.mock.calls[0]![0];
    expect(arg.email).toBe('antonio@example.com');
    expect(arg.options.data).toBeUndefined();
  });

  it('volta a idle e dispara toast.error quando signInWithOtp rejeita', async () => {
    signInWithOtpMock.mockRejectedValue(new Error('network down'));
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Jonatas' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jonatas@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /receber link/i }).closest('form')!);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringMatching(/não consegui enviar o link/i),
      );
    });
    expect(screen.getByRole('button', { name: /receber link/i })).not.toBeDisabled();
    expect(screen.queryByText(/link enviado/i)).not.toBeInTheDocument();
  });

  it('cooldown decrementa e desbloqueia "Reenviar" em 60s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signInWithOtpMock.mockResolvedValue({ error: null });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Jonatas' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jonatas@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: /receber link/i }).closest('form')!);

    await waitFor(() => screen.getByText(/link enviado pra/i));
    expect(screen.getByRole('button', { name: /reenviar \(60s\)/i })).toBeDisabled();

    // Advance 30s — wrap in act() because the setInterval tick triggers a React
    // state update that we want to flush before asserting.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByRole('button', { name: /reenviar \(30s\)/i })).toBeDisabled();

    // Advance to 0
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByRole('button', { name: /^reenviar link$/i })).not.toBeDisabled();
  });
});
