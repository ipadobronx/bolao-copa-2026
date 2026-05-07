import type { Metadata } from 'next';

import { RecuperarSenhaForm } from '@/components/auth/RecuperarSenhaForm';

export const metadata: Metadata = {
  title: 'Recuperar senha · Mala na Copa',
  robots: { index: false, follow: false },
};

export default function RecuperarSenhaPage() {
  return (
    <section className="border-border bg-bg-card rounded-lg border p-8">
      <h1 className="font-display text-3xl tracking-wide">Recuperar senha</h1>
      <p className="font-body text-text-secondary mt-2 mb-6 text-sm">
        Digite seu email e te mandamos um link pra redefinir a senha.
      </p>
      <RecuperarSenhaForm />
    </section>
  );
}
