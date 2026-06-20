/**
 * lib/maxwell/attachment-storage.ts
 *
 * Server-only Supabase Storage access for B.5b attachments, via the Storage REST
 * API (no supabase-js dep — the app already talks to Supabase directly with
 * postgres.js). NoonWeb hosts attachments in a PRIVATE bucket; the App only ever
 * gets a stable reference and fetches via our HMAC signed-read, which mints a
 * short-lived signed URL here (`createAttachmentSignedUrl`) — the co-signed
 * access mechanism (302 to a short-lived signed URL, no byte-proxying).
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (NoonWeb-only; the first v3
 * new-env exception, inherent to file-hosting). NEVER import from a client bundle
 * — the service key must not reach the browser.
 *
 * Operator setup: create a PRIVATE bucket named `client-request-attachments` in
 * the Web Supabase project + set the two env vars (preview + prod).
 */

const BUCKET = "client-request-attachments";

function readStorageConfig(): { baseUrl: string; serviceKey: string } | null {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) return null;
  return { baseUrl, serviceKey };
}

/** True when the storage backend env is configured (a gate for the upload action). */
export function isAttachmentStorageConfigured(): boolean {
  return readStorageConfig() !== null;
}

function requireConfig(): { baseUrl: string; serviceKey: string } {
  const cfg = readStorageConfig();
  if (!cfg) {
    throw new Error(
      "Supabase Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return cfg;
}

/** Encode each path segment but keep the slashes (folder structure intact). */
function encodeStorageKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** Upload bytes to the private bucket at `key`. Throws on a non-2xx response. */
export async function uploadAttachmentObject(input: {
  key: string;
  body: ArrayBuffer | Blob;
  contentType: string;
}): Promise<void> {
  const { baseUrl, serviceKey } = requireConfig();
  const res = await fetch(
    `${baseUrl}/storage/v1/object/${BUCKET}/${encodeStorageKey(input.key)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": input.contentType,
        // Never silently overwrite — keys are unique (the attachment id).
        "x-upsert": "false",
      },
      body: input.body,
    },
  );
  if (!res.ok) {
    throw new Error(`Attachment upload failed (${res.status}).`);
  }
}

/**
 * Mint a short-lived signed download URL for `key` (the co-signed access path).
 * Returns the absolute URL. Throws on a non-2xx response.
 */
export async function createAttachmentSignedUrl(
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  const { baseUrl, serviceKey } = requireConfig();
  const res = await fetch(
    `${baseUrl}/storage/v1/object/sign/${BUCKET}/${encodeStorageKey(key)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    },
  );
  if (!res.ok) {
    throw new Error(`Attachment signed-URL creation failed (${res.status}).`);
  }
  const data = (await res.json()) as { signedURL?: string; signedUrl?: string };
  // REST returns `signedURL`; tolerate the supabase-js `signedUrl` casing too.
  const signed = data.signedURL ?? data.signedUrl;
  if (!signed) {
    throw new Error("Attachment signed-URL response missing signedURL.");
  }
  // `signed` is a path relative to /storage/v1 (e.g. "/object/sign/bucket/key?token=…").
  return `${baseUrl}/storage/v1${signed}`;
}

/** Delete the object at `key` (GDPR hard-delete). A 404 is treated as already-gone. */
export async function deleteAttachmentObject(key: string): Promise<void> {
  const { baseUrl, serviceKey } = requireConfig();
  const res = await fetch(
    `${baseUrl}/storage/v1/object/${BUCKET}/${encodeStorageKey(key)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${serviceKey}` },
    },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Attachment delete failed (${res.status}).`);
  }
}
