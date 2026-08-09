export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <div className="flex-1 overflow-y-auto flex flex-col justify-center px-6 py-10">
        <div className="mb-10 text-center">
          <h1
            className="font-medium text-ink leading-[1.15]"
            style={{ fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, "メイリオ", sans-serif' }}
          >
            <span className="block text-4xl tracking-[0.2em]">Club</span>
            <span className="block text-4xl tracking-[0.2em]">Link</span>
          </h1>
          <div
            className="text-[10px] tracking-[0.3em] uppercase text-ink-soft mt-3"
            style={{ fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, "メイリオ", sans-serif' }}
          >
            Team Management Tools
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
