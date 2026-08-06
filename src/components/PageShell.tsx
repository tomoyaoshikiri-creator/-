export function PageShell({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      {header}
      <div className="flex-1 overflow-y-auto px-4.5 pt-4 pb-5 relative">{children}</div>
    </>
  );
}
