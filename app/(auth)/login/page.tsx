import { LoginForm } from '@/components/auth/LoginForm';

type Search = { next?: string };

export default function LoginPage({ searchParams }: { searchParams: Search }) {
  return (
    <section className="border-border bg-bg-card rounded-lg border p-8">
      <h1 className="font-display text-3xl tracking-wide">Bolão Copa 2026</h1>
      <p className="font-body text-text-secondary mt-2 mb-6 text-sm">
        Entre ou crie sua conta para participar.
      </p>
      <LoginForm defaultNext={searchParams.next} />
    </section>
  );
}
