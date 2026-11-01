# CIRCLE LINES UI/UX刷新 進捗台帳

状態: 未着手 / 実装中 / PRレビュー待ち / マージ・本番反映済み / 保留

この台帳はPhase単位で差分更新する。完了済み(マージ・本番反映済み)の画面は、
明確な不具合や新しいPhaseでの依存関係がない限り再着手しない。
唯一の進捗管理ファイルとして扱い、重複する新規の管理ファイルは作らない。

最終更新: 2026-11-01(PR #215: スケジュール一覧・カレンダー表示の統一、
マージ・本番反映済み)。
以降の「確認方法」に記載のない数値は、過去のPR本文(#209時点の調査等)からの
引用であり、本更新時点で再調査していない。再調査した項目には明記している。

## 完了済み(マージ・本番反映済み)

- ホーム
- 投票一覧・詳細(#205)
- お知らせ一覧・詳細(#207)
- チーム日報一覧・詳細(#208)
- コーチ日報一覧・詳細(#209)
- ユーザー(#211で見出し文言のみ追加修正)
- チーム
- ゲーム
- 設定トップ(`settings/page.tsx`、cardClass使用を本更新時点で再確認済み)
- スケジュール詳細(#206, #211, #212, #214)
  - 残課題: `AttendanceEntryForm.tsx`内の出欠入力フォーム本体が旧`<Card>`の
    ままで、cardClassへ未移行(本更新時点でgrep確認済み、1箇所)。
    スケジュール詳細自体は主要なカード・操作ボタン・編集ボタンの共通化が
    完了しているため「完了済み」に区分するが、この1点は後述の残作業
    バッチAで扱う。
- スケジュール履歴(`schedule/history/page.tsx`、旧Card不使用を再確認済み)
- スタッツ入力画面(Phase 1、#210)
- 共通下部ナビ・ハンバーガー導線・旧Sidebar廃止(Phase 3、#213, #214)
  - `NavDrawer.tsx`のメニュー項目(チーム内メニュー等)はカード形式ではなく
    区切り線のみのメニューリスト形式のため、そもそも旧`<Card>`を使用して
    いない(本更新時点で確認済み)。cardClass移行の対象外として「完了」に
    含める。
- スケジュール一覧・カレンダー表示(Phase 2、#215) — 詳細は下記

保留(診断専用、対象外): PR #198(Safari入力クラッシュ診断) /
PR #199(下部表示実測)

## 今回のバッチ: スケジュール一覧・カレンダー表示(Phase 2、マージ・本番反映済み)

対象ファイル: `src/app/(app)/schedule/page.tsx`、`CalendarView.tsx`、
`ScheduleCard.tsx`(変更なし、既にcardClass移行済みのため再利用)。

- `CalendarView.tsx`: 月切替・曜日見出し・日付グリッドを、ホーム画面の
  `homeCardClass`と同系(`bg-card`/`border-border-subtle`/`rounded-card`/
  `shadow-card`)のローカルな`calendarCardClass`で包んだ。日付グリッド自体の
  内側の枠線・角丸(`rounded-lg`)はグリッドの区切りとして維持。
- 「選択した日の予定」のカードを、独自の`<Card>`手書き実装から
  `ScheduleCard`(予定一覧表示で使用中の共通コンポーネント)の再利用に変更。
  表示情報(種別タグ・日時/場所・当番・出欠Pill・遷移先)が一覧表示と完全に
  一致するようになった。このため`page.tsx`から`attendances`を
  `CalendarView`へ新たに渡すようにした(取得・集計ロジック自体は無変更)。
- 誕生日表示(予定ではないためScheduleCardを再利用できない)は旧`<Card>`から
  共通`cardClass`に変更。
- 月切替ボタンの見た目(`rounded-lg`等)は他画面の小型アイコンボタンと既に
  同系であることを確認し、変更していない(既に共通デザインと整合)。
- 維持した既存機能: 予定種別カラーの優先度ロジック、祝日・土日の色分け
  (`holiday_jp`)、誕生日表示、日付選択・選択解除、月切替、予定詳細への
  遷移。ロジック自体のコードは変更していない。

## Phase別進捗

| Phase | 内容 | 状態 | PR |
| --- | --- | --- | --- |
| 1 | スタッツ入力画面 | 完了 | #210 |
| 2 | スケジュール一覧・カレンダー表示 | 完了 | #215 |
| 3 | 下部5タブ・チーム内メニュー・ハンバーガーメニュー | 完了 | #213, #214 |
| 4 | スタッツ閲覧画面(`/game/stats/[matchId]/view`) | 未着手 | — |
| 5 | 資料室詳細・設定配下の未刷新画面 | 未着手 | — |
| 6 | 選手・カルテ・会計関連の未刷新画面 | 未着手 | — |
| 7 | その他の低優先度画面((auth)配下・公開静的ページ等) | 未着手(未調査) | — |

## 根拠データ(本更新時点で再調査済み)

- `src/app/(app)`配下の`page.tsx`: 77ファイル
- 旧`<Card>`をimportしているファイル(`(app)`配下、ページ・コンポーネント
  含む): 58ファイル
- `cardClass`を使用しているファイル(同上): 18ファイル
- `src/app/(app)/game/stats/[matchId]/view/page.tsx`: 旧`<Card>`を1箇所使用
  (未刷新、Phase 4の対象)
- `src/app/(app)/library/[id]/page.tsx`: 旧`<Card>`を3箇所使用
  (未刷新、#209時点の調査と一致)
- `src/app/(app)/settings`配下: 旧`<Card>`使用が13ファイル
  (`name`/`category`/`logo`/`team`/`close-account`/`plan`/`export`/
  `leave-service`/`audit-log`/`storage`/`color`/`password`/
  `teams/new/NewTeamForm`)、`cardClass`使用は`page.tsx`(トップ)のみ
- `src/app/(app)/karte`配下: 旧`<Card>`使用が19ファイル
- `src/app/(app)/accounting`配下: 旧`<Card>`使用が10ファイル
- `src/app/(app)/players`配下: 旧`<Card>`使用が6ファイル

上記のファイル数は「`<Card>`をimportしているか」の機械的なgrep結果であり、
1ファイル内の複数カード箇所や、import無しで独自に旧スタイルを直接記述している
箇所までは数えていない。したがって「進捗率」として画面数のみから厳密な
パーセンテージを出すのは避け、残作業バッチの対象ファイルを明示する形で
管理する((auth)配下・公開静的ページ等のPhase 7は今回未調査のため件数不明)。

## 残作業バッチ(実装可能な単位)

### バッチA: スケジュール詳細の残課題(小規模)

- 対象ファイル: `src/app/(app)/schedule/AttendanceEntryForm.tsx`
- 完了条件: 出欠入力フォーム本体の旧`<Card>`を`cardClass`へ移行。
  出欠登録・編集・削除のロジック、権限判定は変更しない。

### バッチB: スタッツ閲覧画面(Phase 4)

- 対象ファイル: `src/app/(app)/game/stats/[matchId]/view/page.tsx`
- 完了条件: 旧`<Card>`(1箇所)を`cardClass`へ移行。閲覧専用の集計・
  表示ロジックは変更しない。

### バッチC: 資料室詳細(Phase 5の一部)

- 対象ファイル: `src/app/(app)/library/[id]/page.tsx`
- 完了条件: 旧`<Card>`(3箇所)を`cardClass`へ移行。添付・閲覧ロジックは
  変更しない。

### バッチD: 設定配下13画面(Phase 5の一部)

- 対象ファイル: `src/app/(app)/settings/{name,category,logo,team,
  close-account,plan,export,leave-service,audit-log,storage,color,
  password}/page.tsx`、`src/app/(app)/settings/teams/new/NewTeamForm.tsx`
- 完了条件: 各画面の旧`<Card>`を`cardClass`へ移行し、操作ボタンの
  タップ領域(`min-h-tap`)を確認・統一する。設定値の保存・権限判定は
  変更しない。低頻度画面のため優先度は中〜低。

### バッチE: 選手・カルテ・会計関連(Phase 6、大規模)

- 対象ファイル: `src/app/(app)/karte`配下(旧Card使用19ファイル)、
  `src/app/(app)/accounting`配下(10ファイル)、`src/app/(app)/players`配下
  (6ファイル)。合計35ファイル。
- 完了条件: 画面数が多いため、さらに機能群(カルテ/会計/選手)単位で
  複数バッチへ分割して実施する。各バッチで旧`<Card>`を`cardClass`へ移行し、
  記録・集計ロジック・権限判定は変更しない。

### バッチF: その他低優先度画面(Phase 7、未調査)

- 対象: `(auth)`配下(ログイン・登録等)・公開静的ページ等。
- 今回は対象ファイル・件数を調査していない。着手前に現状調査から行う。
