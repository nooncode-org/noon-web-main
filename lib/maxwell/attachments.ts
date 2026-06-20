/**
 * lib/maxwell/attachments.ts
 *
 * Shared vocabulary + limits + validation for B.5b client-request attachments.
 *
 * Pure module (no server-only imports) — safe for the client upload UI and the
 * server action alike. The actual hosting (Supabase Storage) lives in the
 * server-only `attachment-storage.ts`.
 *
 * Contract co-signed 2026-06-20 (docs/2026-06-20-v3-b5b-attachments-noonweb-codesign.md
 * + the App cosign response): NoonWeb hosts the file + is authoritative on the
 * real bytes; the App backstops the sub-shape (size 1..10MB, mime allowlist,
 * filename 1..255). 1 attachment per update.
 */

/**
 * B.5b gate (hard deploy order). The App's §5D receiver 400s `kind:'attachment'`
 * until it deploys the attachment branch — so NoonWeb keeps the upload path OFF
 * until the App confirms. While `false`: the upload UI hides and the server
 * action rejects an attachment. Flip to `true` (one-line PR) once the App
 * confirms `kind:'attachment'` is deployed, alongside provisioning the storage
 * env. Typed `boolean` so conditions are not treated as statically known.
 */
export const ATTACHMENTS_ENABLED: boolean = false;

/** Max attachment size in bytes (10 MB), matching the co-signed cap. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_FILENAME_MAX = 255;

/**
 * Co-signed mime allowlist: images + pdf + plain text + common office docs.
 * Deliberately excludes SVG (XSS) and executables. Extending it is additive +
 * re-confirmed with the App.
 */
export const ATTACHMENT_MIME_ALLOWLIST: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function isAllowedAttachmentMime(mime: string): boolean {
  return ATTACHMENT_MIME_ALLOWLIST.includes(mime);
}

/** Size guard: a positive integer within the cap. */
export function isValidAttachmentSize(size: number): boolean {
  return Number.isInteger(size) && size >= 1 && size <= ATTACHMENT_MAX_BYTES;
}

/**
 * Sanitize a client-supplied filename for safe storage + display: strip any path
 * component, drop control chars (C0 + DEL), collapse whitespace, clamp to the max
 * length. Never trusts the client's path. Falls back to "file" if nothing remains.
 */
export function sanitizeAttachmentFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  let stripped = "";
  for (const ch of base) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue; // drop control chars
    stripped += ch;
  }
  const cleaned = stripped.replace(/\s+/g, " ").trim();
  const clamped = cleaned.slice(0, ATTACHMENT_FILENAME_MAX);
  return clamped.length > 0 ? clamped : "file";
}
