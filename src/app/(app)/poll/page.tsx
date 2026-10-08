"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session-context";
import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { Card, EmptyState, SectionLabel } from "@/components/ui/Card";
import { Fab } from "@/components/ui/Modal";
import { ChevronRightIcon } from "@/components/icons";
import { canCreatePoll } from "@/lib/permissions";
import { pollStatusLabel } from "@/lib/polls";
import { formatDateLabel } from "@/lib/format";
import type { Poll } from "@/lib/database.types";

export default function PollListPage() {
  const router = useRouter();
  const { role } = useSession();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("polls").select("*").order("created_at", { ascending: false });
    setPolls(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openPolls = polls.filter((p) => p.status === "open");
  const closedPolls = polls.filter((p) => p.status === "closed");

  function PollRow({ poll }: { poll: Poll }) {
    return (
      <Link href={`/poll/${poll.id}`}>
        <Card className="cursor-pointer">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-bold text-[14.5px] truncate">{poll.title}</div>
              <div className="text-[11px] text-ink-soft mt-0.5">{formatDateLabel(poll.created_at.slice(0, 10))}</div>
            </div>
            <div className="flex items-center gap-1.5 flex-none">
              <span
                className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                  poll.status === "open" ? "bg-orange/10 text-orange" : "bg-line text-ink-soft"
                }`}
              >
                {pollStatusLabel(poll.status)}
              </span>
              <ChevronRightIcon className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" />
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <PageShell
      header={<AppHeader title="投票" variant="list" backHref="/team" />}
      fab={canCreatePoll(role) && <Fab onClick={() => router.push("/poll/new")} label="投票を作成" />}
    >
      {loading ? (
        <EmptyState>読み込み中…</EmptyState>
      ) : polls.length === 0 ? (
        <EmptyState>まだ投票がありません</EmptyState>
      ) : (
        <>
          {openPolls.length > 0 && (
            <>
              <SectionLabel>受付中</SectionLabel>
              {openPolls.map((p) => (
                <PollRow key={p.id} poll={p} />
              ))}
            </>
          )}
          {closedPolls.length > 0 && (
            <>
              <SectionLabel>締切済み</SectionLabel>
              {closedPolls.map((p) => (
                <PollRow key={p.id} poll={p} />
              ))}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
