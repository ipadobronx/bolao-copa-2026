export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border border-b px-6 py-4">
        <span className="font-display text-2xl tracking-wide">
          BOLÃO <span className="text-accent">2026</span>
        </span>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-border text-text-muted border-t px-6 py-4 text-center font-mono text-xs">
        Bolão Copa 2026 — placeholder de footer (real na Feature 3)
      </footer>
    </div>
  );
}
