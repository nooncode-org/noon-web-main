"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { submitRequestAction } from "@/app/[locale]/maxwell/workspace/[sessionId]/_actions/submit-request";
import { setPortalLanguageAction } from "@/app/[locale]/maxwell/_actions/set-portal-language";
import {
  portalSupportChatFallback,
  portalSupportRequest,
  type PortalSupportRequestKind,
} from "@/lib/maxwell/portal-support-requests";
import { CreditCard, Download, FileText, MessageCircle, Settings } from "lucide-react";
import { goToWorkspaceChat } from "@/components/maxwell/workspace-chat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { initialsOf } from "@/components/maxwell/workspace-profile-dialog";

// Launched locales only (en + es), native name + region like Claude's list.
// fr/de are declared in routing but gated (translations lag) — they join this
// list when their catalogs are ready.
const LANGUAGES: { code: "en" | "es"; label: string }[] = [
  { code: "en", label: "English (US)" },
  { code: "es", label: "Español (Latinoamérica)" },
];

type SectionKey = "general" | "billing" | "data";

/**
 * WorkspaceSettingsDialog — the portal's project-scoped settings (NOT a fifth
 * tab: the portal stays consolidated at 4 sections — owner decision
 * 2026-07-18). The gear lives in the studio sidebar footer, next to Sign
 * out/Home, and opens THIS panel.
 *
 * Shape follows Vercel's settings area (owner reference 2026-07-20): a left
 * sub-navigation, and each sub-page stacks cards of title + explanation +
 * control, closed by a footer strip carrying the caveat and the action.
 *
 * Placement of the destructive action is the point of the structure: "Cancel
 * membership" sits at the BOTTOM of the Billing sub-page, in a red danger zone
 * you have to navigate AND scroll to reach — where Vercel keeps Delete Account.
 * It used to be one click away in a dropdown. It stays reachable on purpose:
 * hiding cancellation any further is a dark pattern (and "click to cancel"
 * rules require it be as easy as subscribing).
 *
 * What is REAL vs still front-only here (2026-07-30):
 *   - Cancellation + export DO file a request now (see `fileRequest`), and a
 *     failure keeps the dialog open with the reason. They used to close silently.
 *   - "Manage billing" is real — it opens the Stripe Billing Portal.
 *   - Still local state only: the email toggles and the language select. Nothing
 *     persists them, so they reset on reload.
 *
 * Per-modality (owner roadmap): a ONE-TIME buyer has nothing recurring, so the
 * danger zone is hidden for them and billing is just their invoice; a
 * MEMBERSHIP client gets "Manage billing" (→ the Stripe portal) + the cancel flow.
 *
 * Refunds are deliberately NOT here: those go through a conversation with the
 * team (owner decision 2026-07-20).
 */
