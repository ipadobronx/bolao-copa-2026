import type { Metadata } from 'next';
import Link from 'next/link';

import { RedefinirSenhaForm } from '@/components/auth/RedefinirSenhaForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Redefinir senha · Mala na Copa',
  robots: { index: false, follow: false },
};

export default async function RedefinirSenhaPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section className="border-border bg-bg-card rounded-lg border p-8">
        <h1 className="font-display text-3xl tracking-wide">Link inválido</h1>
        <p className="font-body text-text-secondary mt-2 mb-6 text-sm">
          O link expirou ou já foi usado. Solicite um novo para redefinir a senha.
        </p>
        <Link
          href="/login/recuperar-senha"
          className="btn-primary inline-flex items-center justify-center"
        >
          Solicitar novo link
        </Link>
      </section>
    );
  }

  return (
    <section className="border-border bg-bg-card rounded-lg border p-8">
      <h1 className="font-display text-3xl tracking-wide">Redefinir senha</h1>
      <p className="font-body text-text-secondary mt-2 mb-6 text-sm">
        Escolha uma nova senha para sua conta.
      </p>
      <RedefinirSenhaForm />
    </section>
  );
}
