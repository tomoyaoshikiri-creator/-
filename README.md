# ClubLink

少年スポーツチーム向けのチーム運営アプリ。予定・出欠管理、お知らせ、練習日報、選手マスタ、選手メモ、試合記録、ユーザー管理を1つのアプリにまとめている。都賀ビクトリーズを試運転チームとして開発しているが、チームIDによる完全なマルチテナント設計になっており、FAITH CREATIONの事業として他チームへの展開も想定している。ログイン前の画面は「ClubLink」という製品名で統一し、チーム名などの個別ブランドはログイン後にのみ表示する。

技術構成: Next.js (App Router) + TypeScript + Tailwind CSS / Supabase (Postgres + Auth + Storage、Row Level Securityでチームごとにデータを分離)。

## セットアップ手順

### 1. Supabaseプロジェクトを作成する

1. https://supabase.com でプロジェクトを新規作成する
2. プロジェクトのダッシュボード → SQL Editor を開き、`supabase/migrations/` 配下のファイルを**番号順に**貼り付けて実行する
   - `0001_init.sql`: テーブル・RLSポリシー・トリガー・RPC関数・お知らせ添付用のStorageバケット
   - `0002_team_theme.sql`: チームごとの配色カスタマイズ用の列とRLS更新
   - `0003_team_logo.sql`: チームロゴアップロード用の列とStorageバケット・RLS
   - `0004_default_team_logo_rpc.sql`: ホーム画面アイコン用に、ログイン前でもチームロゴを取得できるRPC
   - `0005_obog_year_tracking.sql`: OB・OGの卒団からの経過年数を追跡できるようgradeの制約とadvance_academic_yearを更新
   - `0006_general_can_write_schedule_notice.sql`: 予定・お知らせの登録・編集を一般権限にも解放
   - `0007_notice_attachment_delete.sql`: お知らせ添付資料の削除用ポリシー(編集画面からの削除に必要)
   - `0008_notice_attachment_insert_any_writer.sql`: 添付資料の登録を発信者本人だけでなく書き込み権限のある全員に解放
   - `0009_notice_delete.sql`: お知らせ削除用のポリシー(編集画面からの削除に必要)
   - `0010_profile_self_update.sql`: 本人による表示名の変更を許可するポリシー・ガード(権限・ステータス・所属チームは管理者のみ変更可)
   - `0011_profile_delete_fk_fix.sql`: 予定・お知らせ・日報・選手メモ・招待リンクの作成者列を、ユーザー削除時にNULLへ変更するよう外部キーを修正(以前はこれらの記録があるとユーザーを削除できなかった)
   - `0012_schedule_event_type.sql`: 予定の種別に「イベント」を追加
   - `0013_game_matches.sql`: 1日に複数試合ある場合に対応するため、予定とクォーター記録の間に「第◯試合・対戦相手」を表すgame_matchesテーブルを追加
   - `0014_player_guardians.sql`: 選手⇔保護者アカウントの紐付け(player_guardians)を追加し、出欠(attendances)を選手単位でも記録できるようにする
   - `0015_players_select_own_child.sql`: 保護者アカウント(一般・役員)が、紐付けられた自分の子ども(選手)の情報だけは閲覧できるようにする(playersテーブルは元々指導者・管理者のみ閲覧可だったための追加ポリシー)
   - `0016_profile_email.sql`: profiles.emailを追加し、チーム作成・招待受諾時にauth.usersのメールアドレスをコピーする。list_team_members() RPCを追加し、ユーザー管理画面では管理者だけがメールアドレスを見られるようにする(profiles_selectポリシー自体には乗せていないため、他のロールはAPIレベルでも取得できない)
   - ユーザー管理画面からのユーザー削除は`src/app/api/admin/delete-user/route.ts`(service_roleキー使用)経由でauth.usersごと削除するため、マイグレーション追加なし。profiles.idはauth.users(id)にon delete cascadeで参照しているため、auth.users側を削除すればprofiles行(および紐づく出欠等)も自動的に削除される。これにより削除したユーザーのメールアドレスは新規登録に再利用できるようになる
   - `0017_schedule_target_and_admin_attendance.sql`: schedules.target_grade_minを追加し、予定ごとに出欠対象を「全員」または「○年生以上」に限定できるようにする。あわせてattendances_insert/updateポリシーを見直し、これまで検証していなかった選手との紐付け(player_guardians)チェックを追加しつつ、管理者は紐付けに関わらず全選手の出欠を代理登録・編集できるようにする
   - `0018_advance_academic_year_admin_only.sql`: 年度更新(advance_academic_year)は誤操作の影響が大きいため、指導者では実行できないようにし管理者のみに限定する(UIの「年度更新」ボタンも管理者にのみ表示)
   - `0019_invite_link_reusable.sql`: 招待リンクを、有効期限内であれば同じロール(保護者用/指導者用)の複数人が繰り返し使えるようにする(これまでは1人使うと無効になっていた)。あわせて有効期限のデフォルトを30日から3日に短縮する(今後発行する分のみ、既存の招待には影響しない)
   - `0020_report_staff_only.sql`: 練習日報の閲覧・登録を指導者・管理者のみに制限する(これまでは一般・役員も含め全ロールが閲覧・登録できた)
   - `0021_player_notes_edit_delete.sql`: 選手メモの編集・削除を指導者・管理者に許可する(これまでは登録のみ可能で、編集・削除用のポリシーが無かった)
   - `0022_game_match_result_and_photo.sql`: game_matchesに自チーム/相手チームの得点とスコア写真のパスを追加し、専用のStorageバケット(game-score-photos)を作成する。あわせてgame_recordsにDELETEポリシーが無かったため追加する(スタメン・途中出場登録の削除に必要)
   - `0023_game_match_video_url.sql`: game_matchesに振り返り用の動画URL(YouTube等)を追加する
   - `0024_schedule_game_category.sql`: schedulesに「練習試合」「公式戦」の区分(game_category)を追加する。type="game"の予定にのみ意味を持ち、それ以外はnull
   - `0025_game_matches_select_all_roles.sql`: game_matchesのSELECTを指導者・管理者限定から全ロールに広げる(一般・役員に試合結果一覧の閲覧を開放するため)。登録・編集・削除は引き続き指導者・管理者のみ
   - `0026_attendance_roster_all_roles.sql`: 出欠一覧(選手名込み)を全ロールが見られるようにする`list_roster_players()`関数(SECURITY DEFINER、選手一覧タブ本体のRLSは変更せず最小限のフィールドだけを公開)を追加。あわせてattendancesにDELETEポリシーが無く誰も出欠を削除できなかったため、UPDATEと同じ条件(管理者は全員分、本人は自分の登録分のみ)で追加する
   - `0027_notice_audience.sql`: noticesに公開範囲(audience: 全員/指導者のみ/役員以上/学年指定)とtarget_grade_minを追加し、SELECTポリシーを公開範囲に応じて絞り込むよう変更する(指導者・管理者は常に全件閲覧可)
   - `0028_schedule_delete_all_roles.sql`: schedulesのDELETEを役員以上限定から全ロールに広げる(登録・編集(schedules_insert/update)と同じ範囲に揃え、予定編集画面から削除できるようにするため)
   - `0029_report_all_roles_edit_delete.sql`: 練習日報の閲覧・登録を再び全ロールに開放する(0020を戻す)。あわせてUPDATE/DELETEポリシーが元々無かったため追加(お知らせと同じく記入者本人に限らず全ロールが編集・削除できる)
   - `0030_report_real_date.sql`: 日報の日付を年を持たない自由入力(date_label、例:「8/10」)から実際のdate型に置き換える。既存データはdate_labelの月日をcreated_atの年に当てはめて復元し(年をまたぐ場合は前年と判定)、date_label列は削除する
   - `0031_invite_officer_and_revoke.sql`: 役員に保護者用(role='一般')招待リンクの発行・閲覧を開放する(指導者用は指導者・管理者のみ、役員が指導者用リンクを使って自分を指導者登録できないようにするため)。あわせてinvitesにDELETEポリシーが無く誰も取り消せなかったため、管理者のみ取り消せるよう追加する
   - `0032_player_birthday.sql`: playersにbirthday(date、任意)を追加し、list_roster_players()の返り値にも含める(スケジュールのカレンダーで全ロールに誕生日を表示するため。選手一覧タブ本体のRLSは変更しない)
