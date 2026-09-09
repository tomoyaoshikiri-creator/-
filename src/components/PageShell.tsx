export function PageShell({
  header,
  children,
  fab,
  wide = false,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  fab?: React.ReactNode;
  // trueの場合、通常ページの最大幅(max-w-2xl)による中央寄せの制限を外し、
  // 横に広い画面(iPad横向きなど)をそのまま活かすレイアウトに使う。
  wide?: boolean;
}) {
  return (
    <>
      {header}
      <div className="flex-1 overflow-y-auto px-4.5 pt-4 pb-5 relative min-[700px]:px-8 min-[700px]:pt-6">
        <div className={wide ? "" : "min-[700px]:max-w-2xl min-[700px]:mx-auto"}>{children}</div>
      </div>
      {fab}
    </>
  );
}
