/**
 * tests/scripts/check-migrations.test.ts
 *
 * Unit tests for the pure helpers in `scripts/check-migrations.lib.mjs`.
 * We deliberately do NOT exercise the DB-touching `main()` function — that's
 * covered by manual runs against a real Postgres in `docs/migrations.md`.
 *
 * Coverage focus:
 *   - sha256 is deterministic and matches a known fixture.
 *   - listLocalMigrations sorts lexicographically and filters non-.sql files.
 *   - diffMigrations correctly identifies missing + orphan sets.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diffMigrations, listLocalMigrations, sha256 } from "../../scripts/check-migrations.lib.mjs";

describe("sha256", () => {
  it("returns the canonical SHA-256 hex digest for an empty string", () => {
    expect(sha256("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("is stable across calls (no salt, no nonce)", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
  });

  it("differs for different inputs", () => {
    expect(sha256("a")).not.toBe(sha256("b"));
  });
});

describe("listLocalMigrations", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "check-migrations-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns an empty list when the directory has no .sql files", () => {
    writeFileSync(join(dir, "README.md"), "not a migration");
    expect(listLocalMigrations(dir)).toEqual([]);
  });

  it("only includes .sql files (filters README, JSON, etc.)", () => {
    writeFileSync(join(dir, "20260101_001_a.sql"), "-- a");
    writeFileSync(join(dir, "notes.txt"), "ignore");
    writeFileSync(join(dir, "config.json"), "{}");

    const result = listLocalMigrations(dir);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("20260101_001_a.sql");
  });

  it("sorts results lexicographically (chronological by naming convention)", () => {
    writeFileSync(join(dir, "20260301_005_e.sql"), "-- e");
    writeFileSync(join(dir, "20260101_001_a.sql"), "-- a");
    writeFileSync(join(dir, "20260201_003_c.sql"), "-- c");

    const result = listLocalMigrations(dir);
    expect(result.map((r: { filename: string }) => r.filename)).toEqual([
      "20260101_001_a.sql",
      "20260201_003_c.sql",
      "20260301_005_e.sql",
    ]);
  });

  it("computes the file checksum (not the filename hash)", () => {
    const content = "-- migration body\nCREATE TABLE x ();\n";
    writeFileSync(join(dir, "20260101_001_x.sql"), content);

    const result = listLocalMigrations(dir);
    expect(result[0].checksum).toBe(sha256(content));
  });
});

describe("diffMigrations", () => {
  it("reports zero missing / zero orphans when local and applied match exactly", () => {
    const local = [
      { filename: "a.sql", checksum: "h1" },
      { filename: "b.sql", checksum: "h2" },
    ];
    const applied = new Set(["a.sql", "b.sql"]);

    const result = diffMigrations(local, applied);
    expect(result.missing).toEqual([]);
    expect(result.orphans).toEqual([]);
  });

  it("flags local files missing from the applied ledger as 'missing'", () => {
    const local = [
      { filename: "a.sql", checksum: "h1" },
      { filename: "b.sql", checksum: "h2" },
      { filename: "c.sql", checksum: "h3" },
    ];
    const applied = new Set(["a.sql"]);

    const result = diffMigrations(local, applied);
    expect(result.missing.map((m: { filename: string }) => m.filename)).toEqual([
      "b.sql",
      "c.sql",
    ]);
    expect(result.orphans).toEqual([]);
  });

  it("flags ledger entries with no local file as 'orphans' (warn-only)", () => {
    const local = [{ filename: "a.sql", checksum: "h1" }];
    const applied = new Set(["a.sql", "b.sql", "c.sql"]);

    const result = diffMigrations(local, applied);
    expect(result.missing).toEqual([]);
    expect(result.orphans.sort()).toEqual(["b.sql", "c.sql"]);
  });

  it("can report both missing and orphans in the same diff", () => {
    const local = [
      { filename: "a.sql", checksum: "h1" },
      { filename: "c.sql", checksum: "h3" }, // not in applied → missing
    ];
    const applied = new Set(["a.sql", "b.sql"]); // b.sql is orphan

    const result = diffMigrations(local, applied);
    expect(result.missing.map((m: { filename: string }) => m.filename)).toEqual(["c.sql"]);
    expect(result.orphans).toEqual(["b.sql"]);
  });
});