3. ダッシュボード → Project Settings → API から `Project URL` と `anon public`(または新しいPublishable key)を控える

Supabase CLIがある場合は、SQL Editorの代わりに以下でも適用できる。

```bash
supabase link --project-ref <project-ref>
supabase db push
```

### 2. 環境変数を設定する

`.env.local.example` を `.env.local` にコピーし、手順1で控えた値を設定する。

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` はProject Settings > API > service_role secretから取得する。ユーザー管理画面でのユーザー削除時にauth.usersのアカウント(メールアドレス含む)を完全に削除するために使用するサーバー専用の鍵で、`NEXT_PUBLIC_`を付けずブラウザに露出させない(`src/app/api/admin/delete-user/route.ts`でのみ使用)。Vercelにデプロイする場合もEnvironment Variablesに同名で追加すること。

### 3. 依存関係のインストールと起動

```bash
npm install
npm run dev
```

http://localhost:3000 を開くと `/login` にリダイレクトされる。「チームを作成」からチーム名と管理者情報を入力すると、そのチームの最初の管理者としてログインできる。以降のメンバーは、ユーザー管理タブから発行した招待リンク経由で自分自身のアカウントを作成する。

Supabaseプロジェクトの「Authentication > Providers」でメール確認(Confirm email)が有効な場合、新規登録後に確認メールのリンクを開くまでログインが完了しない点に注意。開発中はSupabaseダッシュボードの設定でメール確認を無効化すると動作確認しやすい。

## 権限とタブの対応

| タブ | 一般 | 役員 | 指導者 | 管理者 |
|---|---|---|---|---|
| 予定・出欠(閲覧・出欠登録) | ○ | ○ | ○ | ○ |
| 予定(登録・編集・削除) | ○ | ○ | ○ | ○ |
| 予定の出欠一覧・帯同/車出し状況を見る | ○ | ○ | ○ | ○ |
| お知らせ(閲覧) | ○ | ○ | ○ | ○ |
| お知らせ(登録・編集) | ○ | ○ | ○ | ○ |
| 練習日報(閲覧・登録・編集・削除) | ○ | ○ | ○ | ○ |
| 選手一覧(選手メモを含む) | – | – | ○ | ○ |
| 試合記録: 結果の閲覧(`/game/results`) | ○ | ○ | ○ | ○ |
| 試合記録: スタメン登録・得点入力(`/game`, `/game/[id]`) | – | – | ○ | ○ |
| ユーザー管理: 招待リンク発行(保護者用) | – | ○ | – | ○ |
| ユーザー管理: 招待リンク発行(指導者用)・取り消し・メンバーの権限/ステータス変更・削除・選手紐付け | – | – | – | ○ |
| 設定: 自分のアカウント編集(表示名・パスワード) | ○ | ○ | ○ | ○ |
| 設定: チーム設定(配色・ロゴ) | – | – | – | ○ |

画面上には権限名は表示せず、裏側の判定のみでタブ・操作を出し分けている(`src/lib/permissions.ts`)。データのアクセス制御はUI側の出し分けに加えて、Supabase側のRow Level Securityで最終的に担保している(`supabase/migrations/`)。「設定」タブは全ロールに表示されるが、中身は権限によって異なる(全員: 自分のアカウント編集のみ / 管理者: それに加えてチームのロゴ・配色設定)。他のユーザーの情報編集(表示名・権限・ステータス)は管理者向けの「ユーザー管理」タブに集約しており、管理者以外には他ユーザーの情報は一切表示されない。

例外的に、指導者・管理者しか遷移できないページ(選手一覧・OB/OG・選手メモ・試合記録の記録画面)には`AppHeader`の`accessBadge="coach"`で「コーチ専用画面」、管理者しか遷移できないページ(配色・ロゴ)には`accessBadge="admin"`で「管理者専用画面」というバッジをタイトル横に表示し、そのページが誰向けかを画面上でも分かるようにしている。選手詳細ページ(`/players/[id]`)は保護者が自分の子どもの分だけ閲覧できる例外があるためバッジは付けていないが、選手メモ(`/players/[id]/notes`)にはその例外が無い(`player_notes`は指導者・管理者しか閲覧できない)ためバッジを付けている。「ユーザー管理」は役員も一部(招待リンク発行)にアクセスできるため、専用バッジは付けていない。

## デザイン・ブランディング

- ログイン前(`/login` `/signup` `/invite/[token]`)は製品名「ClubLink」の共通ブランディングのみを表示し、特定チームの名称・配色は出さない
- ログイン後はチーム名(+ロゴ)をヘッダーに表示し、配色・ロゴはチームごとにカスタマイズ可能(`teams.theme_primary` / `theme_accent` / `logo_path`。管理者が「設定」タブから変更できる。未設定時はアプリ標準の落ち着いた配色を使う)
- 見出しフォントはCormorant(セリフ体)、本文はNoto Sans JP(Windows環境ではMeiryoを優先)、ラベル類はJetBrains Monoで、FAITH CREATIONのブランドトーンに合わせたシックな雰囲気を意図している
- `.app-shell` を画面の高さ(`100dvh`)に固定してoverflow: hiddenにし、内部のコンテンツ部分だけがスクロールする構造にしている(`src/app/globals.css`)。これによりヘッダーと下部タブバーは常に画面に固定され、スクロールしても動かない
- ホーム画面に追加した際のアイコン(PWAアイコン・favicon・apple-touch-icon)は、`get_default_team_logo_path()` RPCで取得した「最初に作られたチーム」のロゴがあればそれを、無ければClubLink共通の「CL」マークを使う(`src/lib/brandIcon.tsx`)。このアプリは本来チームIDで分離するマルチテナント構成だが、**現状は都賀ビクトリーズ1チームのみの運用と割り切っている**ため、この仕組みで問題ない。複数チームが本格的に混在する段階になったら、ホーム画面アイコンをチームごとに安全に出し分ける方式(サブドメイン分離など)へ見直す必要がある
- スケジュールのカレンダー表示(`CalendarView.tsx`)では、日付の数字の文字色で祝日(赤紫、`--holiday`)・土曜(青)・日曜(赤)を区別する。祝日判定は`@holiday-jp/holiday_jp`(2050年まで収録)を使用。マス自体の背景色は従来通り予定の種別(試合/イベント/練習)で決まるため、色のレイヤーが被らないよう文字色と背景色を別チャンネルとして使い分けている
- 選手の誕生日(`players.birthday`、任意)を登録すると、カレンダーの該当マスに🎂が表示され、その日を選択すると「選択した日の予定」欄に誕生日の選手名が出る。年をまたいで毎年表示したいので、判定は月日(MM-DD)だけを見て年は無視する(`birthdaysByMonthDay`)。全ロールが見るカレンダーに出すため、選手名は`list_roster_players()`経由で取得している(選手一覧タブ本体のRLSは変更していない)
- 日付表示は`src/lib/format.ts`の2関数を用途で使い分けている: `formatDateLabel()`(「8/10(日)」、年なしのコンパクト表示)は予定カード・試合記録一覧・お知らせの配信日・選手メモ・招待リンクの有効期限など、近い日付が前提の一覧系すべてで使う。`formatFullDateLabel()`(「2026年8月10日(日)」、年あり)は日報のように単独で読み返した時に年が分からないと困る記録でのみ使う。新しく日付を表示する画面を追加する際は、一覧・カード系はformatDateLabel、単独の記録系はformatFullDateLabelを使うこと(生の日付文字列をそのまま表示しない)

## ディレクトリ構成

```
supabase/migrations/
  0001_init.sql        スキーマ・RLS・トリガー・RPC・Storageバケット一式
  0002_team_theme.sql   チームごとの配色カスタマイズ用の列・RLS
  0003_team_logo.sql    チームロゴアップロード用の列・Storageバケット・RLS
