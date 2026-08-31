export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell auth-shell">
      <div className="flex-1 overflow-y-auto flex flex-col justify-center-safe px-6 py-10">{children}</div>
      <div className="flex-none text-center text-[10px] tracking-[0.15em] text-ink-soft pb-5">
        <div className="mb-1.5 flex items-center justify-center gap-3 normal-case tracking-normal">
          <a href="/privacy" className="underline">
            プライバシーポリシー
          </a>
          <a href="/terms" className="underline">
            利用規約
          </a>
        </div>
        Powered by FAITH CREATION
      </div>
    </div>
  );
}
