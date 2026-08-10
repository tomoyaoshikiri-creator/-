import { createClient } from "@/lib/supabase/server";
import { AuthHeading } from "../../AuthHeading";
import { InviteForm } from "./InviteForm";

const ROLE_LABEL: Record<string, string> = {
  一般: "保護者",
  指導者: "指導者",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_invite_info", { invite_token: token })
    .maybeSingle();

  if (error || !data || !data.valid) {
    return (
      <div>
        <AuthHeading />
        <div className="bg-white border border-line rounded-2xl p-5 text-[13px] text-ink-soft text-center">
          この招待リンクは無効か、有効期限が切れています。チームの管理者に新しいリンクの発行を依頼してください。
        </div>
      </div>
    );
  }

  const roleLabel = ROLE_LABEL[data.role] ?? data.role;

  return (
    <div>
      <AuthHeading />
      <div className="text-center text-[13px] text-ink-soft mb-4">
        <span className="font-bold text-navy">{data.team_name}</span> への招待({roleLabel}用)
      </div>
      <InviteForm token={token} roleLabel={roleLabel} />
    </div>
  );
}
