/**
 * tests/maxwell/serialize-v0-source.test.ts
 *
 * Unit tests for `serializeV0Source` — the pure helper that turns the V0 SDK's
 * per-file output into the delimited single-string `generated_html` payload.
 */

import { describe, expect, it } from "vitest";
import { serializeV0Source } from "@/lib/maxwell/serialize-v0-source";

describe("serializeV0Source", () => {
  it("returns null for undefined / null / empty input", () => {
    expect(serializeV0Source(undefined)).toBeNull();
    expect(serializeV0Source(null)).toBeNull();
    expect(serializeV0Source([])).toBeNull();
  });

  it("serializes a single file with a delimited header", () => {
    const out = serializeV0Source([
      { name: "app/page.tsx", content: "export default function Page() {}" },
    ]);
    expect(out).toBe(
      "// === file: app/page.tsx ===\nexport default function Page() {}",
    );
  });

  it("joins multiple files with a blank line between blocks, preserving order", () => {
    const out = serializeV0Source([
      { name: "a.tsx", content: "AAA" },
      { name: "b.tsx", content: "BBB" },
    ]);
    expect(out).toBe(
      "// === file: a.tsx ===\nAAA\n\n// === file: b.tsx ===\nBBB",
    );
  });

  it("skips files with empty or whitespace-only content", () => {
    const out = serializeV0Source([
      { name: "keep.tsx", content: "KEEP" },
      { name: "empty.tsx", content: "" },
      { name: "blank.tsx", content: "   \n  " },
    ]);
    expect(out).toBe("// === file: keep.tsx ===\nKEEP");
  });

  it("skips files with a blank name", () => {
    const out = serializeV0Source([
      { name: "  ", content: "orphan" },
      { name: "real.tsx", content: "REAL" },
    ]);
    expect(out).toBe("// === file: real.tsx ===\nREAL");
  });

  it("returns null when every file is skipped", () => {
    expect(
      serializeV0Source([
        { name: "", content: "x" },
        { name: "y.tsx", content: "  " },
      ]),
    ).toBeNull();
  });

  it("trims the name but never the content", () => {
    const out = serializeV0Source([
      { name: "  spaced.tsx  ", content: "  body with edges  " },
    ]);
    expect(out).toBe("// === file: spaced.tsx ===\n  body with edges  ");
  });
});
