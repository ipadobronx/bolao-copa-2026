import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/dashboard');

  const [profileRes, bilhetesCountRes] = await Promise.all([
    supabase.from('profiles').select('nome, email').eq('id', user.id).single(),
    supabase
      .from('bilhetes_view')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', user.id)
      .eq('effective_status', 'confirmado'),
  ]);
  const profile = profileRes.data;
  const totalBilhetes = bilhetesCountRes.count ?? 0;

  if (!profile?.nome) {
    console.warn(
      '[dashboard/layout] profile.nome vazio para user',
      user.id,
      '— exibindo fallback "Apostador"',
    );
  }

  return (
    <DashboardShell nome={profile?.nome ?? ''} email={user.email!} totalBilhetes={totalBilhetes}>
      {children}
    </DashboardShell>
  );
}
