import Link from "next/link";

export const metadata = { title: "プライバシーポリシー | CLUB LINK" };

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-full bg-paper text-ink">
      <div className="max-w-[720px] mx-auto px-6 py-12">
        <Link href="/login" className="text-[12.5px] font-bold text-orange">
          ← ログイン画面に戻る
        </Link>

        <h1 className="font-medium text-2xl mt-6 mb-2">プライバシーポリシー</h1>
        <p className="text-[12px] text-ink-soft mb-8">制定日: 2026年8月16日</p>

        <div className="text-[12.5px] leading-relaxed bg-white border border-line rounded-2xl p-4 mb-8">
          これは正式公開前のドラフトです。実際の運用開始前に、記載内容(特に未成年者の個人情報の取扱い・第三者提供先・将来の有料プランに関する部分)について専門家の確認を受けてください。
        </div>

        <Section title="1. はじめに">
          <p>
            FAITH CREATION(以下「当運営者」といいます)は、チーム運営支援アプリ「CLUB
            LINK」(以下「本サービス」といいます)における利用者の個人情報の取扱いについて、以下のとおりプライバシーポリシー(以下「本ポリシー」といいます)を定めます。
          </p>
        </Section>

        <Section title="2. 事業者情報">
          <dl className="text-[12.5px] leading-relaxed">
            <div className="flex gap-2 mb-1">
              <dt className="text-ink-soft flex-none w-20">運営者</dt>
              <dd>FAITH CREATION</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-soft flex-none w-20">連絡先</dt>
              <dd>info@faith-creation.jp</dd>
            </div>
          </dl>
        </Section>

        <Section title="3. 取得する情報">
          <p className="mb-2">本サービスでは、利用にあたり以下の情報を取得します。</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>アカウント情報: メールアドレス、パスワード(暗号化して保存)、表示名、権限(ロール)</li>
            <li>チーム情報: チーム名、ロゴ画像、配色設定、招待リンクの発行・利用状況</li>
            <li>
              選手情報: 氏名、学年、ポジション、背番号、生年月日、身長・体重の記録、スポーツテスト結果、試合の出場記録・スタッツ、指導者による選手メモ・分析フィードバック(これらには未成年者に関する情報が含まれます)
            </li>
            <li>保護者と選手の紐付け情報</li>
            <li>予定・出欠登録、お知らせ、練習日報、コーチノートおよびそれらへのコメント・スタンプの内容</li>
          </ul>
        </Section>

        <Section title="4. 利用目的">
          <ul className="list-disc pl-5 space-y-1">
            <li>本サービスの各機能(予定・出欠管理、お知らせ配信、選手カルテ管理等)を提供するため</li>
            <li>利用者からのお問い合わせに対応するため</li>
            <li>不正利用の防止、本サービスの維持・改善のため</li>
            <li>将来提供する有料プランに関する利用状況の管理・請求のため</li>
          </ul>
        </Section>

        <Section title="5. 第三者提供・業務委託">
          <p className="mb-2">
            当運営者は、本サービスの提供にあたり、以下の外部事業者にデータの保管・処理を委託しています。委託先は適切な安全管理措置を講じている事業者を選定しています。
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Supabase, Inc.(データベース・認証・ファイルストレージ)</li>
            <li>Vercel Inc.(アプリケーションのホスティング)</li>
            <li>将来、有料プランの提供にあたり決済代行事業者(Stripe等)を利用する場合があります</li>
          </ul>
          <p className="mt-2">
            上記の業務委託の場合を除き、法令に基づく場合等を除いて、あらかじめ利用者の同意を得ることなく第三者に個人情報を提供することはありません。
          </p>
        </Section>

        <Section title="6. 未成年者の情報の取扱いについて">
          <p>
            選手情報の多くは未成年者に関するものです。選手情報はチームの指導者・管理者権限を持つ利用者が登録し、保護者はチームから発行された招待リンクを通じてアカウントを作成のうえ、紐付けられた自分の子どもの情報のみ閲覧できます。選手情報の登録・修正・削除に関するご要望は、まず所属チームの管理者にご相談ください。
          </p>
        </Section>

        <Section title="7. Cookie等の利用">
          <p>
            本サービスは、ログイン状態を維持するために認証用のCookieを利用します。これは本サービスの提供に必要な範囲での利用であり、広告目的のトラッキングには利用していません。
          </p>
        </Section>

        <Section title="8. 安全管理措置">
          <p>
            当運営者は、取得した個人情報の漏えい・滅失・毀損の防止その他の安全管理のために、アクセス制御(ロールベースの権限管理)や通信の暗号化など、必要かつ適切な措置を講じます。
          </p>
        </Section>

        <Section title="9. 開示・訂正・削除等のご請求">
          <p>
            利用者は、当運営者が保有する自己の個人情報について、開示・訂正・利用停止・削除を求めることができます。ご希望の場合は、下記の連絡先までお問い合わせください。本人確認のうえ、法令に従い対応します。
          </p>
        </Section>

        <Section title="10. 本ポリシーの改定">
          <p>
            本ポリシーの内容は、法令の変更や本サービスの機能追加等に応じて、予告なく変更することがあります。重要な変更を行う場合は、本サービス上での掲示等、適切な方法で周知します。
          </p>
        </Section>

        <Section title="11. お問い合わせ窓口">
          <p>
            本ポリシーに関するお問い合わせは、下記までご連絡ください。
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