src/
  app/
    (auth)/login, signup, setup, invite/[token]  認証フロー(ClubLinkブランディング)
    (auth)/forgot-password, reset-password       パスワード再設定(忘れた場合の復旧)
    (app)/schedule, schedule/[id], notice,        予定(一覧は要約カード→詳細で出欠登録)・お知らせ(全ロール)
          report, players, players/[id],         日報・選手一覧(選手詳細から選手メモの専用ページ players/[id]/notes に遷移)・
          players/[id]/notes,
          game, game/[id],                       試合記録(一覧は要約カード→詳細でスタメン・結果を記録、指導者以上)
          users                                  ユーザー管理(表示名・権限・ステータス編集、管理者のみ)・招待リンク発行(保護者用は役員も、指導者用と取り消しは管理者のみ)
          settings                               設定: 自分のアカウント編集(全ロール)+ チーム設定(配色・ロゴ、管理者のみ)
    auth/confirm, auth/complete                  メール確認リンクのコールバック
    api/admin/delete-user                        ユーザー削除API(service_roleキーでauth.usersごと削除、サーバー専用)
    icon.tsx, apple-icon.tsx, manifest.ts, icons/ PWAアイコン・マニフェスト(ClubLink共通)
  components/        AppHeader・TabBar・Card・Modal等の共通UI
  lib/
    supabase/client.ts, server.ts   ブラウザ/サーバー用Supabaseクライアント
    permissions.ts                  ロール→タブ・操作の可否(単一のソース)
    database.types.ts               Supabaseスキーマに対応する型定義
    teamLogo.ts                     チームロゴの公開URLを組み立てるヘルパー
