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
```

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
| 予定・出欠(登録) | – | ○ | ○ | ○ |
| お知らせ(閲覧) | ○ | ○ | ○ | ○ |
| お知らせ(登録) | – | ○ | ○ | ○ |
| 練習日報(登録・閲覧、チーム全体で共有) | ○ | ○ | ○ | ○ |
| 選手 / 選手メモ / 試合記録 | – | – | ○ | ○ |
| ユーザー管理・招待リンク発行 | – | – | – | ○ |
| チーム設定(配色・ロゴ) | – | – | – | ○ |

画面上には権限名は表示せず、裏側の判定のみでタブ・操作を出し分けている(`src/lib/permissions.ts`)。データのアクセス制御はUI側の出し分けに加えて、Supabase側のRow Level Securityで最終的に担保している(`supabase/migrations/`)。

## デザイン・ブランディング

- ログイン前(`/login` `/signup` `/invite/[token]`)は製品名「ClubLink」の共通ブランディングのみを表示し、特定チームの名称・配色は出さない
- ログイン後はチーム名(+ロゴ)をヘッダーに表示し、配色・ロゴはチームごとにカスタマイズ可能(`teams.theme_primary` / `theme_accent` / `logo_path`。管理者が「設定」タブから変更できる。未設定時はアプリ標準の落ち着いた配色を使う)
- 見出しフォントはCormorant(セリフ体)、本文はNoto Sans JP(Windows環境ではMeiryoを優先)、ラベル類はJetBrains Monoで、FAITH CREATIONのブランドトーンに合わせたシックな雰囲気を意図している
- ホーム画面に追加した際のアイコン(PWAアイコン・favicon・apple-touch-icon)はClubLink共通のもの。このアプリは1ドメインを複数チームで共有するマルチテナント構成のため、ホーム画面アイコン自体をチームごとに出し分けることはしていない(チームロゴはアプリ内のヘッダー等にのみ反映される)

## ディレクトリ構成

```
supabase/migrations/
  0001_init.sql        スキーマ・RLS・トリガー・RPC・Storageバケット一式
  0002_team_theme.sql   チームごとの配色カスタマイズ用の列・RLS
  0003_team_logo.sql    チームロゴアップロード用の列・Storageバケット・RLS
src/
  app/
    (auth)/login, signup, setup, invite/[token]  認証フロー(ClubLinkブランディング)
    (app)/schedule, notice, report,              予定・お知らせ・日報(全ロール)
          players, notes, game,                  選手・選手メモ・試合記録(指導者以上)
          users                                  ユーザー管理・招待リンク発行(管理者のみ)
          settings                               チーム設定: 配色・ロゴ(管理者のみ)
    auth/confirm, auth/complete                  メール確認リンクのコールバック
    icon.tsx, apple-icon.tsx, manifest.ts, icons/ PWAアイコン・マニフェスト(ClubLink共通)
  components/        AppHeader・TabBar・Card・Modal等の共通UI
  lib/
    supabase/client.ts, server.ts   ブラウザ/サーバー用Supabaseクライアント
    permissions.ts                  ロール→タブ・操作の可否(単一のソース)
    database.types.ts               Supabaseスキーマに対応する型定義
    teamLogo.ts                     チームロゴの公開URLを組み立てるヘルパー
```

## 既知の制約・今後の課題

- 招待リンクの発行UIは管理者向けの「ユーザー管理」タブにまとめている(仕様上は役員も発行可能で、DB・RLSレベルでは役員による発行も許可済み。役員向けの発行導線は未実装)
- 複数チーム所属ユーザーへの対応(チーム選択画面)は未実装
- 料金プラン・課金機能は未実装
- 配色設定を保存した直後は、反映のためページの再読み込みが必要(サーバーコンポーネントでチームの配色を読み込んでいるため)
- このリポジトリの開発環境にはDockerが無くローカルSupabaseスタックを起動できないため、実データベースに対する動作確認は行っていない。上記セットアップ手順に沿って実際のSupabaseプロジェクトに接続した上で、一連の操作(チーム作成→招待→出欠登録→お知らせ添付→選手登録→試合記録→ユーザー管理→配色・ロゴ設定)を確認すること
