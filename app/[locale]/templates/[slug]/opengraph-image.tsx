import { buildOg, OG_SIZE } from "@/lib/og-image";
import { templatesCatalog, templates } from "@/data/templates";

export const alt = "Noon template";
export const size = OG_SIZE;
export const contentType = "image/png";

// Per-template og card: the template's name + its real one-line summary
// (truncated to keep the card breathing). Unknown slugs fall back to the
// templates-index framing.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t =
    templatesCatalog.find((item) => item.slug === slug) ?? templates.find((item) => item.slug === slug);
  const title = t?.name ?? "Starting points for real software.";
  const raw = t?.summary ?? "Pre-defined scopes, delivered as production code you own.";
  const subtitle = raw.length > 110 ? `${raw.slice(0, 107).trimEnd()}…` : raw;
  return buildOg(title, subtitle);
}
