import { PLAN_PRICING_OPTIONS } from "@/lib/planPricing";
import { PLAN_DISPLAY_LABELS } from "@/lib/format";
import { FREE_PLAYER_LIMIT, FREE_HISTORY_WINDOW_DAYS } from "@/lib/plan";

// /helpページ(クラウド指示書 P-3)のQ&Aデータ。文面を差し替える際はこのファイルだけを
// 編集すればよい(コード側は触らない)。料金・上限の数字は可能な限り実際の定数
// (planPricing.ts/plan.ts)から生成しており、ズレがあれば__tests__/faq.test.tsxが検出する。
//
// 指示書の付録で「【要確認】」が付いていた項目は、ここには一切含めず、以下にコメントとして
// 残す(文面が確定し次第、該当カテゴリーに追加すること)。
// - 選手・試合・分析・ライブラリ: 「AI分析とは何ですか?」の免責文言(弁護士確認待ち)
// - プラン・お支払い: 「プランを変更・解約するには?」(Stripe Customer Portal・特商法ページとの照合待ち)
// - プラン・お支払い: 「領収書(請求書)は出せますか?」(Stripeの請求履歴導線の確認待ち)
// - データ・退会・安全: 「子どものデータはどう扱われますか?」(プライバシーポリシー法務レビュー待ち)
// - データ・退会・安全: 「データはどこに保存されますか?」(同上)
// - 困ったときは: 「iPadのSafariでログイン画面を開くとアプリが落ちる」(Apple側不具合、状況の再確認待ち)
//
// 以下は全文公開してよいが、指示書が「追記」を求めている箇所(未確定のため今は含めていない):
// - 通知: 「通知が届きません」はiPhoneでの受信条件が未検証のため、一般的な案内のみ掲載
// - 問い合わせ先: 返信目安日数は未確定のため未記載
// - プランの違い: 出欠集計レポート・CSV一括登録・監査ログ強化はM-1〜M-3実装後に追記

export interface FaqItem {
  id: string;
  question: string;
  answer: React.ReactNode;
}

export interface FaqCategory {
  id: string;
  title: string;
  items: FaqItem[];
}

const STORAGE_LABELS: Record<"お試し" | "中間" | "フル" | "フルプラス" | "Max", string> = {
  お試し: "100MB",
  中間: "1GB",
  フル: "5GB",
  フルプラス: "5GB",
  Max: "10GB",
};

function RoleTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className="py-1.5 pr-3 font-bold">ロール</th>
            <th className="py-1.5 font-bold">できること</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line">
            <td className="py-1.5 pr-3 align-top whitespace-nowrap">一般</td>
            <td className="py-1.5">閲覧、出欠登録、お知らせ・日報の投稿、予定の登録</td>
          </tr>
          <tr className="border-b border-line">
            <td className="py-1.5 pr-3 align-top whitespace-nowrap">運営</td>
            <td className="py-1.5">一般に加えて、保護者用の招待リンクの発行、投票の作成</td>
          </tr>
          <tr className="border-b border-line">
            <td className="py-1.5 pr-3 align-top whitespace-nowrap">指導者</td>
            <td className="py-1.5">選手情報の管理、試合の記録、コーチ日報など、スタッフ向け機能</td>
          </tr>
          <tr>
            <td className="py-1.5 pr-3 align-top whitespace-nowrap">管理者</td>
            <td className="py-1.5">ユーザー管理、チーム設定、プラン・課金、チーム退会</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PlanTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className="py-1.5 pr-3 font-bold">プラン</th>
            <th className="py-1.5 pr-3 font-bold">月額(税込)</th>
            <th className="py-1.5 font-bold">主な機能</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line">
            <td className="py-1.5 pr-3 align-top whitespace-nowrap">{PLAN_DISPLAY_LABELS["お試し"]}</td>
            <td className="py-1.5 pr-3 align-top whitespace-nowrap">¥0</td>
            <td className="py-1.5">基本機能(選手{FREE_PLAYER_LIMIT}人まで、日報・試合は直近{FREE_HISTORY_WINDOW_DAYS}日)</td>
          </tr>
          {PLAN_PRICING_OPTIONS.map((opt) => (
            <tr key={opt.plan} className="border-b border-line">
              <td className="py-1.5 pr-3 align-top whitespace-nowrap">{PLAN_DISPLAY_LABELS[opt.plan]}</td>
              <td className="py-1.5 pr-3 align-top whitespace-nowrap">{opt.price}</td>
              <td className="py-1.5">{opt.desc}</td>
            </tr>
          ))}
          <tr>
            <td className="py-1.5 pr-3 align-top whitespace-nowrap">{PLAN_DISPLAY_LABELS["Max"]}</td>
            <td className="py-1.5 pr-3 align-top whitespace-nowrap">個別見積もり</td>
            <td className="py-1.5">上記すべて + スポーツテスト・導入支援(お問い合わせ制)</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "intro",
    title: "はじめに(アカウント・ログイン)",
    items: [
      {
        id: "signup",
        question: "登録するにはどうすればいいですか?",
        answer:
          "チームの運営から届いた招待リンクを開き、メールアドレスとパスワードを登録してください。登録後に確認メールが届きます。メール内のリンクを開くか、6桁の確認コードを入力すると完了します。",
      },
      {
        id: "no-confirm-mail",
        question: "確認メールが届きません。",
        answer:
          "迷惑メールフォルダをご確認ください。それでも届かない場合は、入力したメールアドレスに誤りがないか確認のうえ、もう一度お試しください。解決しない場合は、お問い合わせページからご連絡ください。",
      },
      {
        id: "confirm-code",
        question: "確認コード(6桁)はどこに入力しますか?",
        answer:
          "登録画面・招待の受け付け画面・パスワード再設定画面に入力欄があります。メール内のリンクを開く代わりに、コードを入力しても同じように完了できます。",
      },
      {
        id: "forgot-password",
        question: "パスワードを忘れました。",
        answer:
          "ログイン画面の「パスワードをお忘れですか」から再設定できます。メールに届くリンクまたは6桁コードで手続きしてください。ログイン後に変えたい場合は「設定」からも変更できます。",
      },
      {
        id: "display-name",
        question: "表示名を変えたいです。",
        answer: "「設定」から変更できます。",
      },
      {
        id: "multiple-teams",
        question: "複数のチームに入れますか?",
        answer:
          "はい。1つのアカウントで複数チームに所属できます。「設定」またはヘッダーのメニューからチームを切り替えられます。ロール(一般・運営・指導者・管理者)はチームごとに別々です。",
      },
    ],
  },
  {
    id: "invite",
    title: "招待・メンバー",
    items: [
      {
        id: "issue-invite",
        question: "招待リンクはどうやって発行しますか?(運営・指導者・管理者)",
        answer:
          "ヘッダーのアバターメニューから招待リンクを発行できます。保護者向けは運営・指導者・管理者、指導者向けは管理者のみ発行できます。発行したリンクを、LINEなどでメンバーに送ってください。",
      },
      {
        id: "invite-multiple-use",
        question: "招待リンクは何人でも使えますか?",
        answer:
          "有効期限内であれば、同じ種類(保護者用/指導者用)のリンクを複数人が使えます。リンクを知っている人は誰でも参加できるため、チーム外の人に転送しないでください。不要になったリンクは管理者が取り消せます。",
      },
      {
        id: "invite-mistake",
        question: "間違って別の人を招待してしまいました。(管理者)",
        answer: "「ユーザー管理」から、招待の取り消しや、メンバーの役割変更・削除ができます。",
      },
      {
        id: "link-guardian-player",
        question: "お子さんと自分(保護者)を紐づけたいです。",
        answer:
          "招待の受け付け時に、チームの在籍選手から選んで紐づけられます。後から変更したい場合は、管理者に「ユーザー管理」で紐づけてもらってください。",
      },
      {
        id: "role-difference",
        question: "ロールによって何が違いますか?",
        answer: <RoleTable />,
      },
    ],
  },
  {
    id: "schedule",
    title: "予定・出欠",
    items: [
      {
        id: "where-attendance",
        question: "出欠はどこで登録しますか?",
        answer:
          "「予定」タブから該当の予定を開いて登録します。練習は「出席・欠席・遅刻早退・見学」、試合は「出席・欠席」から選べます。ホームの「要対応」にも、未登録の出欠が表示されます。",
      },
      {
        id: "attendance-reminder",
        question: "出欠の入力を忘れないか心配です。",
        answer: "通知をオンにしていれば、予定の2日前にリマインドが届きます。締切日が設定された予定は、締切日当日にも届きます。",
      },
      {
        id: "multiple-children",
        question: "子どもが複数います。",
        answer: "紐づいている選手ごとに出欠を登録できます。",
      },
      {
        id: "who-can-create-schedule",
        question: "予定は誰でも登録できますか?",
        answer: "はい。全ロールが予定の登録・編集・削除をできます。",
      },
      {
        id: "self-attendance-field",
        question: "自分の出欠を入力する欄が出ません(または出ます)。",
        answer:
          "選手に紐づいていない一般・運営メンバーの出欠を求めるかどうかは、管理者のチーム設定で切り替えられます。管理者にご確認ください。",
      },
    ],
  },
  {
    id: "notice",
    title: "お知らせ・日報・投票",
    items: [
      {
        id: "notice-audience",
        question: "お知らせを特定の人にだけ見せられますか?",
        answer:
          "投稿時に公開範囲を選べます(全員/運営以上/学年指定/指導者のみ)。「指導者のみ」を選べるのは指導者・管理者だけです。",
      },
      {
        id: "notice-attachment",
        question: "お知らせにファイルを付けられますか?",
        answer: "はい。対戦表・配車表・その他の3種類で、複数のファイルを添付できます。ファイルの容量はプランごとの上限に含まれます。",
      },
      {
        id: "reaction",
        question: "スタンプ(リアクション)はどう使いますか?",
        answer: "お知らせの下にあるスタンプを押してください。1つのお知らせに複数の種類を押せます。",
      },
      {
        id: "new-badge",
        question: "「NEW」の表示はいつ消えますか?",
        answer: "該当のお知らせや予定を開くと、既読になって消えます。",
      },
      {
        id: "report-vs-coach-note",
        question: "チーム日報とコーチ日報の違いは?",
        answer: "チーム日報は全ロールが書ける日報です。コーチ日報は指導者・管理者が書く指導者向けの日報で、Standardプラン以上で使えます。",
      },
      {
        id: "create-poll",
        question: "投票はどうやって作りますか?(運営・指導者・管理者)",
        answer:
          "「チーム」タブの投票から作成できます。単一選択・複数選択、匿名にするかどうか、投票できるロールを作成時に選べます。MVP投票では、選手名簿から選択肢を作れます。",
      },
      {
        id: "poll-results",
        question: "投票の結果はいつ見られますか?",
        answer: "締め切るまで、結果は公開されません。締め切り後は、得票数が全員に表示されます。投票者の名前は、匿名にしなかった投票でのみ表示されます。",
      },
    ],
  },
  {
    id: "players",
    title: "選手・試合・分析・ライブラリ",
    items: [
      {
        id: "who-manages-players",
        question: "選手の登録や編集ができるのは誰ですか?",
        answer: "指導者と管理者です。一般・運営は閲覧のみです。自分のお子さんに紐づいていない選手は、一覧でグレー表示になります。",
      },
      {
        id: "who-records-game",
        question: "試合の記録やスタッツは誰が入力しますか?",
        answer: "指導者と管理者が入力します。それ以外のロールは、「試合」タブで結果を閲覧できます。",
      },
      {
        id: "five-fouls",
        question: "バスケットボールで、5ファウルになった選手はどうなりますか?",
        answer: "試合のスタッツ入力で、ファウルが5になった選手に「退場」の表示が付きます。退場した選手は、出場メンバーとして選び直せません。",
      },
      {
        id: "free-history",
        question: "Freeプランでは過去の記録をどこまで見られますか?",
        answer: `チーム日報・試合結果とも、直近${FREE_HISTORY_WINDOW_DAYS}日分までです。データは消えず、Standard以上にすると全件見られます。`,
      },
      {
        id: "player-limit",
        question: "選手の登録人数に上限はありますか?",
        answer: `Freeプランは${FREE_PLAYER_LIMIT}人までです。有料プランでは、この上限は適用されません。`,
      },
      {
        id: "library-folder",
        question: "ライブラリのフォルダは誰が作れますか?",
        answer:
          "全員が作成できます。フォルダの名前変更・移動・削除は、指導者と管理者のみです。フォルダは何階層でも作れます。フォルダを削除すると、中の資料は1つ上の階層に移ります。",
      },
    ],
  },
  {
    id: "notifications",
    title: "通知",
    items: [
      {
        id: "what-notifications",
        question: "どんな通知が届きますか?",
        answer: "新しいお知らせの投稿、出欠登録のリマインド、選手の誕生日などが届きます。",
      },
      {
        id: "no-notifications",
        question: "通知が届きません。",
        answer: "「設定」の通知の項目がオンになっているか確認してください。ブラウザやスマートフォン側で通知が許可されているかも確認してください。",
      },
      {
        id: "email-fallback",
        question: "通知をオフにしても、メールは届きますか?",
        answer: "招待の発行、出欠の締切、お支払いの失敗、チーム退会の予告など、重要なお知らせはメールでも届くことがあります。",
      },
    ],
  },
  {
    id: "billing",
    title: "プラン・お支払い(管理者向け)",
    items: [
      {
        id: "plan-difference",
        question: "プランの違いを教えてください。",
        answer: (
          <>
            <PlanTable />
            <p className="mt-2">
              年払いは10か月分(2か月分お得)です。年額は{PLAN_DISPLAY_LABELS["中間"]} {PLAN_PRICING_OPTIONS[0].yearlyPrice} /{" "}
              {PLAN_DISPLAY_LABELS["フル"]} {PLAN_PRICING_OPTIONS[1].yearlyPrice} / {PLAN_DISPLAY_LABELS["フルプラス"]}{" "}
              {PLAN_PRICING_OPTIONS[2].yearlyPrice} です。
            </p>
          </>
        ),
      },
      {
        id: "downgrade-data",
        question: "ダウングレードするとデータは消えますか?",
        answer: "消えません。上限(選手数・容量)を超えていても、既存のデータは削除も非表示もされません。超えた分は、新しく登録・アップロードできなくなります。",
      },
      {
        id: "storage-limit",
        question: "ファイルの容量はどれくらい使えますか?",
        answer: `${PLAN_DISPLAY_LABELS["お試し"]} ${STORAGE_LABELS["お試し"]}、${PLAN_DISPLAY_LABELS["中間"]} ${STORAGE_LABELS["中間"]}、${PLAN_DISPLAY_LABELS["フル"]}・${PLAN_DISPLAY_LABELS["フルプラス"]} ${STORAGE_LABELS["フル"]}、${PLAN_DISPLAY_LABELS["Max"]} ${STORAGE_LABELS["Max"]} です。使用量は「設定 > チーム設定」で確認できます。`,
      },
    ],
  },
  {
    id: "account",
    title: "データ・退会・安全",
    items: [
      {
        id: "delete-account",
        question: "自分のアカウントを削除したい(サービスを退会したい)。",
        answer:
          "「設定」の「このサービスから退会する」から手続きできます。全チームからの脱退とアカウントの削除が行われます。あるチームの最後の管理者である場合は、先に別の管理者を指名するか、チームの退会手続きを行う必要があります。",
      },
      {
        id: "delete-team",
        question: "チーム自体をなくしたい(チームを退会したい)。(管理者)",
        answer:
          "「設定 > チーム設定 > チームを退会する」から申請できます。申請後7日間は取り消せます。7日後にチームのデータが完全に削除されます。有料プランは、申請と同時に解約されます。",
      },
      {
        id: "export-before-leave",
        question: "退会前にデータを保存できますか?",
        answer: "はい。データのエクスポート機能があります。チームを退会する前にご利用ください。",
      },
    ],
  },
  {
    id: "trouble",
    title: "困ったときは",
    items: [
      {
        id: "display-broken",
        question: "表示がおかしい・動かない。",
        answer: "ページの再読み込み、またはログインし直しをお試しください。改善しない場合は、お使いの機種・ブラウザ・状況を添えてお問い合わせください。",
      },
      {
        id: "contact",
        question: "問い合わせ先は?",
        answer: (
          <>
            お問い合わせページ(
            <a href="mailto:info@faith-creation.jp" className="underline font-bold text-orange">
              info@faith-creation.jp
            </a>
            )から連絡してください。
          </>
        ),
      },
    ],
  },
];
