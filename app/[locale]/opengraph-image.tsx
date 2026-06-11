import { buildOg, OG_SIZE } from "@/lib/og-image";

export const alt = "Noon — the code-first software company";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return buildOg("Tell us what you want to build.", "Custom software in real code — AI-accelerated, human-reviewed.");
}
