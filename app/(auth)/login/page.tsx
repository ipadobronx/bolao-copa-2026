import { LoginForm } from '@/components/auth/LoginForm';

type Search = { next?: string; error?: string };

export default function LoginPage({ searchParams }: { searchParams: Search }) {
  const showError = searchParams.error === 'link-invalido';
  return (
    <section className="border-border bg-bg-card rounded-lg border p-8">
      <h1 className="font-display text-3xl tracking-wide">Entrar</h1>
      <p className="font-body text-text-secondary mt-2 mb-6 text-sm">
        Digita seu nome e email. A gente manda um link mágico.
      </p>
      {showError ? (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger mb-4 rounded-md border px-3 py-2 font-mono text-xs"
        >
          Esse link expirou ou já foi usado. Pede um novo abaixo.
        </div>
      ) : null}
      <LoginForm defaultNext={searchParams.next} />
    </section>
  );
}
