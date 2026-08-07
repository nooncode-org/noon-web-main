/**
 * tests/maxwell/curation-queue.test.ts
 *
 * Fase A · E3.5 — the pool's shopping list and its manual answer.
 *
 * What matters here is that a coverage gap stops being invisible: today a
 * family that matches nothing falls back quietly and the prototype comes
 * out generic, with nobody ever learning which kind of business we keep
 * failing. And that the manual path is real — a reference added by hand
 * genuinely reaches the selection, with the curated core untouched.
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  noteCoverageGap,
  readCurationQueue,
  summarizeCurationQueue,
} from "@/lib/maxwell/curation-queue";
import { readPoolExtras } from "@/lib/maxwell/pool-extras";

describe("curation queue", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "curation-"));
    vi.stubEnv("MAXWELL_DOSSIER_CACHE_DIR", dir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("records a gap with the client's own words", async () => {
    await noteCoverageGap({
      familyId: "clean-professional",
      projectHint: "una funeraria moderna en Bogotá",
      reason: "classifier_fallback",
    });

    const queue = await readCurationQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].projectHint).toContain("funeraria");
    expect(queue[0].seenAt).toBeTruthy();
  });

  it("summarizes into a shopping list, most pressing family first", async () => {
    await noteCoverageGap({ familyId: "a", projectHint: "funeraria", reason: "r" });
    await noteCoverageGap({ familyId: "a", projectHint: "tanatorio", reason: "r" });
    await noteCoverageGap({ familyId: "b", projectHint: "gimnasio", reason: "r" });

    const summary = await summarizeCurationQueue();

    expect(summary[0]).toMatchObject({ familyId: "a", count: 2 });
    expect(summary[0].examples).toEqual(["funeraria", "tanatorio"]);
    expect(summary[1]).toMatchObject({ familyId: "b", count: 1 });
  });

  it("an empty or unreadable queue reads as empty, never as an error", async () => {
    expect(await readCurationQueue()).toEqual([]);
    expect(await summarizeCurationQueue()).toEqual([]);
  });
});

describe("pool extras (the manual answer)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "pool-extras-"));
    vi.stubEnv("MAXWELL_DOSSIER_CACHE_DIR", dir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads references added by hand for a family", async () => {
    await writeFile(
      path.join(dir, "pool-extras.json"),
      JSON.stringify({
        "warm-artisanal": [
          { url: "poilane.com", why: "Editorial, warm" },
          { url: "fabriquebakery.com" },
        ],
      }),
      "utf8",
    );

    const extras = await readPoolExtras("warm-artisanal");

    expect(extras).toHaveLength(2);
    expect(extras[0]).toEqual({ url: "poilane.com", v0Hint: "Editorial, warm" });
    expect(extras[1]).toEqual({ url: "fabriquebakery.com" });
  });

  it("is silent for families nobody curated, and for a broken file", async () => {
    expect(await readPoolExtras("tech-digital")).toEqual([]);

    await writeFile(path.join(dir, "pool-extras.json"), "{ not json", "utf8");
    expect(await readPoolExtras("warm-artisanal")).toEqual([]);
  });

  it("ignores malformed entries instead of shipping a broken reference", async () => {
    await writeFile(
      path.join(dir, "pool-extras.json"),
      JSON.stringify({ f: [{ why: "no url here" }, { url: "  " }, { url: "good.com" }] }),
      "utf8",
    );

    expect(await readPoolExtras("f")).toEqual([{ url: "good.com" }]);
  });
});
