'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { loginSchema, signupSchema } from '@/lib/validators/login';
import { safeNext } from '@/lib/validators/next';

type Mode = 'login' | 'signup';

export type LoginFormProps = {
  defaultNext?: string | undefined;
};

function mapError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email ou senha incorretos.';
  if (/user already registered/i.test(message)) return 'Email já cadastrado. Faça login.';
  if (/password should be at least/i.test(message)) return 'Senha muito curta.';
  if (/email not confirmed/i.test(message)) return 'Confirme seu email antes de entrar.';
  return 'Algo deu errado. Tenta de novo.';
}

export function LoginForm({ defaultNext }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const next = safeNext(defaultNext);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors;
      toast.error(errs.email?.[0] ?? errs.password?.[0] ?? 'Dados inválidos.');
      return;
    }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) { toast.error(mapError(error.message)); return; }
    // safeNext returns a plain string; cast needed for typed-routes experimental feature
    router.push(next as never);
    router.refresh();
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors;
      toast.error(errs.nome?.[0] ?? errs.email?.[0] ?? errs.password?.[0] ?? 'Dados inválidos.');
      return;
    }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.nome } },
    });
    setLoading(false);
    if (error) { toast.error(mapError(error.message)); return; }
    if (!data.session) {
      toast.info('Confirme seu email para entrar.');
      return;
    }
    router.push(next as never);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex overflow-hidden rounded-md border border-border">
        <ModeBtn active={mode === 'login'} onClick={() => setMode('login')}>Entrar</ModeBtn>
        <ModeBtn active={mode === 'signup'} onClick={() => setMode('signup')}>Criar conta</ModeBtn>
      </div>

      {mode === 'login' ? (
        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          <Field label="Email" name="email" type="email" autoComplete="email" disabled={loading} />
          <Field label="Senha" name="password" type="password" autoComplete="current-password" disabled={loading} />
          <SubmitBtn loading={loading}>Entrar</SubmitBtn>
          <div className="text-center">
            <Link
              href="/login/recuperar-senha"
              className="font-body text-text-secondary hover:text-text-primary text-sm underline"
            >
              Esqueci a senha
            </Link>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSignup} className="space-y-4" noValidate>
          <Field label="Nome" name="nome" type="text" autoComplete="name" disabled={loading} />
          <Field label="Email" name="email" type="email" autoComplete="email" disabled={loading} />
          <Field label="Senha" name="password" type="password" autoComplete="new-password" disabled={loading} />
          <SubmitBtn loading={loading}>Criar conta</SubmitBtn>
        </form>
      )}
    </div>
  );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 text-sm font-body transition-colors ${
        active
          ? 'bg-accent text-black font-semibold'
          : 'bg-bg-dark text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label, name, type, autoComplete, disabled,
}: {
  label: string; name: string; type: string; autoComplete: string; disabled: boolean;
}) {
  const id = `login-field-${name}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="font-body text-text-secondary text-sm">{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        disabled={disabled}
        required
        className="bg-bg-dark border-border focus:border-accent focus:ring-accent font-body w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 disabled:opacity-50"
      />
    </div>
  );
}

function SubmitBtn({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading}
      className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Carregando...
        </span>
      ) : children}
    </button>
  );
}