```

## お知らせの公開範囲

- お知らせ(`notices`)には公開範囲(`audience`: 全員/指導者のみ/役員以上/学年指定)を設定できる。指導者・管理者はチーム運営を見渡す立場のため、公開範囲に関わらず常にすべてのお知らせを閲覧できる(RLSで`current_role() in ('指導者','管理者')`を最優先の条件にしている)
- 「学年指定」の場合は`target_grade_min`(○年生以上)も必須で、閲覧できるのは対象学年の選手に紐付いた保護者(`player_guardians`、在籍中の選手のみ対象)。OB・OGの保護者は学年指定の対象にならない
- 公開範囲を絞ったお知らせは、一覧・詳細画面にバッジで表示する(「全員」の場合はバッジを出さない)
- 誰が投稿できるか(`canWriteNotice`)は従来通り全ロールのままで、公開範囲の指定はあくまで「誰が読めるか」を絞るためのもの

## 選手の学年・OB・OG

- `players.grade` は在籍中は"0"(未就学)〜"6"だが、6年生が年度更新でOB・OGになった後も、年度更新のたびに増え続ける("卒団時の学年(6) + 卒団してからの年度更新回数")。画面上は「7年生」のようには出さず、`obogCohortLabel()`(`src/lib/format.ts`)で「卒団1年目」のような経過年数表示に変換する
- 「選手」タブの一覧にはOB・OGを表示せず、件数だけのリンクから `/players/obog` に遷移する専用画面(卒団年次ごとにセクション分け)で確認する仕組みにしている(卒団者が増えても一覧が際限なく伸びないようにするため)
- 年度更新(「年度更新」ボタン、`advance_academic_year()` RPC)は全選手の学年を一括で書き換える不可逆性の高い操作のため、指導者ではなく管理者のみが実行できる(UI・RPCの両方で制限)

## 出欠と選手⇔保護者の紐付け

- 一般・役員は基本的に保護者アカウントであり、指導者も保護者を兼ねることがあるため、出欠(attendances)は「ログインアカウント」単位ではなく、`player_guardians`(選手⇔保護者アカウントの多対多)で紐付けられた「選手」単位・「指導者本人」単位で記録する
- 紐付けは管理者が「ユーザー管理」タブの各ユーザー欄から選手を選んで設定する(選手の編集画面側からではない)
- 予定詳細画面では、ログインユーザーに紐付いている選手ごとに出欠フォームが表示される(兄弟がいれば複数)。指導者・管理者は追加で「本人」の出欠も登録できる。まだ選手と紐付いていないアカウントは、従来通り自分のアカウント名で1つだけ出欠フォームが表示される(移行期間の保険)
- 予定詳細画面の上部に前後の予定へ移動する‹ ›ボタンがある。種別を問わず全予定を`(date, created_at)`の昇順で並べた前後1件に移動する(同日に複数の予定がある場合はcreated_atで安定的に順序を決める)。最初/最後の予定では該当側のボタンが淡色表示になり押せない
- 出欠一覧(全ロールが見られる集計画面)は「選手」「指導者」「未紐付けの保護者」に分けて表示する。選手名の表示には`list_roster_players()`(SECURITY DEFINER)を使い、選手一覧タブ本体のRLS(指導者・管理者限定)は変更せず出欠一覧に必要な最小限のフィールドだけを全ロールに公開している
- 出欠一覧の各行は、自分が編集できる対象(紐付けられた自分の子ども・指導者/管理者本人の記録・自分が登録した未紐付けアカウントの記録、管理者は全件)であればタップで展開し、その場で編集・削除できる(`AttendanceRosterModal`)。編集できない他人の記録はタップしても反応しない
- 予定には「対象」(全員 / ○年生以上、`schedules.target_grade_min`)を設定でき、対象外の学年の選手は出欠登録フォーム・出欠一覧の両方から除外される(`src/lib/format.ts`の`isTargetEligible()`が判定基準の単一のソース)
- 管理者は「選手の出欠を代理登録」欄から、紐付けの有無に関わらず全選手の出欠を代理で登録・編集できる(`attendances_insert`/`attendances_update`ポリシーで管理者を例外化)
- 管理者は「未紐付けの保護者の出欠を修正・削除」欄から、選手と紐付いていない一般・役員アカウント(`player_guardians`に紐付けが無いアカウント)を選んで、その人の出欠を代理登録・修正・削除できる。削除は管理者の代理操作向けに追加した機能で、通常の出欠フォームには表示されない(`AttendanceEntryForm`の`allowDelete`)

## 試合記録

- `/game`は試合(schedules.type='game')の一覧をカード表示するだけの画面で、カードをタップすると`/game/[id]`(該当の試合の詳細)に遷移する(予定・お知らせと同じ「一覧→詳細」の構成)
- クォーターごとのスタメン・途中出場は、一度登録すると選手を選ぶチェックボックス一覧の代わりに登録済みメンバーの要約が表示される。要約をタップすると「編集」(チェックボックス一覧に戻って選び直す)・「削除」(そのクォーターの登録を削除する)ボタンが出る
- 試合(`game_matches`)には対戦相手に加えて自チーム/相手チームの得点を記録できる。勝敗は得点から自動判定して表示するため、専用の列は持たない
- スコア写真の添付機能は`game_matches.score_photo_path`列とStorageバケット`game-score-photos`をDB側に用意済みだが、PostgRESTのスキーマキャッシュが更新されない問題が未解決のためUIからは一旦外している(再度組み込む際はそのまま使える)
- `/game/results`(試合結果一覧)は得点が入力済みの全試合を日付降順で一覧表示し、勝敗数・勝率を自動集計する画面。もともとGoogleスプレッドシートで管理していた対戦戦績表をアプリ内に置き換える目的で追加した。各試合の`opponent`(対戦相手)・`team_score`/`opponent_score`(得点)・`video_url`(振り返り用動画リンク、YouTube等)を一覧表示する
- 試合(予定)は「練習試合」「公式戦」の区分(`schedules.game_category`)を持つ。区分は予定登録時に種別で「試合」を選ぶと選択できる、予定そのものの属性として一元管理しており(試合ごとに二重に持たせていない)、`/game`・`/game/results`の両方でこの区分によるタブ絞り込みができる。カレンダー・予定一覧の種別タグにも「練習試合」「公式戦」がそのまま表示される(未設定の場合は「試合」)
- `/game/results`は試合日から算出した4月始まりの年度(`fiscalYearOf`、`src/lib/format.ts`)でも絞り込める。選手の「年度更新」のような更新操作は不要で、試合日から都度自動的に年度を判定する。年度タブは実際にデータが存在する年度のみを新しい順に表示し、初期表示は最新年度を選択した状態になる
- 「試合記録」タブは一般・役員にも表示するが、タップした先は`/game/results`(結果閲覧のみ)に固定している。スタメン登録・得点入力ができる`/game`・`/game/[id]`は指導者・管理者のみが遷移できるルートで、タブのリンク先自体をロールごとに出し分けている(`tabHrefForRole`、`src/lib/permissions.ts`)。一般・役員が直接URLを叩いた場合もページ側のガードで`/game/results`に戻す。DB側もあわせて、`game_matches`のSELECTのみ全ロールに開放し(`0025_game_matches_select_all_roles.sql`)、登録・編集・削除とスタメン(`game_records`)は引き続き指導者・管理者限定のまま

## 既知の制約・今後の課題

- 複数チーム所属ユーザーへの対応(チーム選択画面)は未実装
- 料金プラン・課金機能は未実装
- このリポジトリの開発環境にはDockerが無くローカルSupabaseスタックを起動できないため、実データベースに対する動作確認は行っていない。上記セットアップ手順に沿って実際のSupabaseプロジェクトに接続した上で、一連の操作(チーム作成→招待→出欠登録→お知らせ添付→選手登録→試合記録→ユーザー管理→配色・ロゴ設定)を確認すること
