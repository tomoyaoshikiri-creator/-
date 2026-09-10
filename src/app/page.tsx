import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brandGradientStops, gradientCss } from "@/lib/theme";

export const metadata = { title: "CIRCLE LINES | チーム運営をシンプルに" };

const FONT_JP = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, "メイリオ", sans-serif';

const FEATURES = [
  { title: "選手管理", desc: "選手名簿・保護者情報をまとめて管理" },
  { title: "予定・出欠", desc: "練習や試合の予定を共有し、出欠をワンタップで集計" },
  { title: "お知らせ", desc: "チーム全体・対象を絞った連絡をまとめて配信" },
  { title: "日報・コーチノート", desc: "日々の練習内容や選手への所見を記録・共有" },
  { title: "試合スタッツ・カルテ", desc: "試合ごとの記録とチーム・選手の成長をデータで可視化" },
  { title: "ライブラリ", desc: "練習動画・資料をチームで共有" },
];

// 未ログイン時は公開LPを表示し、ログイン済みなら従来通り/homeへ(proxy.tsの
// isAuthRouteに"/"を追加したことで、未ログイン時もこのページ自体には到達できる)。
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/home");
  }

  const brandGradient = gradientCss(brandGradientStops());

  return (
    <div className="min-h-full bg-paper text-ink">
      <div className="max-w-[720px] mx-auto px-6 py-16 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/circle-lines-logo.png" alt="CIRCLE LINES" className="w-24 h-auto mx-auto mb-5" />
        <h1
          className="font-medium text-[26px] tracking-wide mb-3"
          style={{
            fontFamily: FONT_JP,
            backgroundImage: brandGradient,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          CIRCLE LINES
        </h1>
        <p className="text-[13.5px] text-ink-soft leading-relaxed mb-8">
          少年団・クラブチームの運営をひとつにまとめる
          <br />
          チームマネジメントアプリ
        </p>

        <div className="flex items-center justify-center gap-3 mb-16">
          <Link href="/signup" className="rounded-lg bg-orange text-white font-bold text-[13px] px-7 py-3">
            無料で始める
          </Link>
          <Link href="/login" className="rounded-lg border border-line text-ink font-bold text-[13px] px-7 py-3">
            ログイン
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-16">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-line bg-white p-4">
              <div className="font-bold text-[13px] mb-1">{f.title}</div>
              <div className="text-[11.5px] text-ink-soft leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="mb-10">
          <Link href="/pricing" className="text-[12.5px] text-orange font-bold underline">
            料金プランを見る ›
          </Link>
        </div>

        <div className="flex items-center justify-center gap-3 text-[10.5px] text-ink-soft">
          <a href="/privacy" className="underline">
            プライバシーポリシー
          </a>
          <a href="/terms" className="underline">
            利用規約
          </a>
          <a href="/tokushoho" className="underline">
            特定商取引法に基づく表記
          </a>
        </div>
        <div className="text-[10px] text-ink-soft mt-2">Powered by FAITH CREATION</div>
      </div>
    </div>
  );
}
