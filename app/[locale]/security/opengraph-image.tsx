import { buildOg, OG_SIZE } from "@/lib/og-image";

export const alt = "Noon — security & ownership";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return buildOg("Your code, reviewed by people.", "Human review, full code & IP ownership, certified infrastructure.");
}
