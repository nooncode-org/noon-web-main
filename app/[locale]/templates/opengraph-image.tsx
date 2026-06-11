import { buildOg, OG_SIZE } from "@/lib/og-image";

export const alt = "Noon templates";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return buildOg("Starting points for real software.", "Pre-defined scopes, delivered as production code you own.");
}
