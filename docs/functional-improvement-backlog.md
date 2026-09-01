# Functional Improvement Backlog

APP-WIDE VISUAL REFRESH(MASTER SPECIFICATION)の実施中に発見した、UI Refreshの
スコープ外(機能・UX・アーキテクチャ判断を伴う)の改善点を記録する。UI Refresh完了後、
別タスクとして着手を検討する。

---

## 1. SubmitButtonの手動複製(コンポーネント未再利用)

- Screen: `TeamDeletionScreen.tsx` / `ActiveTeamErrorScreen.tsx` /
  `(auth)/invite/[token]/AcceptInviteAsExistingUserForm.tsx` /
  `(app)/settings/teams/new/NewTeamForm.tsx`
- Current behavior: `src/components/ui/SegButton.tsx`の`SubmitButton`と全く同じ
  className(`mt-3.5 w-full/block py-2.5 rounded-[10px] bg-navy text-white font-bold
  text-[13px] ...`)を、共通コンポーネントを使わずこの4ファイルで個別にハードコード
  している。
- Problem: 今回`SubmitButton`本体は`bg-navy`→`bg-orange`(teamPrimaryのエイリアス)
  へ修正したが、この4箇所は`SubmitButton`を経由していないため追従していない
  (未設定時ほぼ黒のまま)。
- Desired behavior: この4箇所を`<SubmitButton>`(または`<Link>`が必要な箇所は
  同等のクラスを`bg-orange`に統一)へ置き換え、Primary Actionの色を全画面で統一する。
- Priority: Medium(視覚的な不統一のみで機能への影響はない)
- UI Refreshでは未対応(個別文脈の確認〈destructive actionかどうか等〉が必要なため、
  今回の一括修正には含めなかった)。

## 2. EmptyStateにアイコンがない

- Screen: 全画面共通(`src/components/ui/Card.tsx`の`EmptyState`、60箇所超で使用)
- Current behavior: テキストのみの中央揃え表示(`text-[12.5px] text-ink-soft
  text-center py-5`)。
- Problem: MASTER SPEC #39は「small icon, concise explanation, 必要な場合のみCTA」
  を求めているが、iconスロットがない。
- Desired behavior: `EmptyState`にoptionalな`icon`propを追加し、必要な画面だけ
  小さなアイコンを添えられるようにする。
- Priority: Low(現状でも「巨大illustration・子ども向け表現」という禁止事項には
  抵触していないため、Minor cosmeticとして今回は見送った)。
- UI Refreshでは未対応(60箇所超の呼び出し元それぞれで「loading」と「本当に空」の
  区別がなく、一律追加すると意図しない見た目になる箇所がある可能性があるため、
  呼び出し元ごとの精査が必要)。

## 3. FAB(Floating Action Button)の共通パターンが存在しない

- Screen: 全画面共通
- Current behavior: 「追加」系アクションは画面ごとに個別のボタン(多くは
  `SubmitButton`やヘッダー内ボタン)で実装されており、MASTER SPEC #31が前提とする
  ような画面右下固定の円形FABパターンは存在しない。
- Problem: MASTER SPEC #31は「共通Component。既存機能・配置を維持」と既存FABの
  存在を前提にしているが、コードベースには該当する既存実装がない。
- Desired behavior: 新規にFABパターンを導入するかどうかは、既存の「追加」導線
  (ヘッダー内ボタン等)を置き換える主要なUX変更に当たるため、別途方針を確認して
  から着手する。
- Priority: 要判断(UX変更を伴うため)
- UI Refreshでは未対応(MASTER SPEC #4「既存の正常なUI寸法・配置を維持する」の
  原則に従い、既存にない新しいUIパターンを独断で追加しなかった)。

## 4. `--navy`が「secondary team accent」と「見出し等の中立色」の二役を兼ねている

- Screen: 全画面共通(23箇所)
- Current behavior: `--navy`は、確認ボタンの背景(secondary accent的役割)と、
  カレンダーの日付・統計値・見出しなどの中立的な濃色テキスト(neutral的役割)の
  両方に使われている。
- Problem: 将来teamSecondaryを一貫して適用したい場合、この二役混在が障害になる。
- Desired behavior: 「secondary team accent」用と「中立見出し色」用で別々の
  semantic tokenへ分離する(例: `--team-secondary`を実際にUIへ適用する経路を
  新設し、`--navy`は中立色専用に用途を絞る)。
- Priority: Low(現状で視覚的な破綻はなく、将来のteamSecondary活用強化のための
  設計改善)
- UI Refreshでは未対応(23箇所すべての文脈確認が必要な大きめの変更のため、
  MASTER SPEC #43「一括置換によって意味の異なる色まで変更しない」に従い見送った)。

## 5. AI分析プロンプト内に旧ブランド名「CLUB LINK」が残存

- Screen: 画面には表示されない(AI分析APIの内部プロンプト)
- File: `src/lib/ai/types.ts` / `src/lib/ai/promptCommon.ts` /
  `src/lib/ai/promptActualData.ts` / `src/lib/ai/dataQuality.ts`
- Current behavior: 「データが少ないことをCLUB LINK上の記録量の問題として扱う」旨の
  注意書きの中で、サービス名が旧ブランド名「CLUB LINK」のまま複数箇所に残っている
  (現在のサービス名は「CIRCLE LINES」)。
- Problem: AIが生成する分析結果の文章内に、この表記がそのまま出力される可能性がある。
- Desired behavior: プロンプト文言中の「CLUB LINK」を「CIRCLE LINES」へ置換する。
- Priority: Medium(ユーザーが直接目にするUI文言ではないが、AI出力に漏れる可能性がある)
- UI Refreshでは未対応(AIプロンプトの文言変更は「AI仕様」に該当し、今回のUI QAの
  変更禁止スコープに含まれるため、記録のみに留めた)。
