/**
 * lib/upgrade/screenshots.ts
 *
 * Tarea #41 — give the /upgrade audit EYES.
 *
 * Until now the audit read the crawled text and judged a website it had
 * never seen. Half of what makes a site feel dated is invisible in text:
 * cramped spacing, a 2012 hero, clip-art photography, twelve competing
 * colours, type that never changes size. Those are exactly the things a
 * client notices and cannot name — and exactly what we are selling to
 * fix.
 *
 * Reuses the study's capture machinery (hero-framed 1440 JPEG, cached by
 * URL) so this costs one browser visit per page, once.
 *
 * Every URL is client-supplied, so every URL goes through the SSRF guard
 * first — same rule as the studio's own reference flow.
 *
 * Never throws: no captures simply means the audit runs on text, exactly
 * as it always has.
 */

import { guardClientReferenceUrl } from "@/lib/maxwell/client-reference-guard";
import {
  ensureCardCapture,
  readCardCapture,
} from "@/lib/maxwell/reference-study/card-capture";
import { log } from "@/lib/server/logger";

/** Two pages is the sweet spot: the home page plus one inner page. */
const MAX_SCREENSHOTS = 2;

/**
 * Capture up to two pages of the client's site as data URLs, ready to
 * ride along with the audit call.
 */
export async function captureUpgradeScreenshots(
  pageUrls: string[],
): Promise<string[]> {
  const captures: string[] = [];

  for (const pageUrl of pageUrls.slice(0, MAX_SCREENSHOTS * 2)) {
    if (captures.length >= MAX_SCREENSHOTS) break;
    try {
      const guarded = await guardClientReferenceUrl(pageUrl);
      if (!guarded.ok) continue;

      const id = await ensureCardCapture(guarded.url);
      if (!id) continue;

      const buffer = await readCardCapture(id);
      if (!buffer) continue;

      captures.push(`data:image/jpeg;base64,${buffer.toString("base64")}`);
    } catch (error) {
      log.warn("upgrade.screenshots", "capture skipped", {
        url: pageUrl,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return captures;
}
