import { AppHeader } from "@/components/AppHeader";
import { PageShell } from "@/components/PageShell";
import { NewTeamForm } from "./NewTeamForm";

export default function NewTeamPage() {
  return (
    <PageShell header={<AppHeader title="新しいチームを作成" variant="detail" backHref="/settings" />}>
      <NewTeamForm />
    </PageShell>
  );
}
