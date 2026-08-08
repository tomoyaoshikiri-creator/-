export function PageShell({
  header,
  children,
  fab,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  fab?: React.ReactNode;
}) {
  return (
    <>
      {header}
      <div className="flex-1 overflow-y-auto px-4.5 pt-4 pb-5 relative min-[700px]:px-8 min-[700px]:pt-6">
        <div className="min-[700px]:max-w-2xl min-[700px]:mx-auto">{children}</div>
      </div>
      {fab}
    </>
  );
}
