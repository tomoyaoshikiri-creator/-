export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell justify-center px-6 py-10">
      <div className="mb-10 text-center">
        <h1 className="font-display font-medium text-ink leading-[1.15]">
          <span className="block text-4xl tracking-[0.2em]">CLUB</span>
          <span className="block text-4xl tracking-[0.2em]">LINK</span>
        </h1>
        <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-ink-soft mt-3">
          Team Management
        </div>
      </div>
      {children}
    </div>
  );
}
