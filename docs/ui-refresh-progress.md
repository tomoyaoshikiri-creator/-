# CIRCLE LINES UI/UX刷新 進捗台帳

状態: 未着手 / 実装中 / PRレビュー待ち / マージ・本番反映済み / 保留

この台帳はPhase単位で差分更新する。完了済み(マージ・本番反映済み)の画面は、
明確な不具合や新しいPhaseでの依存関係がない限り再着手しない。
唯一の進捗管理ファイルとして扱い、重複する新規の管理ファイルは作らない。

最終更新: 2026-11-02(本PR: バッチE-3〈会計(accounting)配下10画面の
旧Card移行〉、PRレビュー待ち・マージ前)。
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
  - 残課題だった`AttendanceEntryForm.tsx`内の出欠入力フォーム本体の旧`<Card>`
    (1箇所)は、#217でcardClassへ移行済み・マージ・本番反映済み。
- スケジュール履歴(`schedule/history/page.tsx`、旧Card不使用を再確認済み)
- スタッツ入力画面(Phase 1、#210)
- 共通下部ナビ・ハンバーガー導線・旧Sidebar廃止(Phase 3、#213, #214)
  - `NavDrawer.tsx`のメニュー項目(チーム内メニュー等)はカード形式ではなく
    区切り線のみのメニューリスト形式のため、そもそも旧`<Card>`を使用して
    いない(本更新時点で確認済み)。cardClass移行の対象外として「完了」に
    含める。
- スケジュール一覧・カレンダー表示(Phase 2、#215)
- バッチA〜C(出欠入力フォーム・スタッツ閲覧画面・資料室詳細の旧Card移行、
  #217) — マージ・本番反映済み。詳細は下記(Phase 2参考セクションに続けて記載)
- バッチD(設定配下13画面の旧Card移行、#218) — マージ・本番反映済み。
  詳細は下記(バッチA〜C参考セクションに続けて記載)
- バッチE-1(選手管理(players)配下6画面の旧Card移行、#219) — マージ・
  本番反映済み。詳細は下記(バッチD参考セクションに続けて記載)
- バッチE-2a(カルテ(karte/players)配下5画面の旧Card移行、#220) — マージ・
  本番反映済み。詳細は下記(バッチE-1参考セクションに続けて記載)
- バッチE-2b(カルテ(karte/team)配下14画面の旧Card移行、#221) — マージ・
  本番反映済み。詳細は下記(バッチE-2a参考セクションに続けて記載)
- バッチE-2(カルテ全体、karte配下19ファイル・合計60箇所)— E-2a(#220)・
  E-2b(#221)の両方がマージ・本番反映済みとなったため、karte配下の旧Card
  移行として完了。

保留(診断専用、対象外): PR #198(Safari入力クラッシュ診断) /
PR #199(下部表示実測)

## PRレビュー待ち

- バッチE-3(会計(accounting)配下10画面、本PR、マージ前) — 詳細は下記

## 今回のバッチ: バッチE-3(会計(accounting)配下10画面)

対象ファイル(いずれも`src/app/(app)/accounting/`配下、旧Card使用10ファイル):
- `budget/page.tsx`(予算案、旧Card 2箇所)
- `categories/page.tsx`(項目の管理、旧Card 1箇所)
- `dues/[id]/checklist/page.tsx`(入金チェック、旧Card 4箇所)
- `dues/[id]/page.tsx`(集金項目詳細、旧Card 10箇所)
- `dues/page.tsx`(集金項目一覧、旧Card 2箇所)
- `dues/unpaid/page.tsx`(未納一覧、旧Card 2箇所)
- `officers/page.tsx`(会計担当・会計監査、旧Card 1箇所)
- `page.tsx`(会計ハブ トップ、旧Card 7箇所)
- `report/page.tsx`(会計報告、旧Card 1箇所)
- `transactions/page.tsx`(入出金、旧Card 3箇所)

accounting配下のファイルはすべて旧Cardを使用しており、対象外ファイルはない。

統一した内容:
- カード: 全10ファイルの旧`<Card>`(合計33箇所)を共通`cardClass`へ移行した。
  (budget 2、categories 1、dues/[id]/checklist 4、dues/[id] 10、dues 2、
  dues/unpaid 2、officers 1、page 7、report 1、transactions 3)
- key/className/onClick等のpropsを個別に持つCard(会計ハブ トップの各機能
  への遷移カード7箇所、集金項目一覧・集金項目詳細の入金チェックへの遷移
  カード、未納一覧のグループ別カード、入出金のスクロール可能カード)は、
  既存のkey・className・onClickの付与を保持したまま
  `<div key={...} className={`${cardClass} ...`}>`の形で移行した。
- 見出し・入力欄・ボタン(`SectionLabel`/`FieldLabel`/`inputClass`/
  `SubmitButton`/`SegButton`/`InlineSelect`/`Fab`/`Modal`/`Switch`)は、
  10ファイルすべてで移行前から既に共通コンポーネントを使用していることを
  確認済み。追加の変更は行っていない。

変更不要と判断した部品(既存の共通デザインと整合しているため、独自の新規
デザイン規則化を避けて変更していない):
- `dues/[id]/page.tsx`・`budget/page.tsx`・`transactions/page.tsx`等の
  「編集する」全幅オレンジ枠ボタンは、バッチD・E-1・E-2で確認済みの既存
  パターンと同じ実装のため変更していない。
- `dues/[id]/page.tsx`・`leave-service`等の削除系ボタン(インラインstyleの
  `var(--danger-text)`/`var(--danger)`使用)は、既存の危険操作表示と視覚的に
  同じ色であり、バッチE-1・E-2で確認済みのパターンと同様のため変更していない。
- `report/page.tsx`の会計報告・予算案の出力画面(`印刷・PDF保存`後に表示
  される表組み・承認印欄)は、会計特有の金額表・印刷レイアウトであり、
  機能と情報密度を維持するため共通カードへの統合や構造変更を行っていない
  (印刷前の設定部分の`Card`のみをcardClassへ移行)。
- `dues/[id]/page.tsx`の学年帯・選手ごとの個別設定の入力行(金額・免除・
  開始/停止月・備考)は、会計特有の複雑な入力フォームであり、画面固有の
  入力フォームを無理に共通部品へ置き換えない方針に基づき構造を変更して
  いない(`inputClass()`は既存のまま使用)。
- `categories/page.tsx`のドラッグ&ドロップ並び替え行(`@dnd-kit`使用)は、
  会計特有の機能であり、無関係なリファクタリングを避けるため変更していない。

維持した既存機能・権限: 請求・入金・支出などの会計処理、金額計算・残高・
集計・年度管理、会計データの登録・編集・削除、CSV出力・履歴表示、権限判定・
プラン制限(`canManageAccounting`/`hasAccountingAccess`等)は変更していない。
DB・RLS・認証、players・karte・settings配下の画面も変更していない。
金額計算・保存処理・権限制御のロジック自体のコードは一切変更していない
(カードのラッパー要素をCard→cardClassに置き換えたのみで、内部のデータ
取得・計算・更新処理は手を加えていない)。

## 今回のバッチ(参考・マージ済み): バッチE-2b(カルテ(karte/team)配下14画面)

対象ファイル(いずれも`src/app/(app)/karte/team/`配下、旧Card使用14ファイル):
- `analysis/page.tsx`(チーム分析、旧Card 5箇所)
- `attendance-report/page.tsx`(出欠集計、旧Card 2箇所)
- `custom-stats/page.tsx`(カスタムスタッツ、旧Card 1箇所)
- `game/page.tsx`(試合スタッツ、旧Card 1箇所)
- `goal/page.tsx`(チーム目標、旧Card 1箇所)
- `notes/[noteId]/page.tsx`(AI分析メモ詳細、旧Card 1箇所)
- `page.tsx`(チームカルテ トップ、旧Card 5箇所)
- `shooting/new/page.tsx`(コービーシューティング計測、旧Card 3箇所)
- `shooting/page.tsx`(コービーシューティング一覧、旧Card 2箇所)
- `skill-tests/[id]/page.tsx`(検定詳細、旧Card 4箇所)
- `skill-tests/page.tsx`(検定一覧、旧Card 2箇所)
- `sports-test/page.tsx`(チームスポーツテスト、旧Card 1箇所)
- `workout/page.tsx`(ワークアウトハブ、旧Card 3箇所)
- `workout/shaving/page.tsx`(シェービングドリル、旧Card 2箇所)

同じkarte/team配下の`workout/menu/page.tsx`は、そもそも旧Card・cardClassの
いずれも使用していない(本更新時点で確認済み)ため変更していない。

統一した内容:
- カード: 全14ファイルの旧`<Card>`(合計33箇所)を共通`cardClass`へ移行した。
  (analysis 5、attendance-report 2、custom-stats 1、game 1、goal 1、
  notes/[noteId] 1、page 5、shooting/new 3、shooting 2、skill-tests/[id] 4、
  skill-tests 2、sports-test 1、workout 3、workout/shaving 2)
- key/className/onClick等のpropsを個別に持つCard(チーム分析のAI分析カード・
  スタッフコメントカードの編集/表示切り替え、チームカルテ トップの各機能への
  遷移カード5箇所、検定一覧の検定詳細への遷移カード、コービーシューティング
  計測の手入力フォームカード、出欠集計の表カード、検定詳細の申請状況・承認
  キューカード、シューティング/シェービング一覧のスクロール可能カード)は、
  既存のkey・className・onClickの付与を保持したまま
  `<div key={...} className={`${cardClass} ...`}>`の形で移行した。
- 見出し・入力欄・ボタン(`SectionLabel`/`FieldLabel`/`inputClass`/
  `SubmitButton`/`SegButton`/`InlineSelect`/`Fab`/`Modal`/`Pill`)は、
  14ファイルすべてで移行前から既に共通コンポーネントを使用していることを
  確認済み。追加の変更は行っていない。

変更不要と判断した部品(既存の共通デザインと整合しているため、独自の新規
デザイン規則化を避けて変更していない):
- `analysis/page.tsx`の削除・保存・キャンセル系の小型ボタンは、バッチE-1・
  E-2aで確認済みの既存の危険操作表示と同じパターンのため変更していない。
- `shooting/new/page.tsx`の計測画面のIN/OUTボタン(`py-8`の大型ボタン)は、
  計測時にとっさにタップする操作性を優先した意図的な大型表示であり、通常の
  操作ボタンとは役割が異なるため変更していない(タップ領域44pxの基準を
  下回る心配がないケースであり、縮小の指示でもない)。
- `game/page.tsx`・`sports-test/page.tsx`の「ランキングで見る」トグルボタン
  (`px-5 py-2`)は、既存の役割に応じたコンパクトな外観であり、画面内で
  一貫して使われているため変更していない。
- `attendance-report/page.tsx`・`skill-tests/[id]/page.tsx`の「CSV出力」
  ボタン(`SectionLabel`のaction枠)は、バッチD(audit-log)で確認済みの
  既存パターンと同じ実装のため変更していない。
- `skill-tests/[id]/page.tsx`の「設定を編集」「ランクを申請」等のテキスト
  リンク型ボタン(下線付き)は、検定詳細画面固有の軽量な操作として既存の
  まま使われており、画面固有のグラフ・表・入力フォームを無理に共通部品へ
  置き換えない方針に基づき変更していない。

維持した既存機能・権限: チーム分析・出欠分析・カスタムスタッツ、試合記録・
目標管理、シューティング・スキルテスト・スポーツテスト、練習記録・シェービング
記録、AI分析メモ・履歴、データ取得・保存・集計・権限判定(`canViewKarte`/
`canManagePlayers`/`canRecordShootingDrill`/`canRecordShavingDrill`/
`canViewAttendanceReport`等のロール判定、各種プラン判定)は変更していない。
DB・RLS・認証、選手個別カルテ・選手管理・会計画面も変更していない。

## 今回のバッチ(参考・マージ済み): バッチE-2a(カルテ(karte/players)配下5画面)

対象ファイル(いずれも`src/app/(app)/karte/players/`配下、旧Card使用5ファイル):
- `[playerId]/analysis/page.tsx`(選手分析、旧Card 5箇所)
- `[playerId]/notes/[noteId]/page.tsx`(AI分析メモ詳細、旧Card 1箇所)
- `[playerId]/page.tsx`(個別カルテ、旧Card 13箇所)
- `bulk-import/page.tsx`(CSV一括登録、旧Card 6箇所)
- `page.tsx`(選手一覧、旧Card 2箇所)

機能単位の分類: 本バッチは「選手個別のカルテ・分析・一覧」に対応する
karte/players配下(旧Card使用5ファイル)を対象とした。同じkarte配下の
team(チーム単位のカルテ・分析・目標・練習記録等、旧Card使用14ファイル)は
依存関係・変更規模の観点から別バッチ(バッチE-2b、未着手)として分割する。

統一した内容:
- カード: 全5ファイルの旧`<Card>`(合計27箇所)を共通`cardClass`へ移行した。
  (analysis 5、notes/[noteId] 1、[playerId] 13、bulk-import 6、page 2)
- key/className/onClick等のpropsを個別に持つCard(選手分析のAI分析カード・
  スタッフコメントカードの編集/表示切り替え、個別カルテの集金・選手メモ・
  選手分析への遷移カード、選手一覧のOB・OG遷移カード、CSV一括登録のエラー
  一覧カード)は、`<div key={...} className={`${cardClass} ...`} onClick={...}>`
  の形でそれぞれ移行し、既存のkey・className・onClickの付与を保持した。
- 見出し・入力欄・ボタン(`SectionLabel`/`FieldLabel`/`inputClass`/
  `SubmitButton`/`SegButton`/`InlineSelect`/`TextTab`/`Switch`/
  `KartePlayerRow`/`SkillTestPanel`/`LineTrendChart`)は、5ファイルすべてで
  移行前から既に共通コンポーネントを使用していることを確認済み。追加の変更は
  行っていない。

変更不要と判断した部品(既存の共通デザインと整合しているため、独自の新規
デザイン規則化を避けて変更していない):
- `[playerId]/page.tsx`の前後選手ナビ(30×30pxの固定サイズ`<Link>`): バッチ
  E-1(players/[id]/notes)で確認済みと同じ理由で、本バッチの依頼範囲はカード
  の統一であり、タップ領域拡張は明示的な依頼事項ではないため変更していない。
- `[playerId]/page.tsx`・`analysis/page.tsx`の削除・保存・キャンセル系の
  小型ボタン(`border-danger`/`text-danger-text`/`bg-danger/8`等、または
  インラインstyleの`var(--danger-text)`/`var(--danger)`使用): いずれも既存の
  危険操作表示と視覚的に同じ色であり、バッチE-1で確認済みのパターンと同様の
  ため変更していない。
- `[playerId]/page.tsx`の「編集する」ボタン(`SectionLabel`のaction枠、
  `rounded-full`・小型ピル)は、スケジュール関連の`EditButton`と役割・外観が
  近いが、`SectionLabel`のaction内に収まる既存の専用実装であり、カードの
  統一範囲を超える変更になるため変更していない。
- `bulk-import/page.tsx`のテンプレートダウンロード・CSVアップロードの
  全幅ボタン(`border-line`/`border-orange`の組み合わせ)は、既存の設定配下の
  パターンと同系の配色のため変更していない。
- `[playerId]/page.tsx`のスポーツテスト年度セレクトの素のHTML`<select>`
  (`appearance-none bg-white border border-line rounded-lg`)は、同画面の
  表/グラフ切替用の小型セレクトとして独立した実装になっており、`inputClass()`
  (フォーム全幅入力用)への転用は見た目のサイズ・用途が異なるため変更していない。

維持した既存機能・権限: カルテの記録・編集・削除、選手ごとの情報取得・表示、
評価・集計・グラフ・履歴表示、保存・入力チェック、権限判定・閲覧範囲
(`canViewKarte`/`canManagePlayers`/`hasKarteTabAccess`等のプラン・ロール
判定、保護者の`player_guardians`による閲覧制限)は変更していない。DB・RLS・
認証、players・accounting配下の画面も変更していない。

## 今回のバッチ(参考・マージ済み): バッチE-1(選手管理(players)配下6画面)

対象ファイル(いずれも`src/app/(app)/players/`配下、旧Card使用6ファイル):
- `[id]/dues/page.tsx`(集金状況、旧Card 2箇所)
- `[id]/growth/page.tsx`(身長・体重、旧Card 2箇所)
- `[id]/notes/page.tsx`(選手メモ、旧Card 3箇所)
- `[id]/sports-test/page.tsx`(スポーツテスト、旧Card 8箇所)
- `[id]/stats/page.tsx`(スタッツ、旧Card 4箇所)
- `obog/page.tsx`(OB・OG、旧Card 1箇所)

同じplayers配下の`BirthdaySelect.tsx`・`NewPlayerModal.tsx`・`[id]/page.tsx`・
`page.tsx`は、そもそも旧Card・cardClassのいずれも使用していない(本更新時点で
確認済み)ため変更していない。

統一した内容:
- カード: 全6ファイルの旧`<Card>`(合計20箇所)を共通`cardClass`へ移行した。
  (dues 2、growth 2、notes 3、sports-test 8、stats 4、obog 1)
- `notes/page.tsx`のみ、編集中カード(`<Card key={n.id}>`)と表示中カード
  (`<Card key={n.id} className="cursor-pointer" onClick={...}>`)がkey/
  className/onClickを個別に持っていたため、`<div key={n.id} className={cardClass}>`・
  `<div key={n.id} className={`${cardClass} cursor-pointer`} onClick={...}>`の
  形でそれぞれ移行し、既存のonClick・className付与を保持した。
- 見出し・入力欄・ボタン(`SectionLabel`/`FieldLabel`/`inputClass`/
  `SubmitButton`/`SegButton`/`InlineSelect`/`PlayerRow`)は、6ファイルすべてで
  移行前から既に共通コンポーネントを使用していることを確認済み。追加の変更は
  行っていない。

変更不要と判断した部品(既存の共通デザインと整合しているため、独自の新規
デザイン規則化を避けて変更していない):
- `notes/page.tsx`の前後選手ナビ(30×30pxの固定サイズ`<Link>`): カレンダー
  画面の月切替ボタンと似た見た目だが、本バッチの依頼範囲はカードの統一であり
  タップ領域拡張は明示的な依頼事項ではないため、既存の配置・サイズのまま変更
  していない。
- `growth/page.tsx`・`notes/page.tsx`の削除・保存・キャンセル系の小型ボタン
  (`border-danger`/`text-danger-text`/`bg-danger/8`等のTailwindテーマクラス
  使用): `--danger`系の配色トークンを介した既存の危険操作表示と視覚的に同じ
  色であり、settings配下で使われているインラインstyle版と見た目は同一のため
  変更していない。
- `sports-test/page.tsx`の`SegButton`(入力/表で見る、年度、四半期、実施状況)
  は既存の共通コンポーネントをそのまま使用しているため変更不要。
- `obog/page.tsx`の`InlineSelect`(卒業年度選択)・`PlayerRow`(選手一覧行)も
  既存の共通コンポーネントをそのまま使用しているため変更不要。

維持した既存機能・権限: 選手情報の登録・編集・削除、成長記録・スポーツテスト・
スタッツの取得と表示、選手の権限・閲覧範囲(`player_guardians`による保護者の
閲覧制限、`canManagePlayers`等のロール判定)、データ取得・保存・集計ロジックは
変更していない。DB・RLS・認証、karte(カルテ)・accounting(会計)配下の画面も
変更していない。

## 今回のバッチ(参考・マージ済み): バッチD(設定配下13画面)

対象ファイル(13画面、いずれも`src/app/(app)/settings/`配下):
`name/page.tsx`、`category/page.tsx`、`logo/page.tsx`、`team/page.tsx`、
`close-account/page.tsx`、`plan/page.tsx`、`export/page.tsx`、
`leave-service/page.tsx`、`audit-log/page.tsx`、`storage/page.tsx`、
`color/page.tsx`、`password/page.tsx`、`teams/new/NewTeamForm.tsx`。
設定トップ(`settings/page.tsx`)は刷新済みのため変更していない。

統一した内容:
- カード: 全13ファイルの旧`<Card>`(合計22箇所)を共通`cardClass`へ移行した。
  (name 1、category 1、logo 2、team 3、close-account 2、plan 1、export 1、
  leave-service 3、audit-log 3、storage 1、color 1、password 1、
  NewTeamForm 2)
- 見出し・入力欄・操作ボタン(`SectionLabel`/`inputClass`/`FieldLabel`/
  `SubmitButton`)は、13ファイルすべてで移行前から既に共通コンポーネントを
  使用していることを確認済み。追加の変更は行っていない。

変更不要と判断した部品(既存の共通デザインと整合しているため、独自の新規
デザイン規則化を避けて変更していない):
- `category/page.tsx`・`logo/page.tsx`(チーム名セクション)・
  `color/page.tsx`の「〜を編集する」全幅オレンジ枠ボタン: 3画面で見た目が
  完全に一致しており、既に内部で整合している。タップ領域44pxの基準を
  ボタン外観の一律拡大や横幅いっぱい化の指示とは解釈していない。
- `export/page.tsx`のエクスポート行(手書きの`<a>`): ラベル・説明・CSVリンクの
  3要素構成が`SettingsRow`のAPI(href/label/value)と完全には一致せず、
  無理に転用すると見た目・挙動が変わる可能性があるため変更していない。
- `plan/page.tsx`のプラン別ネストボックス: 外側の`cardClass`内のサブ要素
  として妥当な範囲であり、実際のCTAには既に`SubmitButton`を使用している。
- `close-account/page.tsx`・`leave-service/page.tsx`の退会系ボタン: 既に
  `--danger`系の配色で保存系ボタンと視覚的に区別されているため変更していない。
- 同2画面の見出し(`SectionLabel`非使用): カード内の先頭に既存の文言
  (「この操作について」等)が実質的な見出しとして機能している。新規の
  見出し文言を追加するとワーディング変更になるため、既存文言はそのまま
  残し、見出しコンポーネントの追加は見送った。

維持した既存機能・権限: 全画面で設定値の保存・取得ロジック、認証・権限・
RLS、DBスキーマ、プラン・課金・退会・アカウント削除の動作は変更していない。
対象外画面のデザイン変更・不要な文言変更・機能追加も行っていない。

## 今回のバッチ(参考・マージ済み): バッチA〜C(出欠入力フォーム・スタッツ閲覧画面・資料室詳細)

対象ファイル:
- `src/app/(app)/schedule/AttendanceEntryForm.tsx`(バッチA、旧Card 1箇所)
- `src/app/(app)/game/stats/[matchId]/view/page.tsx`(バッチB、旧Card 1箇所)
- `src/app/(app)/library/[id]/page.tsx`(バッチC、旧Card 3箇所)

いずれも旧`<Card>`(角丸6px)を共通`cardClass`(角丸14px、`bg-card`/
`border-border-subtle`/`shadow-card`)へ移行した。カード内のボタン類
(出欠Pillと並ぶEditButton、削除ボタン、移動/編集するの小型ピルボタン等)は
役割に応じた既存のコンパクトな外観をそのまま維持し、タップ領域44pxの基準を
ボタン外観の一律拡大とは解釈していない(カードの移行のみ)。

維持した既存機能・権限:
- バッチA: 出欠登録・編集・削除(`handleSubmit`/`handleDelete`)、
  `setEditing`による編集状態の切り替え、権限判定は変更していない。
- バッチB: スタッツ集計(`teamScore`/`opponentScore`等)・表示・閲覧権限
  (`accessBadge="coach"`)は変更していない。
- バッチC: 資料の閲覧・添付ファイル表示(画像/PDF/その他)・編集・削除・
  移動(`MoveModal`)・閲覧可能ロールの権限判定は変更していない。

DB・RLS・認証は変更していない。対象外画面のデザイン変更・新機能追加は
行っていない。

## Phase 2(参考・マージ済み): スケジュール一覧・カレンダー表示

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
| 4 | スタッツ閲覧画面(`/game/stats/[matchId]/view`) | 完了 | #217 |
| 5 | 資料室詳細・設定配下の未刷新画面 | 完了 | #217(資料室詳細分)、#218(設定配下分) |
| 6 | 選手・カルテ・会計関連の未刷新画面 | 選手管理(players)配下は完了(#219)。カルテ(karte)配下は完了(#220, #221)。会計(accounting)配下10画面はPRレビュー待ち(バッチE-3、本PR) | #219(選手管理分)、#220(カルテ選手個別分)、#221(カルテチーム単位分)、本PR(会計分) |
| 7 | その他の低優先度画面((auth)配下・公開静的ページ等) | 未着手(未調査) | — |

## 根拠データ(本更新時点で再調査済み)

- `src/app/(app)`配下の`page.tsx`: 77ファイル
- 旧`<Card>`をimportしているファイル(`(app)`配下、ページ・コンポーネント
  含む): 7ファイル(本PRのバッチE-3で`accounting`配下10ファイルを移行、
  マージ前の作業ツリーで再計測)
- `cardClass`を使用しているファイル(同上): 69ファイル(同上)
- `src/app/(app)/settings`配下: 旧`<Card>`使用は0ファイル(#218で移行済み・
  マージ・本番反映済み)
- `src/app/(app)/players`配下: 旧`<Card>`使用は0ファイル(#219で移行済み・
  マージ・本番反映済み)
- `src/app/(app)/karte`配下: 旧`<Card>`使用は0ファイル(#220, #221で
  players/team双方とも移行済み・マージ・本番反映済み)
- `src/app/(app)/accounting`配下: 旧`<Card>`使用は0ファイル(本PRのバッチ
  E-3で10ファイルすべてcardClassへ移行済み・マージ前)
- 残る旧`<Card>`使用7ファイルは`src/app/(app)/game`配下6ファイル・
  `src/app/(app)/poll/new/page.tsx`1ファイルで、いずれもバッチE(選手・
  カルテ・会計)の対象外。完了済み一覧の「ゲーム」の記載は過去のPR時点の
  ものであり、本PRの対象外のため今回は再調査・修正していない(次回この
  範囲に着手する際に改めて確認する)。

上記のファイル数は「`<Card>`をimportしているか」の機械的なgrep結果であり、
1ファイル内の複数カード箇所や、import無しで独自に旧スタイルを直接記述している
箇所までは数えていない。したがって「進捗率」として画面数のみから厳密な
パーセンテージを出すのは避け、残作業バッチの対象ファイルを明示する形で
管理する((auth)配下・公開静的ページ等のPhase 7は今回未調査のため件数不明)。

## 残作業バッチ(実装可能な単位)

### バッチA〜C: スケジュール詳細・スタッツ閲覧画面・資料室詳細 — 対応済み、マージ・本番反映済み(#217)

- 対象ファイル: `src/app/(app)/schedule/AttendanceEntryForm.tsx`、
  `src/app/(app)/game/stats/[matchId]/view/page.tsx`、
  `src/app/(app)/library/[id]/page.tsx`
- 状態: #217でcardClassへの移行を実施し、マージ・本番反映済み。

### バッチD: 設定配下13画面(Phase 5の一部)— 対応済み、マージ・本番反映済み(#218)

- 対象ファイル: `src/app/(app)/settings/{name,category,logo,team,
  close-account,plan,export,leave-service,audit-log,storage,color,
  password}/page.tsx`、`src/app/(app)/settings/teams/new/NewTeamForm.tsx`
- 状態: #218でcardClassへの移行を実施し、マージ・本番反映済み。

### バッチE: 選手・カルテ・会計関連(Phase 6、大規模)— 対応済み、全サブバッチがマージ・本番反映済みまたはPRレビュー待ち

対象ファイル: `src/app/(app)/karte`配下(旧Card使用19ファイル)、
`src/app/(app)/accounting`配下(10ファイル)、`src/app/(app)/players`配下
(6ファイル)。合計35ファイル。画面数が多いため、機能群(選手/カルテ/会計)
単位で分割し、カルテはさらに規模・依存関係からE-2a(選手個別)/E-2b
(チーム)に分割して実施した。各バッチで旧`<Card>`を`cardClass`へ移行し、
記録・集計ロジック・権限判定は変更していない。

#### バッチE-1: 選手管理(players)配下6画面 — 対応済み、マージ・本番反映済み(#219)

- 対象ファイル: `src/app/(app)/players/{[id]/dues,[id]/growth,[id]/notes,
  [id]/sports-test,[id]/stats,obog}/page.tsx`(旧Card使用6ファイル、合計20箇所)
- 状態: #219でcardClassへの移行を実施し、マージ・本番反映済み。

#### バッチE-2a: カルテ(karte/players、選手個別)配下5画面 — 対応済み、マージ・本番反映済み(#220)

- 対象ファイル: `src/app/(app)/karte/players/{[playerId]/analysis,
  [playerId]/notes/[noteId],[playerId],bulk-import,}/page.tsx`
  (旧Card使用5ファイル、合計27箇所)
- 状態: #220でcardClassへの移行を実施し、マージ・本番反映済み。

#### バッチE-2b: カルテ(karte/team、チーム単位)配下14画面 — 対応済み、マージ・本番反映済み(#221)

- 対象ファイル: `src/app/(app)/karte/team`配下(旧Card使用14ファイル:
  analysis、attendance-report、custom-stats、game、goal、
  notes/[noteId]、page、shooting/new、shooting、skill-tests/[id]、
  skill-tests、sports-test、workout、workout/shaving)、合計33箇所。
- 状態: #221でcardClassへの移行を実施し、マージ・本番反映済み。これで
  バッチE-2(カルテ全体、19ファイル・合計60箇所)が完了した。

#### バッチE-3: 会計(accounting)配下10画面 — 対応済み、PRレビュー待ち

- 対象ファイル: `src/app/(app)/accounting`配下(旧Card使用10ファイル:
  budget、categories、dues/[id]/checklist、dues/[id]、dues、dues/unpaid、
  officers、page、report、transactions)、合計33箇所。
- 完了条件: 各画面の旧`<Card>`を`cardClass`へ移行し、既存のkey・className・
  onClick等のpropsを保持する。見出し・入力欄・ボタン・一覧・余白を共通
  デザインと照合する。請求・入金・支出などの会計処理、金額計算・残高・
  集計・年度管理、会計データの登録・編集・削除、CSV出力・履歴表示、権限
  判定・プラン制限は変更しない。
- 状態: 本PRで実装済み(マージ前)。詳細は上記「今回のバッチ」を参照。

### バッチF: その他低優先度画面(Phase 7、未調査)

- 対象: `(auth)`配下(ログイン・登録等)・公開静的ページ等。
- 今回は対象ファイル・件数を調査していない。着手前に現状調査から行う。
