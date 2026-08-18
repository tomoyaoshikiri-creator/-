"use client";

import { useRouter } from "next/navigation";

// 利用規約・プライバシーポリシー・特商法表記ページの「戻る」リンク。
// ログイン画面・設定画面どちらから来ても、ブラウザ履歴上の1つ前のページに戻る。
export function BackLink() {
  const router = useRouter();
  return (
    <button onClick={() => router.back()} className="text-[12.5px] font-bold text-orange">
      ← 戻る
    </button>
  );
}