export function WorkspaceSettingsDialog({
  invoiceUrl,
  isMembership = false,
  membershipBadge,
  advancedUnlocked = false,
  billingSlot,
  sessionId,
  accountOnly = false,
  profile,
  onEditProfile,
}: {
  invoiceUrl?: string | null;
  /** true → membership plan (recurring): shows Manage billing + the danger zone. */
  isMembership?: boolean;
  /**
   * Real billing action (the workspace page passes <ManageMembershipButton/> —
   * the Stripe Billing Portal opener). Takes the Billing card's action seat;
   * absent → the mock's invoiceUrl link.
   */
  billingSlot?: ReactNode;
  /** Plan state pill on the Billing card (the reference's Active/Inactive chip). */
  membershipBadge?: { label: string; color: string } | null;
  /**
   * Unlocks the project-data actions for THIS project. Off by default: the
   * client contacts the team, the team flips it. TODO(logic later): read from
   * the session/proposal row so it survives a reload and is auditable.
   */
  advancedUnlocked?: boolean;
  /** Client identity for the profile card. */
  profile?: { name: string; photoUrl: string | null; email: string };
  /** Opens the profile editor (the sidebar owns that dialog + its state). */
  onEditProfile?: () => void;
  /**
   * The studio session this portal belongs to. Its PRESENCE is what makes the
   * cancellation and export buttons real: with it they file a support request
   * that reaches the Noon team; without it they hand the client to the chat.
   * Present on the live workspace only — absent on the proposal page and on the
   * wspreview mock, which must never file real requests.
   */
  sessionId?: string;
  /**
   * ACCOUNT mode (the signed-in home). Shows only what belongs to the person
   * rather than to a project: profile, language, and the one email preference
   * that isn't plan-specific.
   *
   * Why it exists: profile and language were reachable ONLY from inside a
   * project, so a user with no project yet had no way to set their own name or
   * photo (owner spotted it 2026-07-30). Billing and Project data stay hidden
   * here — without a project there is nothing to bill or export.
   */
  accountOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<SectionKey>("general");
  // Set when closing hands the client to another surface (the chat composer),
  // so the dialog doesn't yank focus back to the gear on its way out.
  const handingOff = useRef(false);
  const [notifyVersions, setNotifyVersions] = useState(true);
  const [notifyChat, setNotifyChat] = useState(true);
  // One-time buyer's only recurring event is the yearly hosting/domain renewal.
  const [notifyRenewal, setNotifyRenewal] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [exportRequested, setExportRequested] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  /** Why the last submission failed, shown in the confirm dialog it came from. */
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, startTransition] = useTransition();
  // Portal language (owner ask 2026-07-19, wired 2026-08-07).
  //
  // The initial value is the locale being SERVED, not a stored preference:
  // those are the same thing once a choice has been made (the cookie decides
  // what gets served), and before that the served locale is the browser's own
  // — which is the honest default to show.
  const t = useTranslations("workspace.settings");
  const tA11y = useTranslations("workspace.a11y");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [language, setLanguage] = useState<"en" | "es">(locale === "es" ? "es" : "en");
  const [isSwitchingLanguage, startLanguageTransition] = useTransition();

  function changeLanguage(next: "en" | "es") {
    if (next === language) return;
    const previous = language;
    setLanguage(next); // optimistic: the select must not lag behind the click
    startLanguageTransition(async () => {
      const result = await setPortalLanguageAction({ language: next, sessionId });
      if (!result.ok) {
        setLanguage(previous);
        return;
      }
      // Swap the locale segment of the CURRENT path and reload it: the cookie
      // alone only decides where a locale-less visit lands, so without this the
      // client would sit on the old URL watching nothing happen.
      const rest = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "");
      router.replace(`/${next}${rest || ""}`);
      router.refresh();
    });
  }

  // Billing only exists for a client who has something to bill — otherwise the
  // sub-page would be an empty shell.
  const sections: { key: SectionKey; label: string; blurb: string }[] = [
    { key: "general", label: t("general"), blurb: t("generalBlurb") },
    // Both of these are PROJECT-scoped, so account mode drops them outright
    // rather than relying on the flags below (a future caller could pass an
    // invoiceUrl into account mode and resurrect an empty Billing tab).
    ...(!accountOnly && (invoiceUrl || isMembership)
      ? [{ key: "billing" as const, label: t("billing"), blurb: t("billingBlurb") }]
      : []),
    // Project-data export is the team-mediated path for clients who don't hold
    // their code directly (membership). A one-time buyer OWNS their code outright
    // (the Overview's "Your code" card — download + repo), so a gated "ask the
    // team to enable export" would be redundant and contradictory. Hidden for them.
    ...(!accountOnly && isMembership
      ? [{ key: "data" as const, label: t("data"), blurb: t("dataBlurb") }]
      : []),
  ];
  const active = sections.find((s) => s.key === section) ?? sections[0];

  /**
   * File a real request with the Noon team.
   *
   * Both of these used to be front-only: the dialog closed and NOTHING happened.
   * For the export that meant waiting for an email that never came; for the
   * cancellation it meant a client believing they had cancelled and being charged
   * again next month — a silent failure on a money path.
   *
   * They ride the existing `support` type on purpose. The 10 request types are
   * FROZEN cross-repo (the App enforces them with a DB CHECK), so a dedicated
   * `cancel_plan` type would need a coordinated migration on both sides; `support`
   * is the right existing vocabulary ("help, not new work") and is one of the few
   * types a one-time buyer may also file. The body says which flow it came from so
   * whoever picks it up on the App side knows immediately.
   */
  function fileRequest(kind: PortalSupportRequestKind) {
    if (!sessionId) {
      // No session wired (proposal page / mock): hand off to a human rather than
      // pretend. Never silently swallow the click.
      contactTeam(portalSupportChatFallback(kind));
      return;
    }
    setRequestError(null);
    startTransition(async () => {
      const result = await submitRequestAction({ sessionId, ...portalSupportRequest(kind) });
      if (result.ok) {
        if (kind === "cancel_membership") {
          setCancelRequested(true);
          setCancelOpen(false);
        } else {
          setExportRequested(true);
          setExportOpen(false);
        }
      } else {
        // Surface the real reason and KEEP the dialog open: a failed cancellation
        // that looks like a success is the exact bug this replaces.
        setRequestError(result.error);
      }
    });
  }

  const requestExport = () => fileRequest("export_project_data");
  const requestCancel = () => fileRequest("cancel_membership");

  // Editing identity keeps its own focused dialog — close this one first so the
  // two never stack.
  function editProfile() {
    setOpen(false);
    onEditProfile?.();
  }

  /**
   * A locked action must never dead-end on a greyed-out button: it hands the
   * client to a human. Closes the panel, drives the real Chat tab button (the
   * same bridge the notifications bell uses — the tab owns its own state), and
   * leaves the message typed and focused so all that's left is Send.
   */
  function contactTeam(message: string) {
    handingOff.current = true;
    setOpen(false);
    goToWorkspaceChat(message);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            // The label has to follow the mode: in account mode there IS no
            // project (the studio chat is a draft conversation, the home has no
            // project at all), and the panel shows only profile / language /
            // emails. It said "Project settings" everywhere, which was wrong on
            // every surface that isn't a client workspace.
            aria-label={accountOnly ? "Account settings" : "Project settings"}
            title={accountOnly ? "Account settings" : "Project settings"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-border bg-background text-foreground/85 transition-colors hover:bg-secondary/60 data-[state=open]:bg-secondary/60"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </DialogTrigger>

        {/* Explicit width + cap: the base `w-full` would let the panel touch
            both viewport edges once max-w passes the window width. */}
        <DialogContent closeLabel={tA11y("closeDialog")}
          onCloseAutoFocus={(e) => {
            if (handingOff.current) {
              handingOff.current = false;
              e.preventDefault();
            }
          }}
          className="flex h-[95vh] w-[calc(100%-3rem)] flex-col gap-0 overflow-hidden rounded-[8px] p-0 sm:max-w-[1340px] sm:flex-row"
        >
          {/* Sub-navigation. Vertical rail on desktop; on mobile it collapses to
              a scrollable strip above the content. */}
          <nav
            aria-label={t("sectionsLabel")}
            className="shrink-0 border-b border-border bg-secondary/20 p-2.5 sm:w-64 sm:border-b-0 sm:border-r sm:p-4"
          >
            <p className="hidden px-2 pb-2.5 pt-1 text-[13px] font-semibold sm:block">{t("title")}</p>
            <div className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
              {sections.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  aria-current={s.key === section ? "page" : undefined}
                  className={`shrink-0 whitespace-nowrap rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                    s.key === section
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          {/* The active sub-page */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12 text-left">
              <DialogTitle className="text-base">{active.label}</DialogTitle>
              <DialogDescription className="text-[13px]">{active.blurb}</DialogDescription>
            </DialogHeader>

            {/* The cards are capped and centred inside the scroller — the panel
                grows, the reading measure doesn't (same as the reference on a
                wide window). */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="mx-auto w-full max-w-5xl space-y-4">
              {section === "general" && (
                <>
                  {/* Identity first — the pattern every reference settings page
                      opens with (Vercel: Avatar, then Display Name). */}
                  {profile && onEditProfile && (
                    <SettingsCard
                      title={t("profileTitle")}
                      description={t("profileDescription")}
                      footer={
                        <>
                          <p className={hintClass}>{t("profileHint")}</p>
                          <button type="button" onClick={editProfile} className={buttonClass}>
                            {t("editProfile")}
                          </button>
                        </>
                      }
                    >
                      <div className="flex items-center gap-3">
                        {profile.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- local object URL (mock)
                          <img
                            src={profile.photoUrl}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-full border border-border object-cover"
                          />
                        ) : (
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                            {initialsOf(profile.name, profile.email)}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {profile.name || profile.email}
                          </span>
                          <span className="block truncate text-[12px] text-muted-foreground">
                            {profile.email}
                          </span>
                        </span>
                      </div>
                    </SettingsCard>
                  )}

                  {/* Named "Emails", NOT "Notifications": the header bell is the
                      in-app notifications FEED, so two "Notifications" read as
                      redundant (owner 2026-07-20). */}
                  <SettingsCard
                    title={t("emailsTitle")}
                    description={t("emailsDescription")}
                    footer={
                      // Transactional carve-out (ref-backed): critical notices
                      // bypass the toggles, and saying so kills the "what if I
                      // turn it all off" worry.
                      <p className={hintClass}>{t("emailsCritical")}</p>
                    }
                  >
                    <div className="space-y-2.5">
                      {(accountOnly
                        ? // Account mode: only the preference that isn't tied to a
                          // plan. "New version" and "renewal reminders" both
                          // presuppose a project, and this panel may be opened by
                          // someone who has none yet.
                          [
                            {
                              label: t("notifyChat"),
                              hint: t("notifyChatHint"),
                              checked: notifyChat,
                              set: setNotifyChat,
                            },
                          ]
                        : isMembership
                        ? [
                            {
                              label: t("notifyVersions"),
                              hint: t("notifyVersionsHint"),
                              checked: notifyVersions,
                              set: setNotifyVersions,
                            },
                            {
                              label: t("notifyChat"),
                              hint: t("notifyChatHint"),
                              checked: notifyChat,
                              set: setNotifyChat,
                            },
                          ]
                        : // One-time buyer: they keep the Chat, plus the yearly
                          // renewal reminder. No "new version" — their build is
                          // delivered, not iterated on.
                          [
                            {
                              label: t("notifyChat"),
                              hint: t("notifyChatHint"),
                              checked: notifyChat,
                              set: setNotifyChat,
                            },
                            {
                              label: t("notifyRenewal"),
                              hint: t("notifyRenewalHint"),
                              checked: notifyRenewal,
                              set: setNotifyRenewal,
                            },
                          ]
                      ).map((p) => (
                        <label
                          key={p.label}
                          className="flex cursor-pointer items-start gap-2.5 text-[13px]"
                        >
                          <input
                            type="checkbox"
                            checked={p.checked}
                            onChange={(e) => p.set(e.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-[#0056fd]"
                          />
                          <span>
                            {p.label}
                            <span className="block text-[12px] text-muted-foreground">
                              {p.hint}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </SettingsCard>

                  <SettingsCard
                    title={t("languageTitle")}
                    description={t("languageDescription")}
                    // True since 2026-08-07 — the choice is now stored in the
                    // cookie AND on the project. Before that this line was the
                    // only part of the card that did anything, and it lied.
                    footer={<p className={hintClass}>{t("languageHint")}</p>}
                  >
                    {/* Styled (Radix) select, same convention as request-box:
                        a native <select> paints its popup with OS chrome and
                        the system-blue highlight, which can't be themed. */}
                    <Select
                      value={language}
                      disabled={isSwitchingLanguage}
                      onValueChange={(v) => changeLanguage(v as "en" | "es")}
                    >
                      <SelectTrigger aria-label={t("languageTitle")} className={SELECT_TRIGGER}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={SELECT_CONTENT}>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l.code} value={l.code}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SettingsCard>
                </>
              )}

              {section === "billing" && (
                <>
                  <SettingsCard
                    title={isMembership ? "Plan" : "Payment"}
                    badge={membershipBadge}
                    description={
                      isMembership
                        ? "Invoices, payment method, and cancellation — handled securely via Stripe."
                        : "You paid once for your build; hosting and your domain renew yearly to keep it online. Your receipt is below."
                    }
                    footer={
                      billingSlot ? (
                        <>
                          <span />
                          {billingSlot}
                        </>
                      ) : invoiceUrl ? (
                        <>
                          <span />
                          <a
                            href={invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${buttonClass} gap-1.5`}
                          >
                            <CreditCard className="h-3.5 w-3.5" strokeWidth={1.75} />
                            {isMembership ? "Manage billing" : "View invoice"}
                          </a>
                        </>
                      ) : undefined
                    }
                  >
                    {!invoiceUrl && !billingSlot && (
                      <EmptyState icon={FileText} text="No invoices yet." />
                    )}
                  </SettingsCard>

                  {/* Danger zone — last on the sub-page, behind a scroll, alone.
                      Nothing recurring to cancel on a one-time plan, so it
                      doesn't exist for them. */}
                  {isMembership && (
                    <SettingsCard
                      danger
                      title={t("cancelTitle")}
                      description={t("cancelDescription")}
                      footer={
                        <>
                          {cancelRequested ? (
                            <p className={hintClass}>{t("cancelRequestedHint")}</p>
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            onClick={() => setCancelOpen(true)}
                            disabled={cancelRequested}
                            className="inline-flex items-center justify-center rounded-[6px] bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-45"
                          >
                            {cancelRequested ? t("cancelRequestedButton") : t("cancelTitle")}
                          </button>
                        </>
                      }
                    />
                  )}
                </>
              )}

              {section === "data" && (
                <SettingsCard
                  title={t("exportTitle")}
                  description={t("exportDescription")}
                  footer={
                    <>
                      <p className={hintClass}>
                        {advancedUnlocked ? t("exportHintReady") : t("exportHintOff")}
                      </p>
                      {advancedUnlocked ? (
                        <button
                          type="button"
                          onClick={() => setExportOpen(true)}
                          disabled={exportRequested}
                          className={`${buttonClass} gap-1.5 disabled:pointer-events-none disabled:opacity-45`}
                        >
                          <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {exportRequested ? t("exportRequested") : t("exportRequest")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            // Prefilled into the chat composer — so it must be
                            // in the client's language, not ours.
                            contactTeam(t("exportAskMessage"))
                          }
                          className={`${buttonClass} gap-1.5`}
                        >
                          <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {t("exportAskTeam")}
                        </button>
                      )}
                    </>
                  }
                />
              )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export confirm — a request, not an instant download: the team prepares it. */}
      <AlertDialog
        open={exportOpen}
        onOpenChange={(next) => {
          setExportOpen(next);
          if (!next) setRequestError(null);
        }}
      >
        <AlertDialogContent className="rounded-[8px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("exportDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("exportDialogBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          {requestError && <RequestError message={requestError} />}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[6px]">{t("close")}</AlertDialogCancel>
            <button
              type="button"
              onClick={requestExport}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-[6px] bg-[#0056fd] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0047e0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? t("sending") : t("exportRequest")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel-plan confirm — nothing stops immediately; a human follows up.
          Plain red button (not AlertDialogAction) for the same portal reason as
          the domain menu: `.site-primary-action` would repaint it blue. */}
      <AlertDialog
        open={cancelOpen}
        onOpenChange={(next) => {
          setCancelOpen(next);
          if (!next) setRequestError(null);
        }}
      >
        <AlertDialogContent className="rounded-[8px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelDialogTitle")}</AlertDialogTitle>
            {/* Same sentence as the card above, on purpose: the confirm step is
                where it actually gets read. */}
            <AlertDialogDescription>{t("cancelDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          {requestError && <RequestError message={requestError} />}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[6px]">{t("cancelKeep")}</AlertDialogCancel>
            <button
              type="button"
              onClick={requestCancel}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-[6px] bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? t("sending") : t("cancelConfirm")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Same trigger/content styling the workspace request-box uses, so every select
// in the portal reads as one control.
const SELECT_TRIGGER =
  "w-full max-w-xs rounded-[6px] border-border bg-transparent shadow-none dark:bg-transparent dark:hover:bg-transparent";
const SELECT_CONTENT = "rounded-[6px] border-border";
const hintClass = "min-w-0 flex-1 text-[12px] leading-relaxed text-muted-foreground";
const buttonClass =
  "inline-flex shrink-0 items-center justify-center rounded-[6px] border border-border bg-background px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-secondary/50";

/**
 * One settings block, the reference's anatomy: an explanatory body, then a
 * tinted footer strip carrying the caveat on the left and the action on the
 * right. `danger` swaps border + footer tint to red — reserved for the last
 * card of a sub-page.
 */
function SettingsCard({
  title,
  badge,
  description,
  children,
  footer,
  danger = false,
}: {
  title: string;
  badge?: { label: string; color: string } | null;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[6px] border ${danger ? "border-red-500/40" : "border-border"}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          {badge && (
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.color}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        )}
        {children && <div className="mt-3.5">{children}</div>}
      </div>
      {footer && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 ${
            danger ? "border-red-500/40 bg-red-500/[0.07]" : "border-border bg-secondary/20"
          }`}
        >
          {footer}
        </div>
      )}
    </section>
  );
}

/**
 * Why a submission failed, inside the dialog it came from. Deliberately loud:
 * the whole point of this path is that the client must never walk away thinking
 * a request landed when it didn't.
 */
function RequestError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-[6px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] leading-relaxed text-destructive"
    >
      {message} Nothing was sent — you can retry, or reach your Noon team in the Chat.
    </p>
  );
}

/** The reference's empty state: a boxed icon over one calm line of text. */
function EmptyState({
  icon: Icon,
  text,
}: {
  icon: typeof FileText;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-[6px] border border-border py-8">
      <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-border bg-secondary/40">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
      </span>
      <p className="text-[13px] text-muted-foreground">{text}</p>
    </div>
  );
}
