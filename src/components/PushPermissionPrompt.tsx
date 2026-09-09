"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { usePushSubscription } from "@/lib/usePushSubscription";

const DISMISS_KEY = "pushPromptDismissedAt";
const DISMISS_COOLDOWN_MS = 10 * 24 * 60 * 60 * 1000;

function withinCooldown() {
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
}

// 未購読の端末に対して、ホーム画面表示のたびに通知許可を促すバナー。
// 「許可する」タップをそのままブラウザの許可ダイアログにつなげる(ユーザー操作からの
// 直接呼び出しでないとNotification.requestPermission()は動かないため)。
export function PushPermissionPrompt() {
  const toast = useToast();
  const { checked, supported, subscribed, loading, subscribe } = usePushSubscription();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!checked || !supported || subscribed) return;
    if (typeof Notification === "undefined" || Notification.permission === "denied") return;
    if (withinCooldown()) return;
    setOpen(true);
  }, [checked, supported, subscribed]);

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  }

  async function handleAllow() {
    const result = await subscribe();
    if (result === "subscribed") toast("通知を有効にしました");
    else if (result === "permission_denied") toast("通知が許可されませんでした");
    else if (result === "error") toast("通知の登録に失敗しました");
    dismiss();
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={dismiss} title="通知を有効にしますか?">
      <div className="text-[13px] text-ink-soft mb-4">
        日報やメモへのコメント・リアクションなどをプッシュ通知でお知らせします。あとから設定画面でいつでも変更できます。
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="flex-1 py-2.5 rounded-lg border border-line text-ink-soft font-bold text-[13px] active:opacity-85"
        >
          後で
        </button>
        <button
          type="button"
          onClick={handleAllow}
          disabled={loading}
          className="flex-1 py-2.5 rounded-lg border border-orange text-white font-bold text-[13px] active:opacity-85 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, var(--orange) 0%, color-mix(in srgb, var(--orange) 55%, white) 100%)",
          }}
        >
          許可する
        </button>
      </div>
    </Modal>
  );
}
