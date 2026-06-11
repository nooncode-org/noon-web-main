import { buildOg, OG_SIZE } from "@/lib/og-image";

export const alt = "About Noon";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return buildOg("AI speed. Human judgment.", "A technology development company built around real delivery.");
}
