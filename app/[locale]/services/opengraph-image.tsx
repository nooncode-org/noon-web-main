import { buildOg, OG_SIZE } from "@/lib/og-image";

export const alt = "Noon services";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return buildOg("Four ways from problem to working software.", "Custom Development · Upgrade · Engineering Support · Technology Audit");
}
