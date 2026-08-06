export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="font-mono text-[11px] tracking-widest uppercase text-ink-soft mb-1">
          Team Management
        </div>
        <h1 className="font-display font-extrabold text-3xl text-navy">都賀ビクトリーズ</h1>
      </div>
      {children}
    </div>
  );
}
