import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@/components/maxwell/studio-rd.css";

/**
 * Maxwell surface layout — applies the `-rd` scope (Geist sans/mono + neutral,
 * theme-aware tokens) to EVERY Maxwell route in one place: studio, the public
 * proposal, the client workspace, the prototype-decision page, and the internal
 * review screens. Single source of truth for the studio re-skin — see
 * `components/maxwell/studio-rd.css`. Wrapping div is layout-transparent
 * (viewport-height children like the studio shell are unaffected).
 */
export default function MaxwellLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} mxw-rd`}>
      {children}
    </div>
  );
}
