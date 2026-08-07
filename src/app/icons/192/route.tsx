import { renderAppIcon } from "@/lib/brandIcon";

export async function GET() {
  return renderAppIcon(192);
}
