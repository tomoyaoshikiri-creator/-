import { BackLink } from "@/components/BackLink";
import { FAQ_CATEGORIES } from "@/content/faq";
import { FaqAccordion } from "./FaqAccordion";

export const metadata = { title: "よくある質問 | CIRCLE LINES" };

// ログイン前後どちらからも閲覧できる公開ページ(/pricing /terms と同じ扱い、(app)グループ外)。
export default function HelpPage() {
  return (
    <div className="min-h-full bg-paper text-ink">
      <div className="max-w-[720px] mx-auto px-6 py-12">
        <BackLink />

        <h1 className="font-medium text-2xl mt-6 mb-2">よくある質問</h1>
        <p className="text-[12.5px] text-ink-soft mb-6">カテゴリーをタップすると質問が開きます。</p>

        <nav aria-label="カテゴリー一覧" className="flex flex-wrap gap-2 mb-8">
          {FAQ_CATEGORIES.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              className="text-[11.5px] font-bold text-orange border border-orange rounded-full px-3 py-1.5 bg-orange/8"
            >
              {c.title}
            </a>
          ))}
        </nav>

        <FaqAccordion categories={FAQ_CATEGORIES} />

        <div className="rounded-lg border border-line bg-white p-4 mt-8 text-center">
          <div className="text-[12.5px] text-ink-soft mb-2">このページで解決しなかった場合は、お問い合わせください。</div>
          <a href="/contact" className="inline-block text-[12.5px] font-bold text-orange underline">
            お問い合わせページへ ›
          </a>
        </div>
      </div>
    </div>
  );
}
