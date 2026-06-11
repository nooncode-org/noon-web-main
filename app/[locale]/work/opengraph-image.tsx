import { buildOg, OG_SIZE } from "@/lib/og-image";

export const alt = "Noon — selected work";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return buildOg("Real software, shipped and reviewed.", "Case studies across 11 sectors — every build human-reviewed.");
}
