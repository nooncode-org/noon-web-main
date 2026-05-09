import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSessionWithDetails } from "@/lib/upgrade/repositories";
import { UpgradeShell } from "@/components/upgrade/upgrade-shell";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const session = await getSessionWithDetails(id);
  if (!session) return { title: "Upgrade Your Website · Noon" };

  return {
    title: `Upgrade ${session.websiteUrlRaw} · Noon`,
  };
}

export default async function UpgradeSessionPage({ params }: Props) {
  const { id } = await params;

  const authSession = await auth();
  const viewerEmail = authSession?.user?.email?.trim().toLowerCase() ?? null;

  if (!viewerEmail) {
    redirect(`/signin?redirectTo=/upgrade/${encodeURIComponent(id)}`);
  }

  const session = await getSessionWithDetails(id);

  if (!session) notFound();

  // Ownership guard
  if (session.ownerEmail !== viewerEmail) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4">
      {/* Breadcrumb */}
      <nav className="mb-8 text-xs text-muted-foreground">
        <Link href="/upgrade" className="hover:text-foreground transition-colors">
          Upgrade Your Website
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground truncate max-w-xs inline-block align-bottom">
          {session.websiteUrlRaw}
        </span>
      </nav>

      <UpgradeShell initialSession={session} />
    </div>
  );
}
