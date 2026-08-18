import Link from "next/link";

export const metadata = { title: "特定商取引法に基づく表記 | CLUB LINK" };

export default function TokushohoPage() {
  return (
    <div className="min-h-full bg-paper text-ink">
      <div className="max-w-[720px] mx-auto px-6 py-12">
        <Link href="/login" className="text-[12.5px] font-bold text-orange">
          ← ログイン画面に戻る
        </Link>

        <h1 className="font-medium text-2xl mt-6 mb-2">特定商取引法に基づく表記</h1>
        <p className="text-[12px] text-ink-soft mb-8">制定日: 2026年8月17日</p>

        <div className="text-[12.5px] leading-relaxed bg-white border border-line rounded-2xl p-4 mb-8">
          これは正式公開前のドラフトです。実際の運用開始前に、記載内容について専門家の確認を受けてください。
        </div>

        <dl className="text-[12.5px] leading-relaxed">
          <Row label="販売事業者">FAITH CREATION</Row>
          <Row label="運営統括責任者">サービス担当者(下記メールアドレスまでお問い合わせください)</Row>
          <Row label="所在地">ご請求をいただいた場合、遅滞なく開示いたします。</Row>
          <Row label="電話番号">ご請求をいただいた場合、遅滞なく開示いたします。</Row>
          <Row label="メールアドレス">info@faith-creation.jp</Row>
          <Row label="販売価格">
            Standardプラン 月額1,280円(税込)
            <br />
            Proプラン 月額2,480円(税込)
            <br />
            Pro AI Plusプラン 月額3,280円(税込)
            <br />
            <span className="text-ink-soft">※各プランの内容は本サービス上に表示のとおりです。</span>
          </Row>
          <Row label="商品代金以外に必要な料金">
            特にありません(インターネット接続にかかる通信費はお客様のご負担となります)。
          </Row>
          <Row label="お支払い方法">クレジットカード決済(Stripeによるオンライン決済)</Row>
          <Row label="お支払い時期">
            お申し込み時に決済されます。以降は毎月同日に自動更新され、その都度自動的に決済されます。
          </Row>
          <Row label="サービス提供時期">決済完了後、直ちにプラン内容が反映されます。</Row>
          <Row label="返品・キャンセルについて">
            商品の性質上、お支払い済みの料金の返金は行っておりません。ご解約はお支払い管理ページからいつでも可能で、日割りでの返金はなく、解約手続き後も次回更新日の前日まではプランをご利用いただけます。
          </Row>
        </dl>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-3 border-b border-line last:border-b-0">
      <dt className="text-ink-soft flex-none w-[110px]">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
