export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: 24, background: "white" }}>
      {children}
    </main>
  );
}
