import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginForm } from './LoginForm';

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
      signUp: mockSignUp,
    },
  }),
}));

vi.mock('@/lib/validators/next', () => ({ safeNext: (v: unknown) => v ?? '/dashboard' }));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

beforeEach(() => { vi.clearAllMocks(); });

describe('LoginForm — modo login', () => {
  it('chama signInWithPassword e redireciona no sucesso', async () => {
    mockSignIn.mockResolvedValue({ error: null });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith({ email: 'a@b.com', password: '123456' }));
    expect(mockPush).toHaveBeenCalled();
  });

  it('mostra toast de erro em credenciais inválidas', async () => {
    const { toast } = await import('sonner');
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Email ou senha incorretos.'));
  });
});

describe('LoginForm — modo signup', () => {
  it('chama signUp e redireciona quando session retorna', async () => {
    mockSignUp.mockResolvedValue({ data: { session: { user: {} } }, error: null });
    render(<LoginForm />);

    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'João' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
    expect(mockPush).toHaveBeenCalled();
  });
});
