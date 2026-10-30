"use client";

import Link from "next/link";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { SectionLabel, cardClass } from "@/components/ui/Card";
import { SettingsRow } from "@/components/SettingsRow";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { PlusIcon, SwitchIcon } from "@/components/icons";
import { canManageSettings } from "@/lib/permissions";

// 設定一覧画面のデザイン刷新(2026-10-29、UI/UX刷新・設定画面範囲のみ)。
// 既存の表示条件・権限判定・遷移先・退会画面の処理は一切変更していない。
//
// グルーピング: アカウント/チーム/サポート・規約/退会の4つに整理。
// 「チーム」はロールに関わらず常に表示する(新しいチームを作成は従来から
// 全ロールが利用できるため)。管理者専用の行(チーム設定・監査ログ・
// データエクスポート)は従来通りcanManageTeamで絞り込む。
//
// カード見た目は、共通<Card>コンポーネント(角丸6px、settings/team等が
// 引き続き使用)を変更せず、刷新済み他画面と同じcardClass(角丸14px)を
// この画面だけで使う。
export default function SettingsPage() {
  const { role, hasMultipleTeams } = useSession();
  const canManageTeam = canManageSettings(role);

  // タブレット/PC幅での2カラム化は管理者ロールのみ有効にする。管理者以外は
  // 「チーム」グループの行数が少なく(新しいチームを作成のみ、または+切替の
  // 最大2行)、2カラムにすると右側の空白ばかりが目立つ見た目になるため。
  const twoColumnLayout = canManageTeam;

  return (
    <PageShell header={<AppHeader title="設定" variant="detail" backHref="/home" />}>
      <div className="@container">
        <div
          className={
            twoColumnLayout
              ? "flex flex-col gap-3 @[640px]:grid @[640px]:grid-cols-2 @[640px]:items-start"
              : "flex flex-col gap-3"
          }
        >
          <div className="flex flex-col gap-3">
            <div>
              <SectionLabel>アカウント</SectionLabel>
              <div className={cardClass}>
                <SettingsRow href="/settings/name" label="表示名の変更" />
                <SettingsRow href="/settings/password" label="パスワードを変更" />
                <PushNotificationToggle />
              </div>
            </div>

            <div>
              <SectionLabel>チーム</SectionLabel>
              <div className={cardClass}>
                <SettingsRow href="/settings/teams/new" label="新しいチームを作成" icon={PlusIcon} />
                {hasMultipleTeams && (
                  <SettingsRow href="/select-team" label="所属チームを切り替える" icon={SwitchIcon} />
                )}
                {canManageTeam && (
                  <>
                    <SettingsRow href="/settings/team" label="チーム設定" />
                    <SettingsRow href="/settings/audit-log" label="監査ログ" />
                    <SettingsRow href="/settings/export" label="データをエクスポート" />
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>サポート・規約</SectionLabel>
            <div className={cardClass}>
              <SettingsRow href="/help" label="よくある質問" />
              <SettingsRow href="/privacy" label="プライバシーポリシー" />
              <SettingsRow href="/terms" label="利用規約" />
              <SettingsRow href="/tokushoho" label="特定商取引法に基づく表記" />
            </div>
          </div>
        </div>
      </div>

      {/*
        退会は不可逆な操作のため、日常操作のカードから分離し、ページ最下部に
        控えめな警告色のテキストリンクとして単独配置する(カードに入れない)。
        遷移先(/settings/leave-service)・確認処理自体は変更していない。
      */}
      <div className="text-center mt-4">
        <Link href="/settings/leave-service" className="text-caption text-danger-text underline">
          このサービスから退会する
        </Link>
      </div>
    </PageShell>
  );
}
