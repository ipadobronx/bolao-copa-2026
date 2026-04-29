export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border bg-bg-elevated border-b px-6 py-4">
        <span className="font-display text-danger text-xl tracking-wide">ADMIN</span>
        <span className="text-text-muted ml-2 font-mono text-xs">
          (guard de is_admin entra na Feature 9)
        </span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
