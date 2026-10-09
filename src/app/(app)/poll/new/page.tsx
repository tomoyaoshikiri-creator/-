"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, SectionLabel } from "@/components/ui/Card";
import { FieldLabel, SubmitButton, inputClass } from "@/components/ui/SegButton";
import { Switch } from "@/components/ui/Switch";
import { canCreatePoll } from "@/lib/permissions";
import { POLL_ROLE_OPTIONS } from "@/lib/polls";
import { sendPushNotification } from "@/lib/pushNotify";
import { playerFullName, sortPlayers } from "@/lib/format";
import type { Player, Role } from "@/lib/database.types";

export default function NewPollPage() {
  const router = useRouter();
  const { teamId, userId, role } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (!canCreatePoll(role)) router.replace("/poll");
  }, [role, router]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [multiSelect, setMultiSelect] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState<Role[]>([...POLL_ROLE_OPTIONS]);
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [saving, setSaving] = useState(false);

  const [players, setPlayers] = useState<Player[]>([]);
  const [playerPickerOpen, setPlayerPickerOpen] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!playerPickerOpen || players.length > 0) return;
    const supabase = createClient();
    supabase
      .from("players")
      .select("*")
      .eq("status", "在籍")
      .then(({ data }) => setPlayers(sortPlayers(data ?? [])));
  }, [playerPickerOpen, players.length]);

  function toggleRole(r: Role) {
    setAllowedRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function addEmptyOption() {
    setOptions((prev) => [...prev, ""]);
  }

  function togglePlayerSelected(id: string) {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelectedPlayersAsOptions() {
    const added = sortPlayers(players.filter((p) => selectedPlayerIds.has(p.id))).map(
      (p) => `#${p.number ?? "-"} ${playerFullName(p)}`,
    );
    setOptions((prev) => [...prev.filter((o) => o.trim() !== ""), ...added]);
    setSelectedPlayerIds(new Set());
    setPlayerPickerOpen(false);
  }

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    const trimmedOptions = options.map((o) => o.trim()).filter((o) => o !== "");
    if (!trimmedTitle) {
      toast("タイトルを入力してください");
      return;
    }
    if (trimmedOptions.length < 2) {
      toast("選択肢を2つ以上入力してください");
      return;
    }
    if (allowedRoles.length === 0) {
      toast("投票できるロールを1つ以上選んでください");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data: poll, error } = await supabase
      .from("polls")
      .insert({
        team_id: teamId,
        created_by: userId,
        title: trimmedTitle,
        description: description.trim() || null,
        multi_select: multiSelect,
        anonymous,
        allowed_roles: allowedRoles,
      })
      .select()
      .single();
    if (error || !poll) {
      setSaving(false);
      toast(`作成に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    const { error: optionsError } = await supabase
      .from("poll_options")
      .insert(trimmedOptions.map((label, position) => ({ poll_id: poll.id, label, position })));
    if (optionsError) {
      await supabase.from("polls").delete().eq("id", poll.id);
      setSaving(false);
      toast(`選択肢の登録に失敗しました: ${optionsError.message}`);
      return;
    }
    setSaving(false);
    toast("投票を作成しました");
    sendPushNotification("poll_created", poll.id);
    router.push(`/poll/${poll.id}`);
  }

  return (
    <PageShell header={<AppHeader title="投票を作成" variant="detail" backHref="/poll" />}>
      <SectionLabel>内容</SectionLabel>
      <Card>
        <FieldLabel>タイトル</FieldLabel>
        <input className={inputClass()} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例:次の合宿先はどこがいい?" />

        <div className="mt-3">
          <FieldLabel>説明(任意)</FieldLabel>
          <textarea
            className={inputClass()}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between mt-3.5">
          <div>
            <div className="text-[13px] font-bold">複数選択を許可</div>
            <div className="text-[11px] text-ink-soft mt-0.5">オフの場合は1つだけ選べます</div>
          </div>
          <Switch checked={multiSelect} onChange={setMultiSelect} />
        </div>

        <div className="flex items-center justify-between mt-3">
          <div>
            <div className="text-[13px] font-bold">匿名投票</div>
            <div className="text-[11px] text-ink-soft mt-0.5">締め切り後も誰が何に投票したかは表示しません</div>
          </div>
          <Switch checked={anonymous} onChange={setAnonymous} />
        </div>
      </Card>

      <SectionLabel>投票できるロール</SectionLabel>
      <Card>
        <div className="flex flex-wrap gap-2">
          {POLL_ROLE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toggleRole(r)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold border ${
                allowedRoles.includes(r) ? "border-orange text-orange bg-orange/8" : "border-line text-ink-soft bg-paper"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </Card>

      <SectionLabel
        action={
          <button
            type="button"
            onClick={() => setPlayerPickerOpen((v) => !v)}
            className="flex-none text-[11px] font-bold text-orange border border-orange rounded-full px-2.5 py-1 bg-orange/8"
          >
            選手名簿から追加
          </button>
        }
      >
        選択肢
      </SectionLabel>
      {playerPickerOpen && (
        <Card>
          {players.length === 0 ? (
            <div className="text-[12.5px] text-ink-soft">選手がいません</div>
          ) : (
            <>
              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {players.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={selectedPlayerIds.has(p.id)}
                      onChange={() => togglePlayerSelected(p.id)}
                    />
                    #{p.number ?? "-"} {playerFullName(p)}
                  </label>
                ))}
              </div>
              <SubmitButton onClick={addSelectedPlayersAsOptions} disabled={selectedPlayerIds.size === 0}>
                選択肢として追加({selectedPlayerIds.size}人)
              </SubmitButton>
            </>
          )}
        </Card>
      )}
      <Card>
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={inputClass()}
                value={o}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`選択肢${i + 1}`}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="flex-none font-bold text-[12px]"
                  style={{ color: "var(--danger)" }}
                >
                  削除
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addEmptyOption}
          className="w-full mt-2.5 text-center py-2 rounded-lg font-bold text-[12.5px] border border-line text-ink-soft bg-paper"
        >
          + 選択肢を追加
        </button>
      </Card>

      <SubmitButton onClick={handleSubmit} disabled={saving}>
        {saving ? "作成中…" : "この投票を作成する"}
      </SubmitButton>
    </PageShell>
  );
}
