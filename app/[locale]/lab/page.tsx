import { notFound } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Schibsted_Grotesk } from "next/font/google";
import "./lab.css";
import { Gallery } from "./gallery";

// The character-pole candidate for the font A/B (Söhne stand-in, free on Google
// Fonts). Swap in Söhne later when licensed.
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Internal design-tool page — keep out of the index (auditoría 2026-07 F5, MED).
export const metadata = {
  title: "Noon — Design System Lab",
  robots: { index: false, follow: false },
};

export default function LabPage() {
  // Same hard gate as the other internal benches (wspreview, tracepreview):
  // anywhere but `next dev` this page does not exist. The robots hint below
  // only asks crawlers to stay away — it does not stop anyone from opening it.
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} ${schibsted.variable}`}>
      <Gallery />
    </div>
  );
}
