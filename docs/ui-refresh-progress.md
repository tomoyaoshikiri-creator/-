# CIRCLE LINES UI/UX刷新 進捗台帳

状態: 未着手 / 実装中 / PRレビュー待ち / マージ・本番反映済み / 保留

この台帳はPhase単位で差分更新する。完了済み(マージ・本番反映済み)の画面は、
明確な不具合や新しいPhaseでの依存関係がない限り再着手しない。
唯一の進捗管理ファイルとして扱い、重複する新規の管理ファイルは作らない。

最終更新: 2026-11-02(本PR: 実機QA第2弾〈下部ナビの位置計算を
PILL_NAV_BOTTOM_OFFSETへ一本化し、通常5タブ・スタッツ専用4タブ・Fabの
3箇所で共通化。iPhone Airで下部メニューの余白が依然大きい問題に対し
safe-area-inset-bottomの50%縮小へ変更〉、PRレビュー待ち・マージ前)。
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
- バッチE-3(会計(accounting)配下10画面の旧Card移行、#222) — マージ・
  本番反映済み。詳細は下記(バッチE-2b参考セクションに続けて記載)
- バッチE(選手・カルテ・会計、合計35ファイル)— E-1(#219)・E-2(#220,
  #221)・E-3(#222)がすべてマージ・本番反映済みとなったため完了。
- バッチF(認証画面(auth)配下10ファイル・17箇所の旧カードスタイル統一、
  #223) — マージ・本番反映済み。詳細は下記(バッチE-3参考セクションに
  続けて記載)
- 最終QA第2段階(SkillTestPanel.tsx・TeamDeletionScreen.tsx・
  karte/team/workout/menu/page.tsxの3件の移行漏れ修正+スタッツ表
  ラッパー9ファイル13箇所の`tableWrapperClass`共通化、#224) — マージ・
  本番反映済み。詳細は下記(バッチF参考セクションに続けて記載)
- 最終調整(残存スタイル整理、game配下7ファイル・poll/new/page.tsxの旧
  カードスタイル整理、#225) — マージ・本番反映済み。詳細は下記(最終QA
  第2段階参考セクションに続けて記載)
- 実機QA第1弾(①試合スタッツ画面のスターティング登録をチーム別モーダルに
  分離、②下部5タブメニューの位置調整、#226) — マージ・本番反映済み。
  詳細は下記(最終調整参考セクションに続けて記載)

保留(診断専用、対象外): PR #198(Safari入力クラッシュ診断) /
PR #199(下部表示実測)

## PRレビュー待ち

- 実機QA第2弾(下部ナビの位置計算を3箇所で共通化し、iPhone Airの余白を
  再調整、本PR、マージ前) — 詳細は下記

## 今回のバッチ: 実機QA第2弾(下部ナビ位置の再修正)

PR #226本番反映後、iPhone Airで再確認したところ問題が残っていたため調査・
修正した。既存機能の維持を最優先とし、不要なリファクタリングやUIの拡大は
行っていない。

### 調査結果(なぜ位置が揃っていなかったか)

下部の「余白(bottom)計算式」`max(0.875rem, env(safe-area-inset-bottom))`
相当のコードが、以下の3箇所にそれぞれ個別に手書きされていた。

- `src/components/TabBar.tsx`(通常5タブ、`position:fixed`、ビューポート
  基準)
- `src/components/PillNavBar.tsx`の`PillNavPosition`(スタッツ入力画面の
  専用4ボタン等、`position:absolute`、ページごとのcontent wrapper基準)
- `src/components/ui/Modal.tsx`の`Fab`(ピルの上に浮かせる「+」ボタン、
  ピルの高さ+このbottom式+間隔で位置を算出)

実機QA第1弾(PR #226)では、指示されたスコープ(下部5タブメニュー)に
従い`TabBar.tsx`の式だけを`max(0.875rem, calc(env(safe-area-inset-bottom)
- 0.875rem))`に書き換えた。これにより、同じ式を使っていた
`PillNavPosition`(スタッツ入力画面の専用4ボタン)は元の式のまま変更されず
取り残され、「通常5タブは下がったが専用4タブは変わらない」という今回の
報告内容と一致する。また、通常5タブ自体についても、`-0.875rem`という
固定値による削減は、実際のsafe-area-inset-bottomの実測値が大きい機種では
相対的な効果が薄く、「下がったが足りない」という結果につながったと考える。

### 修正内容

1. **一本化**: `PillNavBar.tsx`に`PILL_NAV_BOTTOM_OFFSET`という1つの
   共通定数を新設し、`TabBar.tsx`・`PillNavPosition`・`Modal.tsx`の
   `Fab`の3箇所すべてがこの定数を参照する形に統一した。これにより、
   今後この値を調整する際は1箇所を変更するだけで3箇所すべてに反映され、
   今回のような「1箇所だけ変更して他が取り残される」不具合を構造的に
   防止する。
2. **計算式の変更**: `max(0.875rem, calc(env(safe-area-inset-bottom) *
   0.5))`に変更した。固定のpx/remを差し引く方式(実機QA第1弾)は、
   safe-area-inset-bottomの実測値が不明なままでは効果量が読めない
   (値が大きい機種ほど効果が相対的に薄くなる)ため、絶対値ではなく
   比率(50%)で縮める方式に変更した。0.875remのフロアは、
   safe-area-inset-bottomが小さい/存在しない環境(Android Chrome等、
   ホームボタン機種を含む)向けの最低限の余白として維持する。

### コード上で保証できる範囲と限界

- コード上で確認済み: `PILL_NAV_BOTTOM_OFFSET`という1つの定数を3箇所が
  参照しているため、通常5タブ・スタッツ専用4タブ・Fabの下端位置の計算式が
  完全に一致することは保証できる(構造的な統一)。
- コード上で保証できない: 50%という比率は実機のスクリーンショット実測値
  から導いたものではなく、「多すぎる」「まだ足りない」という往復の
  フィードバックから絞り込んだ推測値である。ホームインジケーターの実際の
  スワイプ判定領域とどの程度の余白があれば十分かはコードだけでは判断
  できない。
- 実機で確認すべき事項: (1)iPhone Airで、ホームインジケーターの上に
  メニューが重なったり、メニュー下部のボタンタップがシステムのスワイプ
  操作(ホームへ戻る等)と誤爆したりしないか。(2)見た目の余白が意図した
  位置(前回より十分に下がっているか)になっているか。(3)iPad miniなど
  safe-area-inset-bottomが小さい/存在しない機種で、0.875remのフロアが
  想定通り効いており、レイアウト崩れがないか。(4)スタッツ入力画面の
  Fab(「+」ボタンがある画面があれば)がピルの直上に正しく浮いているか。
  不足・過剰であればこの1箇所(`PILL_NAV_BOTTOM_OFFSET`の比率・フロア)
  だけを調整すれば3箇所すべてに反映される。

### 検証

- ESLint・TypeScript(`tsc --noEmit`)・Vitest(22ファイル/300テスト)・
  Next.js buildすべて成功。
- 変更は`src/components/PillNavBar.tsx`・`src/components/TabBar.tsx`・
  `src/components/ui/Modal.tsx`の3ファイルに限定し、`git diff`で
  下部ナビ位置計算以外の変更がないことを確認した。

## 今回のバッチ(参考・マージ済み): 実機QA第1弾(スターティング登録分離・下部ナビ位置調整)

### ① スターティング登録のチーム別分離

- 調査結果: 試合開始時のスターティング登録(`StartingLineupModal.tsx`)は
  `LineupSection.tsx`(自チーム)と`OpponentLineupSection.tsx`(相手チーム)
  の2つのセクションを1つの`Modal`に縦に並べていたため、モバイルで縦長に
  なっていた。一方、既存の選手交代(`MemberChangeModal.tsx`)は、呼び出し元
  (`game/stats/[matchId]/page.tsx`)が自チーム用・相手チーム用のインスタンス
  をそれぞれ独立したopen状態(`ownMemberModalOpen`/`opponentMemberModalOpen`)
  で個別に開く構成になっており、チームごとに完全に分離されていた。
- 対応: `StartingLineupModal.tsx`を`OwnStartingLineupModal`・
  `OpponentStartingLineupModal`の2つの独立したモーダルコンポーネントに
  分割し、`MemberChangeModal`と同じ「チームごとに別インスタウンス・別open
  状態」の構成に揃えた。呼び出し元の状態も`startingLineupModalOpen`
  (1つ)から`ownStartingLineupModalOpen`・
  `opponentStartingLineupModalOpen`(2つ)に分離し、「その他」パネルの
  起動ボタンも、既存の「交代」パネルの自チーム/相手チームボタン(オレンジ/
  ネイビーの配色)と同じ見た目・配置(横並び2ボタン)に揃えた。
  `LineupSection.tsx`・`OpponentLineupSection.tsx`自体の選手選択UI・
  draft状態・登録ボタン(`SubmitButton`)は変更していない。スターティング
  登録と選手交代は別の処理のため、保存ロジック(`handleSaveStarters`・
  `handleSaveOpponentStarters`・`handleToggleOwnMember`・
  `handleToggleOpponentMember`)は一切変更していない。
- 確認: `git diff`でこれらの保存・交代ロジック関数に変更がないことを
  目視確認済み(コード上で確認済み)。自チーム・相手チームのモーダルが
  それぞれ独立したuseState・独立したprops(他チームの状態を一切渡さない)
  で構成されていることをコード上で確認済み。実機での開閉操作・レイアウト
  の見た目は未確認。

### ② 下部5タブメニューの位置調整

- 調査結果: `src/components/TabBar.tsx`の位置計算は
  `bottom: max(0.875rem, env(safe-area-inset-bottom))`。
  `src/components/PillNavBar.tsx`のコメントにある過去の実機確認で、固定の
  余白とsafe-area-inset-bottomを単純に加算する`calc(0.875rem +
  env(safe-area-inset-bottom))`だと「下端からの余白が離れすぎて見える」
  ことが判明し、大きい方を採用する`max()`に変更した経緯がある。
  safe-area-inset-bottomが大きい端末では、`max()`の結果はsafe-area-
  inset-bottomの値そのものになる。iPhone Airの実機確認で、この状態でも
  メニュー下に余白が残り過ぎて見えることが分かった。
- 対応: ユーザー確認の上、`max(0.875rem, calc(env(safe-area-inset-bottom)
  - 0.875rem))`に変更した。safe-area-inset-bottomから0.875rem分を
  差し引くことで、ホームインジケーター保護領域そのものは侵食せず
  (0.875remはどの機種でも通常のホームインジケーター領域幅より小さい)、
  必要以上の余白だけを削る。safe-area-inset-bottomが0.875rem未満の機種
  (iPad mini等、ホームインジケーターの概念がない機種を含む)では従来通り
  `max()`の0.875rem側が効くため挙動は変わらない。この変更は
  `src/components/TabBar.tsx`のみに閉じており、同じ`max(0.875rem,
  env(safe-area-inset-bottom))`パターンを使う`PillNavBar.tsx`の
  `PillNavPosition`(スタッツ入力画面の専用操作バー・FABの位置決めに使用)
  やModal.tsxの位置計算には手を加えていない。
- 確認: TypeScript/build上で問題なし(コード上で確認済み)。
  PageShellの`pb-28`(コンテンツ側の下部余白)は、メニューが下方向
  (物理的な画面端に近づく方向)へ移動したことで従来以上の余白が確保され
  るため、コンテンツがメニューに隠れる方向への影響はないと判断した
  (コード上で確認済み)。ただし、具体的な移動量(px/rem)は実機の
  screenshot実測値に基づくものではなく、既存のmax()式から0.875rem分を
  差し引くという推測による調整であるため、iPhone Airおよび他のiPhone/
  iPad miniでの実際の見た目は実機で再確認が必要。

### 検証

- ESLint・TypeScript(`tsc --noEmit`)・Vitest(22ファイル/300テスト)・
  Next.js buildすべて成功。
- `git diff`を全件確認し、スタッツ入力・集計ロジック、試合進行・タイマー等
  の処理、選手交代・ラインナップ管理、保存・更新・削除処理、DB・RLS・
  認証・権限判定に変更がないことを確認した。
- 自チーム・相手チームの登録状態が独立していることは、コンポーネント構成
  (別インスタンス・別useState・他チームの状態を渡さないprops)として
  コード上で確認済み。実機での実際の操作(開閉・登録・再編集)は未確認。

## 今回のバッチ(参考・マージ済み): 最終調整(残存スタイル整理)

これまでのバッチ(E/F/最終QA第2段階)で対象外としていたgame配下と
poll/new/page.tsxの旧カードスタイルを整理し、全体のデザイン統一を完了
させた。最終QA第2段階(#224)は本PRの前提としてマージ・本番反映済みであり、
対象には含まれない。

### 対象調査

- `src/app/(app)/poll/new/page.tsx`: 旧`<Card>`4箇所。
- `src/app/(app)/game`配下: 旧`<Card>`import 6ファイル
  (`LineupSection.tsx`、`[id]/page.tsx`、`OpponentLineupSection.tsx`、
  `GameStatLog.tsx`、`stat-categories/page.tsx`、`StatPad.tsx`)、
  手書きの旧スタイル1ファイル(`results/page.tsx`、2箇所)。
  `custom-stats/[matchId]/page.tsx`は最終QA第2段階(#224)で
  `tableWrapperClass`へ既に移行済みのため対象外。

### 用途の分類と対応

① 通常の情報表示カード(cardClassへ移行、合計14箇所):
- `poll/new/page.tsx`(4箇所、投票作成フォームの各セクション)
- `game/[id]/page.tsx`(5箇所、対戦結果フォーム・コーチメモの一覧/編集/
  追加。試合前後に使う管理画面であり、試合進行中のタップ操作ではない)
- `game/stat-categories/page.tsx`(1箇所、スタッツ項目の設定画面)
- `game/results/page.tsx`(2箇所、試合結果の一覧・集計。閲覧専用)
- `game/LineupSection.tsx`(1箇所、試合前のスターティング選択)
- `game/OpponentLineupSection.tsx`(1箇所、試合前の相手スターティング選択)
- `game/GameStatLog.tsx`(1箇所、プレーバイプレーログの表示。タップは
  記録の訂正・削除という二次操作であり、スタッツ入力自体の主要操作導線
  ではないため①と判断)

② 試合進行中の入力・操作パネル(意図的にcardClassへ移行せず、旧Cardの
まま維持):
- `game/StatPad.tsx`(3箇所、自チーム選手チップ・スタッツ入力ボタン
  グリッド・相手チーム選手チップ)。試合進行中にテンポよくタップし続ける
  主要な操作導線(選手チップの選択→スタッツボタンのタップ)の外枠であり、
  cardClassへの移行でパディングが変化すると選手チップの横スクロール
  領域・ボタングリッドの余白がわずかに変動するリスクがあるため、意図的に
  旧Cardのまま維持した。理由はコード内コメント(StatPad.tsx内)にも
  明記した。

横スクロール表(`game/stats/[matchId]/view/page.tsx`・
`game/custom-stats/[matchId]/page.tsx`)は最終QA第2段階(#224)で
`tableWrapperClass`へ既に適用済みのため、本PRでは変更していない。

### 認証・ロジックに変更がないことの確認

`git diff`を全件確認し、変更箇所はすべてimport文の追加・className値の
置換・タグの置き換え(`<Card>`→`<div>`)、およびStatPad.tsxへの説明コメント
追加のみであることを確認した。スタッツ入力・集計ロジック、試合進行・
タイマー等の処理、選手交代・ラインナップ管理、保存・更新・削除処理、
DB・RLS・認証・権限判定は一切変更していない。

## 今回のバッチ(参考・マージ済み): 最終QA第2段階(デザイン不統一3件の修正)

### 第1段階の調査結果(参考、コード変更は#224で実施)

- バッチA〜Fで対象とした画面自体の旧Card移行は完了していたが、全体監査で
  以下の移行漏れを発見した。
  - `src/components/karte/SkillTestPanel.tsx`: 旧`<Card>`が4箇所残存
    (karte/players/[playerId]/page.tsxから呼び出される共有部品。ページ本体
    のJSXのみを対象確認していたため漏れていた)。
  - `src/components/TeamDeletionScreen.tsx`: `ActiveTeamErrorScreen.tsx`
    (バッチFで移行済み)と同じ用途の兄弟コンポーネントだが未移行
    ((auth)配下を対象にした検索範囲外だったため漏れていた)。
  - `src/app/(app)/karte/team/workout/menu/page.tsx`: ページ全体が未移行
    (バッチE-2bの対象ファイル列挙(karte/team配下14ファイル)から
    このルートが漏れていた)。
  - スタッツ表(sticky列・横スクロール)を囲むラッパーdivが、cardClass移行
    済みの画面でも旧スタイル(角丸6px・影なし)のまま9ファイル・13箇所
    (第1段階の報告時点では12箇所と報告したが、`karte/players/[playerId]
    /page.tsx`に3箇所あり再集計の結果13箇所と判明)残っていた。
- P0/P1相当の重大な問題は見つからず、すべてP2(デザイン不統一・改善余地)。
- ナビゲーション・モーダル・SubmitButtonの高さ・金額入力欄の型・設定の
  トグル・固定幅によるオーバーフローの可能性は、コード上は問題なしと確認。

### 第2段階で実施した修正

1. `src/components/karte/SkillTestPanel.tsx`: 旧`<Card>`4箇所を
   `<div className={cardClass}>`へ置換。検定の作成・ランク登録・承認待ち
   表示のロジックは変更していない。
2. `src/components/TeamDeletionScreen.tsx`: 旧手書きカードスタイルを
   `cardClass`へ置換し、`ActiveTeamErrorScreen.tsx`と外観を統一した。
   退会取消処理(`/api/team/cancel-deletion`呼び出し)・ログアウト処理・
   権限判定(`isAdmin`)は変更していない。
3. `src/app/(app)/karte/team/workout/menu/page.tsx`: 練習履歴一覧・実施
   メニュー集計一覧の各行(2箇所)を旧手書きスタイルから`cardClass`へ
   置換した。年度フィルタ・履歴表示切替・集計の展開/折りたたみの機能は
   変更していない。
4. スタッツ表ラッパー(9ファイル・13箇所): `src/components/ui/Card.tsx`に
   新しい`tableWrapperClass`(背景・枠線・角丸・影のトークンはcardClassと
   揃えるが、内側paddingを持たせない)を追加し、各ファイルの表ラッパーdiv
   のclassNameを`` `${tableWrapperClass} overflow-auto max-h-[...]` ``へ
   置換した(既存のoverflow-auto・max-height・sticky列の指定はそのまま
   維持し、横スクロールの表示領域は狭めていない)。対象:
   `players/[id]/stats/page.tsx`(2箇所)、
   `players/[id]/sports-test/page.tsx`(1箇所)、
   `karte/players/[playerId]/page.tsx`(3箇所)、
   `karte/team/game/page.tsx`(1箇所)、
   `karte/team/skill-tests/[id]/page.tsx`(1箇所)、
   `karte/team/sports-test/page.tsx`(2箇所)、
   `karte/team/custom-stats/page.tsx`(1箇所)、
   `game/stats/[matchId]/view/page.tsx`(1箇所)、
   `game/custom-stats/[matchId]/page.tsx`(1箇所)。
   表の構造・データ処理(スタッツの集計・表示)は変更していない。構造上の
   問題は見つからず、全13箇所を安全に共通化できた。

### 既知の対象外スタイルの再評価(#224時点、今回は変更せず)

- `src/app/(app)/game`配下(`LineupSection.tsx`、`[id]/page.tsx`、
  `OpponentLineupSection.tsx`、`GameStatLog.tsx`、`stat-categories/page.tsx`、
  `StatPad.tsx`は旧`<Card>`import、`custom-stats/[matchId]/page.tsx`・
  `results/page.tsx`は手書きの旧スタイル、合計8ファイル)と
  `src/app/(app)/poll/new/page.tsx`は、#224時点では対象外としていたが、
  後続の最終調整バッチ(本PR)で整理した。詳細は上記「最終調整(残存スタイル
  整理)」を参照。`custom-stats/[matchId]/page.tsx`は#224で
  `tableWrapperClass`へ移行済みのため、最終調整バッチの対象外。
- 公開ページ(`contact`/`help`/`pricing`/`privacy`/`terms`/`tokushoho`/
  ルート`page.tsx`): デスクトップ向けの記事レイアウト(`max-w-[720px]`)
  として、`privacy`/`terms`/`tokushoho`の`bg-white border border-line
  rounded-lg p-4`という記事本文の背景スタイルを含め、相互に自己整合的に
  統一されている。モバイルのapp-shell向けデザイン(cardClass)とは意図的に
  別系統であり、意図的な例外として妥当と評価し、対象外として維持する
  (最終調整バッチでも再評価済み、変更なし)。

## 今回のバッチ(参考・マージ済み): バッチF(認証画面・公開画面)

### 対象調査の結果(参考、バッチF時点の記録)

- 旧`<Card>`コンポーネントの使用: `(auth)`配下・公開ページ(`contact`/
  `help`/`pricing`/`privacy`/`terms`/`tokushoho`/ルート`page.tsx`/
  `not-found.tsx`/`error.tsx`)のいずれにも旧`<Card>`のimportは存在しない
  (`grep`で確認済み、0件)。これらの画面は共通`Card`コンポーネントが
  導入される以前からの実装であり、旧Cardを経由せず直接クラスを書いている。
- 代わりに、`(auth)`配下のフォーム・メッセージボックスの大半が
  `className="bg-white border border-line rounded-lg p-5"`(旧Cardと同じ
  角丸6px・枠線のみの見た目)を手書きで直接指定していた。これをコードから
  集計した結果、10ファイル・合計17箇所で使用していた。
- 公開ページ(`contact`/`help`/`pricing`/`privacy`/`terms`/`tokushoho`/
  ルート`page.tsx`)は、`(auth)`とは異なる`rounded-lg border border-line
  bg-white p-4`(角丸6px、パディング16px)という、ページ間で完全に統一
  された独自パターンを使用している。これは`PageShell`を使うモバイル版
  アプリ画面とは異なる、`max-w-[720px]`中央寄せのデスクトップ可読レイアウト
  (記事・規約ページ)であり、既にページ同士で統一されている。
- 認証関連の共通コンポーネント: `AuthHeading`(見出し)、`FieldLabel`/
  `SubmitButton`/`inputClass`(`SegButton.tsx`、入力欄・送信ボタン)、
  `TermsAgreementCheckbox`、`TurnstileWidget`は、すべての認証フォームで
  既に共通コンポーネントとして使用されている。

対象ファイル(いずれも`src/app/(auth)/`配下、または`(auth)`専用の共有
コンポーネント、旧カードスタイル使用10ファイル・合計17箇所):
- `login/LoginForm.tsx`(ログイン、2箇所)
- `signup/SignupForm.tsx`(新規登録、3箇所)
- `forgot-password/ForgotPasswordForm.tsx`(パスワード再設定申請、2箇所)
- `reset-password/ResetPasswordForm.tsx`(新パスワード設定、1箇所)
- `invite/[token]/page.tsx`(招待リンク無効時、1箇所)
- `invite/[token]/InviteForm.tsx`(招待受諾・新規、3箇所)
- `invite/[token]/AcceptInviteAsExistingUserForm.tsx`(招待受諾・既存、2箇所)
- `setup/SetupForm.tsx`(チーム作成、1箇所)
- `select-team/SelectTeamList.tsx`(チーム選択、1箇所)
- `src/components/ActiveTeamErrorScreen.tsx`(所属チーム確認エラー、1箇所)

実際のUI変更内容:
- カード: 全10ファイルの旧カードスタイル(`bg-white border border-line
  rounded-lg p-5`、一部`p-2`)を、`(app)`配下の全バッチで使用してきた
  共通`cardClass`へ移行した(合計17箇所)。追加のclassNameを持つもの
  (`invite/[token]/page.tsx`の`text-center`、`ActiveTeamErrorScreen.tsx`
  の`max-w-md mx-auto w-full`・`text-center`)は、既存のclassNameを保持
  したまま`` `${cardClass} ...` ``の形で合成した。
- 見出し・入力欄・ボタン(`AuthHeading`/`FieldLabel`/`inputClass`/
  `SubmitButton`/`TermsAgreementCheckbox`/`TurnstileWidget`)は、10ファイル
  すべてで移行前から既に共通コンポーネントを使用していることを確認済み。
  追加の変更は行っていない。

変更不要と判断した部品(既存の共通デザインと整合しているため、独自の新規
デザイン規則化を避けて変更していない):
- `login/page.tsx`のエラー・通知バナー(`bg-white border border-line
  rounded-lg p-3`、2箇所): フォーム全体を囲む「カード」ではなく、一時的な
  軽量インラインアラートとしての役割のため、カードへの統合は見送った。
  画面固有のUIを無理に共通コンポーネントへ置き換えない方針に基づく判断。
- 公開ページ(`contact`/`help`/`pricing`/`privacy`/`terms`/`tokushoho`/
  ルート`page.tsx`)の`rounded-lg border border-line bg-white p-4`パターン:
  ページ間で完全に統一されたデスクトップ可読レイアウト用の独自の箱型
  スタイルであり、モバイル版アプリの`cardClass`(影つき・角丸14px・
  カードスタック用)とは文脈が異なる。既にページ同士で整合しているため
  変更していない。
- `not-found.tsx`・`error.tsx`: カード要素を持たない中央寄せのテキスト
  のみの画面であり、変更対象がないため変更していない。
- `AuthHeading.tsx`のロゴ・タイトル表示: 既存のブランド表示仕様
  (MASTER SPECIFICATION #10/#32)に基づく実装であり、カード統一の対象外
  のため変更していない。

認証ロジックに変更がないことの確認: `git diff`で全10ファイルの差分を
確認した結果、変更はclassNameの置き換えと`cardClass`のimport追加のみ
であり、`actions.ts`(ログイン・ログアウト・新規登録・招待・パスワード
再設定・セッション管理等のサーバーアクション)は1ファイルも変更していない。
リダイレクト処理、Supabase連携、DB・RLS、権限・プラン判定のコードも
変更していない。

維持した既存機能: ログイン・ログアウト処理、新規登録・招待の処理、
パスワード再設定、セッション管理、リダイレクト、認証・認可、Supabase
連携、DB・RLSは変更していない。認証フロー自体(2段階フォーム構成、
確認コードの送受信等)も変更していない。

## 今回のバッチ(参考・マージ済み): バッチE-3(会計(accounting)配下10画面)

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
| 6 | 選手・カルテ・会計関連の未刷新画面 | 選手管理(players)・カルテ(karte)・会計(accounting)すべて完了 | #219、#220、#221、#222 |
| 7 | その他の低優先度画面((auth)配下・公開静的ページ等) | (auth)配下10ファイルの旧カードスタイル統一は完了。公開静的ページは調査済みで変更不要と判断。 | #223 |
| 8(最終QA) | 全体監査(第1段階)・デザイン不統一の修正(第2段階)・残存スタイル整理(最終調整) | 第1段階は調査完了(コード変更なし)。第2段階(SkillTestPanel・TeamDeletionScreen・workout/menu・スタッツ表ラッパー9ファイル13箇所)・最終調整(game配下7ファイル・poll/new/page.tsx)ともに完了。 | #224(第2段階)、#225(最終調整) |
| 9(実機QA) | 実機QA第1弾(①スターティング登録のチーム別分離、②下部5タブメニューの位置調整)・第2弾(下部ナビ位置計算の3箇所共通化・再調整) | 第1弾は完了。第2弾はPRレビュー待ち(本PR)。下部ナビの余白量は実機再確認が必要。 | #226(第1弾)、本PR(第2弾) |

## 根拠データ(本更新時点で再調査済み)

- `src/app/(app)`配下の`page.tsx`: 77ファイル
- 旧`<Card>`をimportしているファイル(`(app)`配下、ページ・コンポーネント
  含む): 本PR(最終調整)時点で0ファイル。#224で発見された
  `src/components/karte/SkillTestPanel.tsx`の移行漏れ(過去のバッチE-2aの
  対象ファイル集計がページ本体のJSXのみを見ていたため漏れていた)は#224で
  修正済み。残っていた`game`配下6ファイル・`poll/new/page.tsx`1ファイルも
  本PRでcardClassへ移行し、`(app)`配下の旧`<Card>`importは0ファイルとなった
  (`game/StatPad.tsx`の3箇所は意図的な例外として旧Cardのまま維持、詳細は
  「最終調整(残存スタイル整理)」セクション参照)。
- `cardClass`を使用しているファイル(同上): 本PR時点の作業ツリーで
  再計測(#224でSkillTestPanel.tsx・TeamDeletionScreen.tsx・karte/team/
  workout/menu/page.tsxの3ファイル、本PRでpoll/new/page.tsx・
  game/[id]/page.tsx・game/stat-categories/page.tsx・
  game/results/page.tsx・game/LineupSection.tsx・
  game/OpponentLineupSection.tsx・game/GameStatLog.tsxの7ファイルを
  追加で移行したため、バッチE-3時点の69ファイルから増加)
- `src/app/(app)/settings`配下: 旧`<Card>`使用は0ファイル(#218で移行済み・
  マージ・本番反映済み)
- `src/app/(app)/players`配下: 旧`<Card>`使用は0ファイル(#219で移行済み・
  マージ・本番反映済み)
- `src/app/(app)/karte`配下: 旧`<Card>`使用は0ファイル(#220, #221で
  players/team双方とも移行済み・マージ・本番反映済み)
- `src/app/(app)/accounting`配下: 旧`<Card>`使用は0ファイル(#222で10ファイル
  すべてcardClassへ移行済み・マージ・本番反映済み)
- `src/app/(auth)`配下: 旧`<Card>`コンポーネントのimportは0ファイル(元々
  未使用)。ただし同等の見た目を手書きclassName
  `bg-white border border-line rounded-lg p-5`(一部`p-2`)で再現していた
  箇所が10ファイル・合計17箇所あり、バッチF(#223)で`cardClass`へ移行済み。
- 公開静的ページ(`contact`/`help`/`pricing`/`privacy`/`terms`/`tokushoho`/
  ルート`page.tsx`)は、`(auth)`や`(app)`とは異なる
  `rounded-lg border border-line bg-white p-4`という独自パターンで
  既に相互に統一されており、デスクトップ向けの記事レイアウトとして意図的に
  別系統のため、対象外として維持する(変更なし)。
- `game`配下7ファイル(`LineupSection.tsx`、`[id]/page.tsx`、
  `OpponentLineupSection.tsx`、`GameStatLog.tsx`、`stat-categories/page.tsx`、
  `results/page.tsx`、`StatPad.tsx`)・`poll/new/page.tsx`は、本PR(最終
  調整)で整理した。`StatPad.tsx`の3箇所(自チーム選手チップ・スタッツ
  入力ボタングリッド・相手チーム選手チップ)は試合進行中の主要な操作導線
  であるため意図的に旧Cardのまま維持し、残り6ファイル+`poll/new/page.tsx`
  はcardClassへ移行した。詳細は「最終調整(残存スタイル整理)」セクション
  参照。

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
- 状態: #222でcardClassへの移行を実施し、マージ・本番反映済み。これで
  バッチE(選手・カルテ・会計、合計35ファイル)が完了した。

### バッチF: 認証画面・公開画面(Phase 7)— 対応済み、PRレビュー待ち

- 対象ファイル: `src/app/(auth)`配下で旧Cardと同等の手書きカードスタイル
  (`bg-white border border-line rounded-lg p-5`等)を使用していた10ファイル
  (login/LoginForm、signup/SignupForm、forgot-password/ForgotPasswordForm、
  reset-password/ResetPasswordForm、invite/[token]/page、
  invite/[token]/InviteForm、
  invite/[token]/AcceptInviteAsExistingUserForm、setup/SetupForm、
  select-team/SelectTeamList)と、共有コンポーネント
  `src/components/ActiveTeamErrorScreen.tsx`、合計17箇所。
- 完了条件: 各箇所の手書きカードスタイルを`cardClass`へ移行する。
  ログイン・ログアウト処理、新規登録・招待の処理、パスワード再設定、
  セッション管理、リダイレクト、認証・認可、Supabase連携、DB・RLS、
  権限・プラン判定は変更しない。
- 状態: #223でcardClassへの移行を実施し、マージ・本番反映済み。公開静的
  ページ(contact/help/pricing/privacy/terms/tokushoho/ルートpage.tsx)は
  既に相互に統一された別系統のパターンのため変更不要と判断。

### 最終QA第1段階: 全体監査(調査のみ、コード変更なし)

- 内容: 最新main(バッチA〜Fすべてマージ済み時点)を対象に、旧Card・旧
  カードスタイルの残存、背景色・枠線・角丸・余白・文字サイズの不統一、
  共通コンポーネントの利用状況、ボタン・入力欄の見た目の差異、横スクロール・
  文字はみ出しの可能性、ナビゲーション・モーダルの一貫性を静的に調査した。
- 状態: 調査完了。コード変更・PR作成は行わず、結果のみ報告した。発見内容は
  下記「最終QA第2段階」に記載(第2段階のPRで修正実施)。

### 最終QA第2段階: 第1段階で発見したデザイン不統一の修正 — 対応済み、PRレビュー待ち

- 対象: `src/components/karte/SkillTestPanel.tsx`(旧Card4箇所)、
  `src/components/TeamDeletionScreen.tsx`(旧カードスタイル1箇所)、
  `src/app/(app)/karte/team/workout/menu/page.tsx`(旧カードスタイル2箇所)、
  スタッツ表ラッパー9ファイル13箇所(新設の`tableWrapperClass`へ統一)。
- 完了条件: 検定の作成・ランク登録・承認、退会取消処理・権限判定、練習
  記録の一覧・絞り込み・展開、スタッツの集計・表示ロジックは変更しない。
- 状態: #224でcardClass・tableWrapperClassへの移行を実施し、マージ・
  本番反映済み。game配下7ファイル(StatPad.tsxを含む)・poll/new/page.tsx
  の旧スタイルは#224時点では対象外としていたが、後続の最終調整バッチ
  (本PR)で整理した。公開静的ページの旧スタイルは別系統のデザインとして
  対象外のまま維持。実機QAは未完了のまま維持している。

### 最終調整: 残存スタイル整理(game配下・poll/new) — 対応済み、PRレビュー待ち

- 対象ファイル: `src/app/(app)/poll/new/page.tsx`(旧Card4箇所)、
  `src/app/(app)/game`配下7ファイル
  (`LineupSection.tsx`・`OpponentLineupSection.tsx`・`GameStatLog.tsx`・
  `stat-categories/page.tsx`は各1箇所、`[id]/page.tsx`は5箇所、
  `results/page.tsx`は手書きスタイル2箇所、合計11箇所)。
- 完了条件: ①通常の情報表示カードはcardClassへ移行する。②試合進行中の
  入力・操作パネル(`game/StatPad.tsx`の自チーム選手チップ・スタッツ入力
  ボタングリッド・相手チーム選手チップ、3箇所)はタップ領域・操作導線を
  維持するため意図的にcardClassへ移行せず、理由をコード内コメントと本
  台帳に明記する。スタッツ入力・集計ロジック、試合進行・タイマー等の処理、
  選手交代・ラインナップ管理、保存・更新・削除処理、DB・RLS・認証・権限
  判定は変更しない。横スクロール表(`game/stats/[matchId]/view/page.tsx`・
  `game/custom-stats/[matchId]/page.tsx`)は#224で`tableWrapperClass`を
  適用済みのため変更しない。
- 状態: #225で実装・マージ・本番反映済み。`game/StatPad.tsx`の3箇所は
  意図的な例外として旧Cardのまま維持。これで`(app)`配下の旧`<Card>`
  importは`StatPad.tsx`の3箇所を除き全て解消した。

### 実機QA第1弾: スターティング登録の分離・下部ナビ位置調整 — 対応済み、PRレビュー待ち

- 対象ファイル: `src/app/(app)/game/StartingLineupModal.tsx`
  (`OwnStartingLineupModal`・`OpponentStartingLineupModal`へ分割)、
  `src/app/(app)/game/stats/[matchId]/page.tsx`(モーダル呼び出し・
  状態・起動ボタンの更新)、`src/components/TabBar.tsx`(下部5タブの
  bottom位置計算)。
- 完了条件: ①自チーム・相手チームのスターティング5名をそれぞれ独立して
  登録・再編集できる。一方の操作が他方の選択状態を変更しない。②下部5
  タブメニューのサイズ・間隔・並び順は変更せず、位置のみ下へ移動する。
  いずれも既存の選手交代・試合進行・スタッツ記録・DB・RLS・認証・権限
  判定は変更しない。
- 状態: #226で実装・マージ・本番反映済み。②下部5タブの移動量が実機で
  不足していたこと、スタッツ入力画面の専用4タブ(PillNavPosition)が
  この対応の対象外のままだったことが後続の実機QA第2弾で判明し、再調整
  した(詳細は下記)。

### 実機QA第2弾: 下部ナビ位置計算の3箇所共通化・再調整 — 対応済み、PRレビュー待ち

- 対象ファイル: `src/components/PillNavBar.tsx`(`PILL_NAV_BOTTOM_OFFSET`
  を新設)、`src/components/TabBar.tsx`・`src/components/ui/Modal.tsx`
  (新設の定数を参照するよう変更)。
- 完了条件: 通常5タブ・スタッツ専用4タブ・Fabの下端位置の計算式を1箇所に
  統一する。メニュー本体のサイズ・アイコン・文字・タップ領域・間隔・
  並び順は変更しない。コンテンツがメニューに隠れないようにする。iPad
  miniなど他の画面サイズへの悪影響を避ける。
- 状態: 本PRで実装済み(マージ前)。計算式の統一(構造的な修正)はコード上で
  保証できるが、50%という比率自体は実機のスクリーンショット実測値に
  基づくものではなく推測調整のため、iPhone Air・iPad mini等での実機
  再確認が必要(詳細は上記「今回のバッチ」の「コード上で保証できる範囲と
  限界」を参照)。
