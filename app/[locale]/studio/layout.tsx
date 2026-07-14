import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@/components/maxwell/studio-rd.css";

/**
 * Studio layout — the signed-in app surface, moved from /maxwell/studio to
 * /studio (2026-07-13). Replicates what app/[locale]/maxwell/layout.tsx
 * provides so the studio keeps the `-rd` scope after leaving /maxwell/:
 * Geist sans/mono variables + the `mxw-rd` token scope from
 * `components/maxwell/studio-rd.css`. The remaining Maxwell routes
 * (proposal / workspace / prototipo / review) still inherit theirs from
 * the maxwell layout. Wrapping div is layout-transparent (viewport-height
 * children like the studio shell are unaffected).
 */
export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} mxw-rd`}>
      {children}
    </div>
  );
}
