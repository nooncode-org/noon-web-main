/**
 * lib/maxwell/reference-study/card-capture.ts
 *
 * Fase A · E2.2 — the confirmation card's QUALITY capture (spec §4): the
 * client approves the direction looking at references "viéndose de
 * calidad" — hero-framed (top of page at desktop viewport, not a random
 * scroll), clean, pre-cached so the card loads instantly.
 *
 * Cached as JPEG files next to the dossier cache (same env-overridable
 * root, `captures/` subfolder), keyed by the same normalized-URL hash —
 * paid once per reference, reused for every client of that family.
 * Served to the chat by app/api/maxwell/studio/reference-capture/[id].
 *
 * Runtime affinity: same as measure.ts — Playwright loads dynamically,
 * never bundled by a Next route import (the route only READS files).
 * Never throws: any failure returns null and the caller degrades (an
 * ugly or missing capture is never shown — the reference rotates out).
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { log } from "@/lib/server/logger";
import { normalizeReferenceUrl } from "./dossier-cache";
import { loadPlaywright } from "./measure";

const DEFAULT_CACHE_DIR = path.join(".data", "maxwell", "dossiers");
const CAPTURE_SUBDIR = "captures";
/** Card tiles render ~260px wide at 2x — 1440 source keeps them crisp. */
const VIEWPORT = { width: 1440, height: 900 };
const JPEG_QUALITY = 82;
const NAV_TIMEOUT_MS = 45_000;

function captureDir(): string {
  const fromEnv = process.env.MAXWELL_DOSSIER_CACHE_DIR?.trim();
  const root = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_CACHE_DIR;
  return path.join(root, CAPTURE_SUBDIR);
}

/** Stable public id for a reference's capture (safe to put in a URL). */
export function cardCaptureId(url: string): string {
  return createHash("sha256").update(normalizeReferenceUrl(url)).digest("hex").slice(0, 20);
}

function capturePathFor(id: string): string {
  return path.join(captureDir(), `${id}.jpg`);
}

/** Read a cached capture by its id. Null when absent/unreadable. */
export async function readCardCapture(id: string): Promise<Buffer | null> {
  // Ids come from the URL path — accept only our own hash alphabet so a
  // crafted id can never traverse outside the capture dir.
  if (!/^[a-f0-9]{20}$/.test(id)) return null;
  try {
    return await readFile(capturePathFor(id));
  } catch {
    return null;
  }
}

/**
 * Ensure a hero-framed capture exists for the reference; returns its id,
 * or null when the page can't be captured (caller rotates the reference).
 */
export async function ensureCardCapture(url: string): Promise<string | null> {
  const id = cardCaptureId(url);
  if (await readCardCapture(id)) return id;

  try {
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: VIEWPORT,
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
        } catch {
          await page.goto(url, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
        }
        // Let fonts/heros settle; freeze motion so the frame is stable.
        await page.addStyleTag({
          content: "*,*::before,*::after{animation:none!important;transition:none!important}",
        });
        await page.waitForTimeout(1_200);
        const buf = await page.screenshot({ type: "jpeg", quality: JPEG_QUALITY });

        await mkdir(captureDir(), { recursive: true });
        await writeFile(capturePathFor(id), buf);
        return id;
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    log.warn("maxwell.card-capture", "capture failed — reference will rotate", {
      url,
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
