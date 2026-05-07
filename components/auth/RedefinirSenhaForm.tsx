'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { redefinirSenhaSchema } from '@/lib/validators/login';

function mapError(message: string): string {
  if (/auth session missing/i.test(message)) {
    return 'Link expirado ou inválido. Solicite um novo.';
  }
  if (/password should be at least/i.test(message)) {
    return 'Senha muito curta.';
  }
  if (/same.*password/i.test(message)) {
    return 'A nova senha precisa ser diferente da anterior.';
  }
  return 'Não foi possível redefinir a senha. Tente novamente.';
}

export function RedefinirSenhaForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = redefinirSenhaSchema.safeParse(raw);
    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors;
      toast.error(
        errs.confirmPassword?.[0] ?? errs.password?.[0] ?? 'Dados inválidos.',
      );
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);

    if (error) {
      toast.error(mapError(error.message));
      return;
    }

    toast.success('Senha redefinida com sucesso!');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field
        label="Nova senha"
        name="password"
        type="password"
        autoComplete="new-password"
        disabled={loading}
      />
      <Field
        label="Confirmar nova senha"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Salvando...
          </span>
        ) : (
          'Redefinir senha'
        )}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  disabled,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  disabled: boolean;
}) {
  const id = `redefinir-${name}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="font-body text-text-secondary text-sm">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        disabled={disabled}
        required
        minLength={6}
        className="bg-bg-dark border-border focus:border-accent focus:ring-accent font-body w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 disabled:opacity-50"
      />
    </div>
  );
}
