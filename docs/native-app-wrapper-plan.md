# ネイティブアプリ化(iOS/iPadOS/Android/Mac)の実装方針

正式リリースに合わせてWebアプリをネイティブの殻で包んで配布する計画について、事前に整理した方針を記録する。実装自体はまだ未着手(このドキュメント作成時点でiOS/Android/Macいずれのネイティブプロジェクトも存在しない)。着手する際は以下を併せて対応すること。

## 全体方針

- Web版は廃止せず維持する。ネイティブ版はWeb版と同じSupabaseバックエンドに接続する「クライアントが増えるだけ」の構成とし、既存のアカウント(`profiles`・`teams`・ログイン情報)は無変更でそのまま使える。都賀ビクトリーズ(`signature_edition`)を含め、既存チームのアカウント移行は一切不要。
- 招待リンク発行(`/invite/[token]`)・新規チーム作成(`/signup`)のフロー自体も無変更。中身はWebと同じページ・同じSupabase Auth呼び出しのため、ネイティブの殻を被せても手順は変わらない。

## 決済方法(プラットフォームごとに分ける)

| プラットフォーム | 配布方法 | 決済 |
|---|---|---|
| Web | - | Stripe(現状維持、手数料最小) |
| iOS / iPadOS | App Store | StoreKit(Apple純正In-App Purchase) |
| Android | Google Play Store | Google Play Billing |
| Mac | **Mac App Store外(Developer ID署名 + Notarization)を推奨** | Stripe(ストア外配布ならApple IAP義務なし・手数料も発生しない) |

- Mac App Store経由で配布する場合のみ、iOSと同じApp Store Review Guidelines(3.1.1のIAP義務含む)が適用される。ストア外配布(.dmg等の直接配布、Slack/Zoom等と同じ方式)ならNotarizationのみで足り、Stripeをそのまま使える。どちらにするかは発見性(ストア掲載)の必要性で判断する。
- 日本のスマートフォン新法(モバイル・ソフトウェア競争促進法)による外部決済リンクの仕組み(iOS 26.2〜)は、今回は**使わない方針**(2025-12時点の検討では候補に挙がったが、通常のストア課金に一本化する方針に変更済み)。
- Guideline 4.2(Minimum Functionality)はWebView単純ラッパーだと審査落ちするため、決済方式と無関係に必須対応: ネイティブPush通知(APNs/FCM)・ネイティブ画面遷移・オフライン時の挙動・カメラ/Face ID等の端末機能連携を実装すること。

## 招待リンクのアプリ誘導(Universal Links / App Links)

- 招待メール・確認メールのリンクをタップした際、アプリがインストール済みならアプリ内の該当画面に直接遷移するよう、iOS Universal Links・Android App Linksを設定する。
- アプリ未インストール時は、App Store/Play Storeへのダウンロード導線(iOSはSmart App Banner等)を表示する。
- 「ダウンロード後に自動で元の招待画面へ戻る」完全自動化(deferred deep linking)は、Firebase Dynamic Linksが2025年8月にサービス終了しており代替が必要(Branch/AppsFlyer等の有料サービス)。コスト・運用負荷に見合わなければ、「アプリインストール後、もう一度同じ招待リンクを開き直してもらう」(2回タップ)運用で十分なため、まずはこちらで進めてよい。

## 参考: 検討の経緯

本ドキュメントの内容は、Claude Codeとのセッションでの壁打ちで固めた方針。日本のスマートフォン新法対応(外部決済リンク)の詳細調査結果は別途セッションログに残っているが、採用しない方針になったため本ドキュメントには詳細を再掲しない。実装時に外部決済リンクの採用を再検討する場合は、Apple公式ページ(`developer.apple.com/support/payment-options-on-the-app-store-in-japan` 等)を都度最新状態で確認すること(手数料体系が頻繁に更新されているため)。
