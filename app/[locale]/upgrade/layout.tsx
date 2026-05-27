import type { ReactNode } from "react";
import { UpgradeLayoutChrome } from "@/components/upgrade/upgrade-layout-chrome";
import { getAuthenticatedViewer } from "@/lib/auth/session";

/**
 * /upgrade uses the site navigation but no footer.
 * The flow should feel like a focused product workspace.
 */
export default async function UpgradeLayout({ children }: { children: ReactNode }) {
  const viewer = await getAuthenticatedViewer();
  return <UpgradeLayoutChrome viewer={viewer}>{children}</UpgradeLayoutChrome>;
}
