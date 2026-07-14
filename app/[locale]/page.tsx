import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { StudioDashboard } from "@/components/maxwell/studio-dashboard";
import { getAuthenticatedViewer } from "@/lib/auth/session";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const [{ locale }, viewer] = await Promise.all([
    params,
    getAuthenticatedViewer(),
  ]);

  // v0-style: the home transforms with auth. Signed-in visitors get their app
  // dashboard (chats hub sidebar + a launcher composer) right here on `/` —
  // same URL, different surface. The composer / a recent chat navigates into
  // the conversation at /maxwell. Signed-out visitors get the marketing home.
  if (viewer) {
    return <StudioDashboard viewerEmail={viewer.email} locale={locale} />;
  }

  return (
    // Geist scoped to the home so the hero matches the redesigned pages
    // (Work/Templates/About). --font-geist-sans/mono are set by the .variable
    // classes; font-family makes the whole home (nav + hero + chips) inherit it.
    <main
      className={`${GeistSans.variable} ${GeistMono.variable} home-single relative h-dvh overflow-hidden bg-background`}
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      <Navigation viewer={viewer} />
      <HeroSection />

      {/* Framed-page identity (Work/Templates/About) brought to the home so the
          single-screen hero reads intentional. Desktop only; pointer-events none. */}
      <div className="home-frame" aria-hidden />
    </main>
  );
}
