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

export const metadata = { title: "Noon — Design System Lab" };

export default function LabPage() {
  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} ${schibsted.variable}`}>
      <Gallery />
    </div>
  );
}
