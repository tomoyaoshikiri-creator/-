import { renderCircleLinesIcon } from "@/lib/brandIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppleIcon() {
  return renderCircleLinesIcon(180);
}
