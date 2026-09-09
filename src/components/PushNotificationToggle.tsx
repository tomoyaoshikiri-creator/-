"use client";

import { useToast } from "@/components/ui/Toast";
import { Switch } from "@/components/ui/Switch";
import { usePushSubscription } from "@/lib/usePushSubscription";

export function PushNotificationToggle() {
  const toast = useToast();
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushSubscription();

  async function handleToggle() {
    if (subscribed) {
      await unsubscribe();
      toast("通知を無効にしました");
      return;
    }
    const result = await subscribe();
    if (result === "subscribed") toast("通知を有効にしました");
    else if (result === "permission_denied") toast("通知が許可されませんでした");
    else toast("通知の登録に失敗しました");
  }

  if (!supported) return null;

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-line last:border-b-0">
      <div className="font-bold text-[13.5px]">プッシュ通知</div>
      <Switch checked={subscribed} onChange={handleToggle} disabled={loading} />
    </div>
  );
}
