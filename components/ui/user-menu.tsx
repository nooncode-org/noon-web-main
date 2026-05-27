"use client";

/**
 * components/ui/user-menu.tsx
 *
 * Auth-aware user surface used by both the public `Navigation` (landing /
 * marketing chrome) and the `StudioHeader` (Maxwell working surface). Renders
 * an avatar trigger that opens a Popover with:
 *
 *   - The viewer's email (truncated, monospace).
 *   - A "Maxwell Studio" link (hidden when the menu is rendered inside the
 *     studio itself — pass `showStudioLink={false}`).
 *   - A "Sign out" form whose action calls the `signOutAction` Server Action,
 *     which delegates to NextAuth's `signOut` (cookie + JWT invalidation +
 *     redirect to `/`).
 *
 * Render strategy: the avatar is an `<img>` when `image` is set; otherwise a
 * monogram derived from the first letter of `name` or `email`. The trigger is
 * a real `<button>` so keyboard focus + screen-reader labelling work without
 * extra a11y plumbing.
 *
 * Locale handling: the "Maxwell Studio" link is locale-prefixed via the
 * `locale` prop (caller knows the current locale from `useParams` / RSC
 * params). No translation of menu copy yet — copy is English to match the
 * existing `Navigation` chrome; copy review can localise later.
 */

import Link from "next/link";
import { useState } from "react";
import { LogOut, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { signOutAction } from "@/lib/auth/signout-action";

export type UserMenuViewer = {
  email: string;
  name?: string | null;
  image?: string | null;
};

export type UserMenuProps = {
  viewer: UserMenuViewer;
  locale: string;
  /**
   * When `false`, the "Maxwell Studio" link is omitted. Use from inside the
   * studio itself so the menu doesn't link to where the user already is.
   * Defaults to `true`.
   */
  showStudioLink?: boolean;
  /**
   * Optional className for the trigger button — lets the host header tweak
   * size / border to match its visual language without us copying styles.
   */
  triggerClassName?: string;
};

function deriveMonogram(viewer: UserMenuViewer): string {
  const source = viewer.name?.trim() || viewer.email.trim();
  const firstChar = source.charAt(0);
  return firstChar ? firstChar.toUpperCase() : "?";
}

const DEFAULT_TRIGGER_CLASS =
  "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary/60 text-xs font-medium text-foreground transition-colors hover:bg-secondary";

export function UserMenu({
  viewer,
  locale,
  showStudioLink = true,
  triggerClassName,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const monogram = deriveMonogram(viewer);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${viewer.email}`}
          className={triggerClassName ?? DEFAULT_TRIGGER_CLASS}
        >
          {viewer.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewer.image}
              alt=""
              className="h-full w-full rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span aria-hidden="true">{monogram}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground/80">
            Signed in as
          </p>
          <p
            className="mt-0.5 truncate text-xs font-mono text-foreground"
            title={viewer.email}
          >
            {viewer.email}
          </p>
        </div>

        <div className="py-1">
          {showStudioLink && (
            <Link
              href={`/${locale}/maxwell/studio`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs text-foreground/85 transition-colors hover:bg-secondary/60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Maxwell Studio
            </Link>
          )}

          <form action={signOutAction} onSubmit={() => setOpen(false)}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-foreground/85 transition-colors hover:bg-secondary/60"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}
