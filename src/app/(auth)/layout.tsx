export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <div className="flex-1 overflow-y-auto flex flex-col justify-center px-6 py-10">{children}</div>
    </div>
  );
}
