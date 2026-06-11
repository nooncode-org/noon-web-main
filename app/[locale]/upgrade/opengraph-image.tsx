import { buildOg, OG_SIZE } from "@/lib/og-image";

export const alt = "Noon Upgrade";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return buildOg("Upgrade a live website with Maxwell.", "Scan, diagnose, and ship a stronger version of what you run.");
}
