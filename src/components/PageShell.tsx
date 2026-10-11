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
      <div className="print:hidden">{header}</div>
      <div className="flex-1 overflow-y-auto px-4.5 pt-4 pb-5 relative min-[700px]:px-8 min-[700px]:pt-6 print:overflow-visible print:p-0">
        {children}
      </div>
      <div className="print:hidden">{fab}</div>
    </>
  );
}
