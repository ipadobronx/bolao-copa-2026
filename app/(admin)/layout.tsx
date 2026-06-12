import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminTopbarMobile } from '@/components/admin/AdminTopbarMobile'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin')

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) redirect('/')

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      {/* Mobile header com hamburguer + drawer */}
      <AdminTopbarMobile />

      {/* Desktop sidebar */}
      <AdminSidebar className="hidden md:flex md:flex-col" />

      {/* Main content (pt-20 no mobile pro topbar fixo não cobrir) */}
      <main className="p-5 pt-20 md:p-8">
        {children}
      </main>
    </div>
  )
}
