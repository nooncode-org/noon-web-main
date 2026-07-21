"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * WorkspaceProfileDialog — edit the client's display identity (name + photo).
 * Opened by clicking your identity in the sidebar header (owner ask
 * 2026-07-19: the portal should feel like YOURS, not an anonymous email).
 *
 * Front only (logic later): Save hands the values back to the sidebar's local
 * state; persistence (profile row + photo upload/storage) is deferred. The
 * photo preview uses a local object URL — never uploaded anywhere here.
 */
export type ClientProfile = { name: string; photoUrl: string | null };

export function initialsOf(name: string, fallback: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return (fallback[0] ?? "?").toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function WorkspaceProfileDialog({
  open,
  onOpenChange,
  email,
  profile,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  profile: ClientProfile;
  onSave: (next: ClientProfile) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile.photoUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    // Local preview only — TODO(logic later): real upload + storage.
    setPhotoUrl(URL.createObjectURL(file));
  }

  function save() {
    onSave({ name: name.trim(), photoUrl });
    onOpenChange(false);
  }

  // Re-seed the fields each time the dialog opens with the current profile.
  function handleOpenChange(next: boolean) {
    if (next) {
      setName(profile.name);
      setPhotoUrl(profile.photoUrl);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-[8px] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Your profile</DialogTitle>
          <DialogDescription>
            How you appear across your project — to Maxwell and your Noon team.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          {/* Avatar + change-photo affordance */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Change photo"
            className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-secondary"
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview (front-only)
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-lg font-medium text-foreground">
                {initialsOf(name, email)}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-5 w-5 text-white" strokeWidth={1.75} />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />

          <div className="min-w-0 flex-1 space-y-2">
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted-foreground">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-[6px] border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus-visible:border-foreground/30"
              />
            </label>
            <p className="truncate text-[12px] text-muted-foreground" title={email}>
              {email}
            </p>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-[6px] border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-[6px] bg-[#0056fd] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0047e0]"
          >
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
