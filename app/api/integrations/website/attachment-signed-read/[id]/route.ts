import { NextResponse } from "next/server";
import { getAttachmentForSignedRead } from "@/lib/maxwell/repositories";
import { createAttachmentSignedUrl } from "@/lib/maxwell/attachment-storage";
import { NoonAppIntegrationError, verifySignedNoonAppGet } from "@/lib/noon-app-integration";
import { log } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Short-lived signed-URL TTL (the App redirects staff to it immediately). */
const SIGNED_URL_TTL_SECONDS = 60;

type Context = { params: Promise<{ id: string }> };

/**
 * Attachment signed-read (§9 B.5b) — NoonWeb exposes it, the App calls it.
 *
 * When staff open an attachment, the App's staff route (authz first) signs a GET
 * (`${ts}.` HMAC, the prototype-signed-read convention, reusing
 * NOON_WEBSITE_WEBHOOK_SECRET) and calls here. NoonWeb resolves the private
 * Storage object and 302-redirects to a SHORT-LIVED signed URL — so the bytes
 * stream straight from Storage to the staff browser, never proxied through a
 * function (the co-signed access mechanism, Q-B5b-2).
 *
 * Non-revealing 404 when the id does not resolve to an attachment on a
 * payment-activated project (same body for not-found and not-activated).
 */
export async function GET(request: Request, { params }: Context) {
  try {
    verifySignedNoonAppGet(request);
  } catch (error) {
    if (error instanceof NoonAppIntegrationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    throw error;
  }

  const { id } = await params;
  try {
    const resolved = await getAttachmentForSignedRead(id);
    if (!resolved) {
      return NextResponse.json({ message: "Attachment not found." }, { status: 404 });
    }

    const signedUrl = await createAttachmentSignedUrl(resolved.blobKey, SIGNED_URL_TTL_SECONDS);
    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    log.error("integrations.website.attachment-signed-read", error);
    return NextResponse.json({ message: "Attachment read failed." }, { status: 500 });
  }
}
