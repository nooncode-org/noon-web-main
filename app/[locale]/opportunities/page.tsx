import { SitePageFrame } from "@/app/_components/site/site-page-frame";
import { OpportunitiesContent } from "./opportunities-content";

// Server Component wrapper: renders the auth-aware chrome (`SitePageFrame`
// fetches the viewer server-side) and mounts the client page body as an
// island. Keeping `SitePageFrame` out of the client graph is what lets the
// user menu (avatar) resolve instead of falling back to the "Sign up" CTA.
export default function OpportunitiesPage() {
  return (
    <SitePageFrame>
      <OpportunitiesContent />
    </SitePageFrame>
  );
}
