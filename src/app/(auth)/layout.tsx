export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <div className="flex-1 overflow-y-auto flex flex-col justify-center px-6 py-10">{children}</div>
      <div className="flex-none text-center text-[10px] tracking-[0.15em] text-ink-soft pb-5">
        Powered by FAITH CREATION
      </div>
    </div>
  );
}
