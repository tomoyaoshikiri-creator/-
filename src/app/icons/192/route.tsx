import { renderCircleLinesIcon } from "@/lib/brandIcon";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return renderCircleLinesIcon(192);
}
