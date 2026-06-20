/**
 * tests/maxwell/attachments.test.ts
 *
 * B.5b attachment vocabulary + limits + validation (lib/maxwell/attachments.ts).
 * Pure module — no DB, no env.
 */

import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIME_ALLOWLIST,
  ATTACHMENTS_ENABLED,
  isAllowedAttachmentMime,
  isValidAttachmentSize,
  sanitizeAttachmentFilename,
} from "@/lib/maxwell/attachments";

describe("attachments — flag + limits", () => {
  it("ships gated off (hard deploy order)", () => {
    expect(ATTACHMENTS_ENABLED).toBe(false);
  });

  it("caps at 10 MB", () => {
    expect(ATTACHMENT_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("isAllowedAttachmentMime", () => {
  it("allows the co-signed types", () => {
    for (const mime of ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain"]) {
      expect(isAllowedAttachmentMime(mime)).toBe(true);
    }
  });

  it("rejects SVG and executables (and anything off the allowlist)", () => {
    expect(isAllowedAttachmentMime("image/svg+xml")).toBe(false);
    expect(isAllowedAttachmentMime("application/x-msdownload")).toBe(false);
    expect(isAllowedAttachmentMime("application/octet-stream")).toBe(false);
    expect(isAllowedAttachmentMime("")).toBe(false);
  });

  it("the allowlist itself contains no SVG", () => {
    expect(ATTACHMENT_MIME_ALLOWLIST).not.toContain("image/svg+xml");
  });
});

describe("isValidAttachmentSize", () => {
  it("accepts 1..max integers", () => {
    expect(isValidAttachmentSize(1)).toBe(true);
    expect(isValidAttachmentSize(ATTACHMENT_MAX_BYTES)).toBe(true);
  });

  it("rejects 0, negative, over-cap, and non-integers", () => {
    expect(isValidAttachmentSize(0)).toBe(false);
    expect(isValidAttachmentSize(-1)).toBe(false);
    expect(isValidAttachmentSize(ATTACHMENT_MAX_BYTES + 1)).toBe(false);
    expect(isValidAttachmentSize(1.5)).toBe(false);
    expect(isValidAttachmentSize(Number.NaN)).toBe(false);
  });
});

describe("sanitizeAttachmentFilename", () => {
  it("strips any path component (never trusts the client path)", () => {
    expect(sanitizeAttachmentFilename("/etc/passwd")).toBe("passwd");
    expect(sanitizeAttachmentFilename("..\\..\\windows\\system32\\cmd.exe")).toBe("cmd.exe");
    expect(sanitizeAttachmentFilename("folder/sub/report.pdf")).toBe("report.pdf");
  });

  it("drops control characters", () => {
    const withControls = `a${String.fromCharCode(7)}b${String.fromCharCode(0)}c.png`;
    expect(sanitizeAttachmentFilename(withControls)).toBe("abc.png");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeAttachmentFilename("  my   file .pdf ")).toBe("my file .pdf");
  });

  it("clamps to the max length", () => {
    const long = `${"x".repeat(400)}.png`;
    expect(sanitizeAttachmentFilename(long).length).toBe(255);
  });

  it("falls back to 'file' when nothing usable remains", () => {
    expect(sanitizeAttachmentFilename("/")).toBe("file");
    expect(sanitizeAttachmentFilename(" ")).toBe("file");
  });
});
