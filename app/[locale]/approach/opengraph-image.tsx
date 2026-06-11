import { buildOg, OG_SIZE } from "@/lib/og-image";

export const alt = "The Noon approach";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return buildOg(
    "Practices for software that lasts.",
    "Scope first · AI as leverage · a person signs every change · code you own",
  );
}
