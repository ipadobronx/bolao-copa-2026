import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
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
      {/* Mobile header */}
      <header className="border-border bg-bg-elevated border-b px-5 py-4 md:hidden">
        <span className="font-display text-danger text-xl tracking-wide">
          ADMIN<span className="text-accent">26</span>
        </span>
      </header>

      {/* Desktop sidebar */}
      <AdminSidebar className="hidden md:flex md:flex-col" />

      {/* Main content */}
      <main className="p-5 md:p-8">
        {children}
      </main>
    </div>
  )
}
