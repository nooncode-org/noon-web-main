"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { StudioSidebar, type StudioDraftSession } from "./studio-sidebar";
import {
  WorkspaceProfileDialog,
  type ClientProfile,
} from "@/components/maxwell/workspace-profile-dialog";
import { WorkspaceSettingsDialog } from "@/components/maxwell/workspace-settings-dialog";
import { getContactHref } from "@/lib/site-config";

// Mirrors the shape the studio dashboard maps from GET /api/maxwell/studio/sessions.
type SessionSummary = {
  id: string;
  goal_summary: string | null;
  initial_prompt: string;
  updated_at: string;
  has_client_workspace: boolean;
  proposal_public_token: string | null;
};

/**
 * The studio's account/chats sidebar (the same StudioSidebar the dashboard and
 * chat use) mounted on the public proposal page — a ▢ toggle top-left that opens
 * an overlay drawer. The proposal is only reachable by a signed-in viewer, so
 * this is their real studio navigation (their scoping chats, account, sign out).
 * Rendered only when a viewer exists (see the proposal page).
 *
 * `collapsibleRail` (client workspace / portal): mirrors the studio dashboard —
 * on lg+ the ▢ toggle expands a PUSH rail (a flex child that reflows the content
 * beside it, no overlay); below lg it's the overlay drawer. Both start collapsed.
 * The host must be a flex row (the rail renders as its first flex child). Without
 * the flag (proposal page) the ▢ opens the overlay drawer at all widths.
 */
