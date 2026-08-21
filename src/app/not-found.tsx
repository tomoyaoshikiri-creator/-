import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-full bg-paper text-ink flex items-center justify-center">
      <div className="max-w-[720px] mx-auto px-6 py-12 text-center">
        <h1 className="font-medium text-2xl mt-6 mb-2">ページが見つかりません</h1>
        <p className="text-[12.5px] text-ink-soft leading-relaxed mb-8">
          お探しのページは存在しないか、移動または削除された可能性があります。
        </p>
        <Link href="/" className="text-[12.5px] font-bold text-orange">
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}
