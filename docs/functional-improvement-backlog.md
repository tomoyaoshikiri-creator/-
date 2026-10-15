# Functional Improvement Backlog

APP-WIDE VISUAL REFRESH(MASTER SPECIFICATION)の実施中に発見した、UI Refreshの
スコープ外(機能・UX・アーキテクチャ判断を伴う)の改善点を記録する。UI Refresh完了後、
別タスクとして着手を検討する。

---

## 1. SubmitButtonの手動複製(コンポーネント未再利用)(対応済み)

- Screen: `TeamDeletionScreen.tsx` / `ActiveTeamErrorScreen.tsx` /
  `(auth)/invite/[token]/AcceptInviteAsExistingUserForm.tsx` /
  `(app)/settings/teams/new/NewTeamForm.tsx`
- `<button>`の2箇所は`<SubmitButton>`へ置き換え、`<Link>`の2箇所(チーム切り替え導線)は
  新設した`<SubmitLinkButton>`(`SegButton.tsx`、SubmitButtonと同じ見た目を`<Link>`向けに
  提供)へ置き換えた。今後SubmitButtonの見た目を変更しても、この4箇所も自動的に追従する。

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
