'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { env } from '@/lib/env';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { recuperarSenhaSchema } from '@/lib/validators/login';

export function RecuperarSenhaForm() {
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = recuperarSenhaSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.flatten().fieldErrors.email?.[0] ?? 'Email inválido.');
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(
      '/login/redefinir-senha',
    )}`;
    await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
    setLoading(false);

    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="space-y-4">
        <div className="border-accent/30 bg-accent/5 rounded-md border p-4 text-sm">
          <p className="text-text-primary font-semibold">Pronto!</p>
          <p className="text-text-secondary mt-1">
            Se este email estiver cadastrado, você receberá um link para redefinir a senha.
            Confere a caixa de entrada (e o spam) nos próximos minutos.
          </p>
        </div>
        <Link
          href="/login"
          className="font-body text-text-secondary hover:text-text-primary block text-center text-sm underline"
        >
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
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
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Enviando...
          </span>
        ) : (
          'Enviar link de recuperação'
        )}
      </button>
      <Link
        href="/login"
        className="font-body text-text-secondary hover:text-text-primary block text-center text-sm underline"
      >
        Voltar para o login
      </Link>
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
  const id = `recuperar-${name}`;
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
        className="bg-bg-dark border-border focus:border-accent focus:ring-accent font-body w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 disabled:opacity-50"
      />
    </div>
  );
}
