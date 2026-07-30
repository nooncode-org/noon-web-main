"use client";

/**
 * The identity + settings trio the sidebar needs, in one place: the client's
 * profile state, the gear that goes in the sidebar footer, and the profile editor
 * that opens from either.
 *
 * It exists because those three were wired inline in `ProposalSidebar` (the
 * portal), which meant the signed-in HOME had no gear at all — so profile and
 * language were reachable only from inside a project, and a user with no project
 * yet could not set their own name or photo (owner, 2026-07-30). Rather than
 * paste the same state + dialog into `StudioDashboard`, both mount this.
 *
 * A hook, not a component, because the two pieces belong in DIFFERENT places:
 * `settingsGear` has to sit inside the sidebar's footer (as `footerExtra`) while
 * `profileDialog` is a portal-level sibling. Returning nodes lets each caller put
 * them where they go.
 */

import { useState, type ReactNode } from "react";
import {
  WorkspaceProfileDialog,
  type ClientProfile,
} from "@/components/maxwell/workspace-profile-dialog";
import { WorkspaceSettingsDialog } from "@/components/maxwell/workspace-settings-dialog";

export type AccountSettingsProjectScope = {
  invoiceUrl?: string | null;
  isMembership?: boolean;
  membershipBadge?: { label: string; color: string } | null;
  advancedUnlocked?: boolean;
  billingSlot?: ReactNode;
  sessionId?: string;
};

export function useAccountSettings({
  viewerEmail,
  viewerName,
  scope,
}: {
  viewerEmail: string;
  viewerName?: string | null;
  /**
   * The project this panel belongs to. OMIT for account mode (the home): the
   * panel then shows only profile, language and the plan-agnostic email
   * preference, and Billing / Project data disappear.
   */
  scope?: AccountSettingsProjectScope;
}) {
  // Front only (logic later): persistence is deferred. State lives here so every
  // sidebar mount on the page (rail + drawer) shares one identity.
  const [profile, setProfile] = useState<ClientProfile>({
    name: viewerName ?? "",
    photoUrl: null,
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const openProfile = () => setProfileOpen(true);

  const settingsGear: ReactNode = (
    <WorkspaceSettingsDialog
      accountOnly={!scope}
      invoiceUrl={scope?.invoiceUrl}
      isMembership={scope?.isMembership}
      membershipBadge={scope?.membershipBadge}
      advancedUnlocked={scope?.advancedUnlocked}
      billingSlot={scope?.billingSlot}
      sessionId={scope?.sessionId}
      profile={{ name: profile.name, photoUrl: profile.photoUrl, email: viewerEmail }}
      onEditProfile={openProfile}
    />
  );

  const profileDialog: ReactNode = (
    <WorkspaceProfileDialog
      open={profileOpen}
      onOpenChange={setProfileOpen}
      email={viewerEmail}
      profile={profile}
      onSave={setProfile}
    />
  );

  return { profile, openProfile, settingsGear, profileDialog };
}
