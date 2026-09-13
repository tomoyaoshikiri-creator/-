import { BackLink } from "@/components/BackLink";

export const metadata = { title: "お問い合わせ | CIRCLE LINES" };

export default function ContactPage() {
  return (
    <div className="min-h-full bg-paper text-ink">
      <div className="max-w-[720px] mx-auto px-6 py-12">
        <BackLink />

        <h1 className="font-medium text-2xl mt-6 mb-2">お問い合わせ</h1>
        <p className="text-[12.5px] text-ink-soft mb-8 leading-relaxed">
          CIRCLE LINESのご利用方法、不具合のご報告、料金・お支払いに関するご質問など、下記のメールアドレスまでお気軽にご連絡ください。
        </p>

        <div className="rounded-lg border border-line bg-white p-5 mb-8">
          <div className="text-[11px] text-ink-soft mb-1">お問い合わせ先</div>
          <a href="mailto:info@faith-creation.jp" className="text-[15px] font-bold text-orange underline">
            info@faith-creation.jp
          </a>
          <div className="text-[11px] text-ink-soft mt-2">運営: FAITH CREATION</div>
        </div>

        <Section title="よくあるお問い合わせ">
          <ul className="list-disc pl-5 space-y-1">
            <li>操作方法・機能についてのご質問</li>
            <li>不具合・表示崩れなどのご報告</li>
            <li>料金プラン・お支払いに関するご質問</li>
            <li>解約・退会に関するお手続き</li>
            <li>その他、サービスに関するご意見・ご要望</li>
          </ul>
        </Section>

        <Section title="ご連絡の際のお願い">
          <p>
            スムーズにご対応するため、ご登録のメールアドレスと、チーム名(わかる場合)をあわせてお知らせください。内容を確認のうえ、順次ご返信いたします。
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="font-bold text-[14.5px] mb-2">{title}</h2>
      <div className="text-[12.5px] text-ink leading-relaxed">{children}</div>
    </section>
  );
}
