"use client";

import { useState } from "react";
import { Bell, MessageCircle, Layers, Globe, CreditCard, CheckCircle2, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * WorkspaceNotifications — the portal's persistent updates center, a bell in the
 * header (owner call 2026-07-19: a dedicated, scrollable, timestamped history
 * beats the transient "New since your last visit" strip it replaces). NOT a
 * fifth tab — a header utility beside Help, so the 4-tab consolidation stands.
 *
 * Division of labor: the Chat is conversations; this bell is EVENTS (version
 * ready, domain verified, payment) plus a pointer to unread messages. It reads
 * from the same per-section "what's new" feed that powers the tab dots — one
 * source, two views. Front only (logic later): items are mock, read-state is
 * local; the real feed + persisted read cursor are deferred.
 *
 * Tab jump: the bell renders in the header, OUTSIDE the WorkspaceTabs client
 * island (the host page is a server component, so the tab state can't be lifted
 * to it). Rather than a shared client provider, opening a notification drives
 * the real tab button via the DOM — it's always mounted, and this reuses the
 * tab's own select() (active + seen-dot clear + scroll reset) for free. NOTE
 * for the port: revisit with a proper client provider if the real page wants
 * header↔tabs to share state more richly.
 */
export type WorkspaceNotification = {
  id: string;
  kind: "chat" | "version" | "domain" | "billing" | "milestone";
  title: string;
  detail?: string;
  at: string;
  /** Tab this notification jumps to when opened. */
  tab: string;
  unread?: boolean;
};

const KIND_ICON = {
  chat: MessageCircle,
  version: Layers,
  domain: Globe,
  billing: CreditCard,
  milestone: CheckCircle2,
} as const;

export function WorkspaceNotifications({ items }: { items: WorkspaceNotification[] }) {
  const [open, setOpen] = useState(false);
  // Read-state seeded from the items; opening one (or "Mark all read") clears it.
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(items.filter((n) => !n.unread).map((n) => n.id)),
  );

  const unreadCount = items.filter((n) => !readIds.has(n.id)).length;

  function go(n: WorkspaceNotification) {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(n.id);
      return next;
    });
    // Drive the real tab button (always mounted) — see the header↔tabs note above.
    document
      .querySelector<HTMLButtonElement>(
        `nav[aria-label="Workspace sections"] [role="tab"][data-tabid="${n.tab}"]`,
      )
      ?.click();
    setOpen(false);
  }

  function markAllRead() {
    setReadIds(new Set(items.map((n) => n.id)));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          title="Notifications"
          className="relative shrink-0 rounded-[6px] p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#0056fd] ring-2 ring-card"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-[8px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="text-sm font-medium">Notifications</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[min(66vh,440px)] overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            items.map((n) => {
              const Icon = KIND_ICON[n.kind];
              const unread = !readIds.has(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => go(n)}
                  className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50 ${
                    unread ? "bg-[#0056fd]/[0.03]" : ""
                  }`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`truncate text-[13px] ${
                          unread ? "font-medium text-foreground" : "text-foreground/80"
                        }`}
                      >
                        {n.title}
                      </span>
                      {unread && (
                        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0056fd]" />
                      )}
                    </span>
                    {n.detail && (
                      <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                        {n.detail}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground/70">{n.at}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
