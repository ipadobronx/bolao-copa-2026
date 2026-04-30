'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { loginSchema } from '@/lib/validators/login';
import { safeNext } from '@/lib/validators/next';

type Idle = {
  kind: 'idle';
  values: { nome: string; email: string };
  errors: { nome?: string | undefined; email?: string | undefined };
};
type Sending = { kind: 'sending'; values: { nome: string; email: string } };
type Sent = { kind: 'sent'; email: string; cooldownLeft: number };
type State = Idle | Sending | Sent;

export type LoginFormProps = {
  defaultNext?: string | undefined;
};

const COOLDOWN_SECONDS = 60;

export function LoginForm({ defaultNext }: LoginFormProps) {
  const [state, setState] = useState<State>({
    kind: 'idle',
    values: { nome: '', email: '' },
    errors: {},
  });
  const sentCardRef = useRef<HTMLDivElement>(null);
  const nomeId = useId();
  const emailId = useId();
  const nomeErrorId = useId();
  const emailErrorId = useId();

  // Tick the cooldown while in 'sent' state. The interval starts once on
  // entering 'sent' and is cleared on leaving (or unmount). The functional
  // updater always sees the latest cooldownLeft, so we don't need to restart
  // the interval each tick.
  useEffect(() => {
    if (state.kind !== 'sent') return;
    const timer = setInterval(() => {
      setState((prev) => {
        if (prev.kind !== 'sent' || prev.cooldownLeft === 0) return prev;
        return { ...prev, cooldownLeft: prev.cooldownLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [state.kind]);

  // Move focus to "Link enviado" card when entering 'sent'.
  useEffect(() => {
    if (state.kind === 'sent') {
      sentCardRef.current?.focus();
    }
  }, [state.kind]);

  async function send(values: { nome: string; email: string }) {
    setState({ kind: 'sending', values });
    try {
      const supabase = createSupabaseBrowserClient();
      const next = safeNext(defaultNext);
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const trimmedNome = values.nome.trim();
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo,
          // Só passa metadata quando há nome — signInWithOtp ignora `data` em
          // re-login de email existente; em signup novo o trigger handle_new_user
          // usa raw_user_meta_data->>'full_name' pra popular profiles.nome.
          ...(trimmedNome ? { data: { full_name: trimmedNome } } : {}),
        },
      });
      if (error) throw error;
      setState({ kind: 'sent', email: values.email, cooldownLeft: COOLDOWN_SECONDS });
    } catch (err) {
      const msg =
        err instanceof Error && /rate limit|too many/i.test(err.message)
          ? 'Aguarda 60s pra pedir outro link.'
          : 'Não consegui enviar o link. Tenta de novo.';
      toast.error(msg);
      setState({ kind: 'idle', values, errors: {} });
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== 'idle') return;
    const parsed = loginSchema.safeParse(state.values);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setState({
        kind: 'idle',
        values: state.values,
        errors: {
          nome: fieldErrors.nome?.[0],
          email: fieldErrors.email?.[0],
        },
      });
      return;
    }
    send(parsed.data);
  }

  function handleResend() {
    if (state.kind !== 'sent' || state.cooldownLeft > 0) return;
    send({ nome: '', email: state.email });
  }

  if (state.kind === 'sent') {
    return (
      <div
        ref={sentCardRef}
        tabIndex={-1}
        className="bg-bg-elevated border-border space-y-4 rounded-lg border p-6 outline-none"
      >
        <p className="font-body text-text-primary text-sm">
          Link enviado pra <strong className="text-accent">{state.email}</strong>. Abre seu email e
          clica no link pra entrar.
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={state.cooldownLeft > 0}
          className="btn-sm w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.cooldownLeft > 0 ? `Reenviar (${state.cooldownLeft}s)` : 'Reenviar link'}
        </button>
      </div>
    );
  }

  const sending = state.kind === 'sending';

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor={nomeId} className="font-body text-text-secondary text-sm">
          Nome <span className="text-text-muted text-xs">(só na primeira vez)</span>
        </label>
        <input
          id={nomeId}
          name="nome"
          type="text"
          autoComplete="name"
          aria-invalid={state.kind === 'idle' && !!state.errors.nome}
          aria-describedby={state.kind === 'idle' && state.errors.nome ? nomeErrorId : undefined}
          disabled={sending}
          value={state.values.nome}
          onChange={(e) =>
            setState({
              kind: 'idle',
              values: { ...state.values, nome: e.target.value },
              errors: state.kind === 'idle' ? { ...state.errors, nome: undefined } : {},
            })
          }
          className="bg-bg-dark border-border focus:border-accent focus:ring-accent font-body w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 disabled:opacity-50"
        />
        {state.kind === 'idle' && state.errors.nome ? (
          <p id={nomeErrorId} className="text-danger font-mono text-xs">
            {state.errors.nome}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor={emailId} className="font-body text-text-secondary text-sm">
          Email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={state.kind === 'idle' && !!state.errors.email}
          aria-describedby={state.kind === 'idle' && state.errors.email ? emailErrorId : undefined}
          disabled={sending}
          value={state.values.email}
          onChange={(e) =>
            setState({
              kind: 'idle',
              values: { ...state.values, email: e.target.value },
              errors: state.kind === 'idle' ? { ...state.errors, email: undefined } : {},
            })
          }
          className="bg-bg-dark border-border focus:border-accent focus:ring-accent font-body w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 disabled:opacity-50"
        />
        {state.kind === 'idle' && state.errors.email ? (
          <p id={emailErrorId} className="text-danger font-mono text-xs">
            {state.errors.email}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={sending}
        aria-busy={sending}
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Enviando...
          </span>
        ) : (
          'Receber link'
        )}
      </button>
    </form>
  );
}
