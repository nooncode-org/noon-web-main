import { getAuthenticatedViewer } from "@/lib/auth/session";
import { SiteNavRd } from "./site-nav-rd";

type SiteNavProps = {
  locale: string;
  active?: "services" | "about" | "contact";
};

/**
 * Server wrapper for SiteNavRd — resolves the viewer's auth state so the nav
 * renders its signed-in variant (studio nav: no marketing links, CTA → Studio)
 * instead of the marketing sign-up CTA. Use this on server pages; the
 * interactive SiteNavRd stays a client component. (The client error boundary
 * can't await this, so it keeps rendering SiteNavRd directly — marketing nav.)
 */
export async function SiteNav({ locale, active }: SiteNavProps) {
  const viewer = await getAuthenticatedViewer();
  return <SiteNavRd locale={locale} active={active} signedIn={Boolean(viewer)} />;
}
