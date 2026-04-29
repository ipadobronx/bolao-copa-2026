export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="border-border hidden w-64 border-r p-6 md:block">
        <span className="font-display text-xl tracking-wide">DASHBOARD</span>
        <p className="text-text-muted mt-2 font-mono text-xs">sidebar real na Feature 4</p>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
