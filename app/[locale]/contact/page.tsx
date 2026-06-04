import { Suspense } from "react";
import { SitePageFrame } from "@/app/_components/site/site-page-frame";
import { ContactPageContent, ContactPageSkeleton } from "./contact-content";

// Server Component wrapper: renders the auth-aware chrome (`SitePageFrame`
// fetches the viewer server-side) and mounts the client page body as an
// island. The Suspense boundary lives here (not inside the client body) so
// the chrome — including the resolved user menu (avatar) — renders immediately
// while the search-param-dependent form streams in. Keeping `SitePageFrame`
// out of the client graph is what fixes the "Sign up" fallback bug.
export default function ContactPage() {
  return (
    <SitePageFrame>
      <Suspense fallback={<ContactPageSkeleton />}>
        <ContactPageContent />
      </Suspense>
    </SitePageFrame>
  );
}