export function ProposalSidebar({
  viewerEmail,
  viewerName = null,
  locale,
  collapsibleRail = false,
  settings,
}: {
  viewerEmail: string;
  /** Client display name — seeds the editable profile (workspace portal). */
  viewerName?: string | null;
  locale: string;
  collapsibleRail?: boolean;
  /**
   * When set, renders the project-settings gear (WorkspaceSettingsMenu) in the
   * sidebar footer, wired to the profile state owned here (identity row + edit
   * opener). Serializable so server pages can pass it. Absent → no gear
   * (proposal page).
   */
  settings?: {
    invoiceUrl?: string | null;
    isMembership?: boolean;
    /** Plan-state pill on the Billing card (label + token classes). */
    membershipBadge?: { label: string; color: string } | null;
    /** Sensitive project actions stay locked until the Noon team enables them. */
    advancedUnlocked?: boolean;
    /** Real billing action (e.g. the Stripe portal opener) for the Billing card. */
    billingSlot?: ReactNode;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false); // overlay drawer (mobile in rail mode; all widths otherwise)
  const [railOpen, setRailOpen] = useState(false); // desktop push rail (rail mode only)
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  // Client profile (name + photo) — editable via the sidebar identity. Front
  // only (logic later): persistence is deferred; state lives here so both
  // sidebar mounts (rail + drawer) share one identity.
  const [profile, setProfile] = useState<ClientProfile>({
    name: viewerName ?? "",
    photoUrl: null,
  });
  const [profileOpen, setProfileOpen] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/maxwell/studio/sessions", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { sessions: SessionSummary[] };
      setSessions(data.sessions);
    } catch {
      // ignore — an empty/failed list just shows no recent chats.
    }
  }
  useEffect(() => {
    // Prefetch the chats list so the drawer opens warm. setState happens in the
    // fetch callback, not synchronously — the rule false-positives on the
    // helper being invoked from the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(
        `/api/maxwell/studio/sessions?session_id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (res.ok) void refresh();
    } catch {
      // ignore
    }
  }

  const maxwellHref = (qs = "") => `/${locale}/maxwell${qs}`;
  const agentHref = getContactHref({ inquiry: "new-project", source: "maxwell-proposal-agent" });

  const draftSessions: StudioDraftSession[] = sessions.map((s) => ({
    id: s.id,
    title:
      (s.goal_summary || s.initial_prompt).replace(/\s+/g, " ").trim().slice(0, 88) || "Conversation",
    updatedAt: s.updated_at,
    workspaceHref: s.has_client_workspace ? `/${locale}/maxwell/workspace/${s.id}` : null,
    proposalHref:
      s.proposal_public_token && !s.has_client_workspace
        ? `/${locale}/maxwell/proposal/${s.proposal_public_token}`
        : null,
  }));

  const footerExtra: ReactNode = settings ? (
    <WorkspaceSettingsDialog
      invoiceUrl={settings.invoiceUrl}
      isMembership={settings.isMembership}
      membershipBadge={settings.membershipBadge}
      advancedUnlocked={settings.advancedUnlocked}
      billingSlot={settings.billingSlot}
      profile={{ name: profile.name, photoUrl: profile.photoUrl, email: viewerEmail }}
      onEditProfile={() => setProfileOpen(true)}
    />
  ) : null;

  const sidebarProps = {
    viewerEmail,
    viewerName: profile.name || null,
    viewerPhotoUrl: profile.photoUrl,
    onEditProfile: () => setProfileOpen(true),
    locale,
    agentHref,
    draftSessions,
    currentSessionId: null,
    onSelectDraftSession: (id: string) =>
      router.push(maxwellHref(`?session_id=${encodeURIComponent(id)}`)),
    onNewDraftChat: () => router.push(maxwellHref()),
    onDeleteDraftSession: handleDelete,
    quotaSnapshot: null,
    // The proposal page is NOT the home, so offer a Home link back to the studio.
    showHome: true,
    footerExtra,
  };

  // Rail mode hides the overlay pieces on lg+ (the push rail takes over there).
  const overlayLgHidden = collapsibleRail ? " lg:hidden" : "";

  return (
    <>
      {/* Toggle (floats top-left). Mobile always opens the overlay drawer. */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void refresh();
        }}
        aria-label="Open menu"
        className={`fixed left-3 top-3 z-40 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground${overlayLgHidden}`}
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      {/* Rail mode, desktop: a separate expand button, shown only while the rail
          is collapsed (when open, the sidebar's own button collapses it — one
          panel icon at a time). */}
      {collapsibleRail && !railOpen && (
        <button
          type="button"
          onClick={() => {
            setRailOpen(true);
            void refresh();
          }}
          aria-label="Expand sidebar"
          className="fixed left-3 top-3 z-40 hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground lg:flex"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}

      {/* Rail mode, desktop: the PUSH rail — a flex child of the host row, so
          showing/hiding it reflows the content beside it (no overlay). */}
      {collapsibleRail && railOpen && (
        <div className="hidden h-full w-72 shrink-0 border-r border-border/70 lg:flex">
          <StudioSidebar {...sidebarProps} onClose={() => setRailOpen(false)} className="bg-background" />
        </div>
      )}

      {/* Overlay drawer — all widths without the flag, mobile-only with it.
          Open/closed via INLINE styles so the closed state is guaranteed on the
          first paint even before the stylesheet applies (no FOUC flash-open). */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[998] transition-opacity duration-300${overlayLgHidden}`}
        style={{
          backgroundColor: "rgba(0,0,0,0.25)",
          backdropFilter: "blur(2px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={() => setOpen(false)}
      />
      {/* `inert` while closed: opacity/pointer-events hide it visually but its
          links would otherwise stay keyboard-tabbable + readable to AT. */}
      <div
        inert={!open}
        className={`fixed bottom-1.5 left-1.5 top-1.5 z-[999] w-72 transition-all duration-300${overlayLgHidden}`}
        style={{
          transform: open ? "translateX(0)" : "translateX(-110%)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <StudioSidebar
          {...sidebarProps}
          onClose={() => setOpen(false)}
          onNavigate={() => setOpen(false)}
          className="rounded-[10px] border border-foreground/10 bg-background/95 shadow-2xl backdrop-blur-xl"
        />
      </div>

      {/* Client profile editor — opened from the sidebar identity. */}
      <WorkspaceProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        email={viewerEmail}
        profile={profile}
        onSave={setProfile}
      />
    </>
  );
}
