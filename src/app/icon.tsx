import { renderCircleLinesIcon } from "@/lib/brandIcon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Icon() {
  return renderCircleLinesIcon(32);
}
