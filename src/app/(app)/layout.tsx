import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionProvider } from "@/lib/session-context";
import { ToastProvider } from "@/components/ui/Toast";
import { TabBar } from "@/components/TabBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, team_id, name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/signup");

  return (
    <div className="app-shell">
      <SessionProvider
        value={{
          userId: profile.id,
          teamId: profile.team_id,
          name: profile.name,
          role: profile.role,
        }}
      >
        <ToastProvider>
          <div className="flex-1 flex flex-col min-h-0">{children}</div>
          <TabBar role={profile.role} />
        </ToastProvider>
      </SessionProvider>
    </div>
  );
}
