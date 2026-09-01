import { BackLink } from "@/components/BackLink";

export const metadata = { title: "利用規約 | CIRCLE LINES" };

export default function TermsOfServicePage() {
  return (
    <div className="min-h-full bg-paper text-ink">
      <div className="max-w-[720px] mx-auto px-6 py-12">
        <BackLink />

        <h1 className="font-medium text-2xl mt-6 mb-2">利用規約</h1>
        <p className="text-[12px] text-ink-soft mb-8">制定日: 2026年8月16日</p>

        <div className="text-[12.5px] leading-relaxed bg-white border border-line rounded-2xl p-4 mb-8">
          これは正式公開前のドラフトです。実際の運用開始前に、記載内容(特に利用料金・免責事項の部分)について専門家の確認を受けてください。
        </div>

        <Section title="第1条(適用)">
          <p>
            本規約は、FAITH CREATION(以下「当運営者」といいます)が提供するチーム運営支援アプリ「CIRCLE
            LINES」(以下「本サービス」といいます)の利用条件を定めるものです。利用者は、本規約に同意のうえ本サービスを利用するものとします。
          </p>
        </Section>

        <Section title="第2条(定義)">
          <ul className="list-disc pl-5 space-y-1">
            <li>「利用者」とは、本サービスにアカウントを登録して利用する個人をいいます。</li>
            <li>「チーム」とは、本サービス上で作成される、選手・保護者・指導者等が所属する運営単位をいいます。</li>
          </ul>
        </Section>

        <Section title="第3条(利用登録・アカウント)">
          <ul className="list-disc pl-5 space-y-1">
            <li>本サービスは、チームから発行された招待リンクを通じて利用登録を行います。</li>
            <li>
              利用者は、自己の責任においてアカウント情報(メールアドレス・パスワード)を適切に管理するものとし、第三者に利用させ、または貸与・譲渡してはなりません。
            </li>
            <li>アカウント情報の管理不十分による損害について、当運営者は責任を負いません。</li>
          </ul>
        </Section>

        <Section title="第4条(禁止事項)">
          <p className="mb-2">利用者は、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>法令または公序良俗に違反する行為</li>
            <li>他の利用者、第三者の権利を侵害する行為</li>
            <li>本サービスの運営を妨げる行為(不正アクセス、過度な負荷をかける行為等)</li>
            <li>権限なく他者のアカウントを利用する行為</li>
            <li>チーム内で知り得た選手・保護者等の個人情報を、本サービスの利用目的を超えて利用する行為</li>
          </ul>
        </Section>

        <Section title="第5条(本サービスの提供の停止・変更・終了)">
          <p>
            当運営者は、システムの保守・障害、その他運営上やむを得ない事由がある場合、利用者への事前の通知なく本サービスの全部または一部の提供を停止・変更・終了することがあります。これにより利用者に生じた損害について、当運営者は故意または重過失がある場合を除き責任を負いません。
          </p>
        </Section>

        <Section title="第6条(利用料金)">
          <p>
            本サービスの一部または全部の機能について、当運営者が別途定める有料プランを設ける場合があります。有料プランの内容・料金・支払方法は、本サービス上に別途表示するものとし、利用者は表示された条件に同意のうえ申し込むものとします。
          </p>
        </Section>

        <Section title="第7条(免責事項)">
          <ul className="list-disc pl-5 space-y-1">
            <li>当運営者は、本サービスに事実上または法律上の瑕疵がないことを明示的にも黙示的にも保証しません。</li>
            <li>
              当運営者は、本サービスに起因して利用者に生じたあらゆる損害について、当運営者の故意または重過失による場合を除き、一切の責任を負いません。
            </li>
          </ul>
        </Section>

        <Section title="第8条(本規約の変更)">
          <p>
            当運営者は、必要と判断した場合、利用者への通知なく本規約を変更できるものとします。変更後の規約は、本サービス上に掲示した時点から効力を生じるものとします。
          </p>
        </Section>

        <Section title="第9条(準拠法・管轄裁判所)">
          <p>
            本規約の解釈にあたっては日本法を準拠法とします。本サービスに関して紛争が生じた場合、当運営者の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
          </p>
        </Section>

        <Section title="第10条(お問い合わせ窓口)">
          <p>
            本規約に関するお問い合わせは、下記までご連絡ください。
            <br />
            FAITH CREATION　info@faith-creation.jp
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
