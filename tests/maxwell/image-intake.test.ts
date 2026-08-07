/**
 * tests/maxwell/image-intake.test.ts
 *
 * Fase A · E3.3 — the door every client image walks through:
 *
 *   - the declared type is a CLAIM, the first bytes are evidence: a script
 *     announced as a JPEG, or a PNG announced as a JPEG, is refused;
 *   - oversized payloads are refused before anything else touches them;
 *   - EXIF (and the GPS coordinates inside it) never survives the door —
 *     a client sharing a photo of their shop must not be sharing their
 *     home address with it.
 */

import { describe, expect, it } from "vitest";

import { intakeClientImage } from "@/lib/maxwell/image-intake";

function toDataUrl(mime: string, bytes: number[]): string {
  return `data:${mime};base64,${Buffer.from(Uint8Array.from(bytes)).toString("base64")}`;
}

/** Minimal JPEG: SOI + an APP1/EXIF segment carrying GPS + SOS + data + EOI. */
function jpegWithExif(): { dataUrl: string; secret: number[] } {
  const secret = [0x47, 0x50, 0x53, 0x21]; // "GPS!" — must not survive
  const app1Payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...secret];
  const app1Length = app1Payload.length + 2;
  return {
    secret,
    dataUrl: toDataUrl("image/jpeg", [
      0xff, 0xd8, // SOI
      0xff, 0xe1, (app1Length >> 8) & 0xff, app1Length & 0xff, ...app1Payload, // APP1
      0xff, 0xdb, 0x00, 0x04, 0x11, 0x22, // a quantisation table (kept)
      0xff, 0xda, 0x00, 0x03, 0x01, // SOS
      0x99, 0x88, 0x77, // scan data
      0xff, 0xd9, // EOI
    ]),
  };
}

describe("intakeClientImage", () => {
  it("accepts a real JPEG and strips its EXIF, keeping the image data", () => {
    const { dataUrl, secret } = jpegWithExif();
    const result = intakeClientImage(dataUrl);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const out = Array.from(Buffer.from(result.dataUrl.split(",")[1], "base64"));
    // The GPS bytes are gone…
    expect(out.join(",")).not.toContain(secret.join(","));
    // …the quantisation table and the scan data stayed.
    expect(out.join(",")).toContain([0xff, 0xdb, 0x00, 0x04, 0x11, 0x22].join(","));
    expect(out.join(",")).toContain([0x99, 0x88, 0x77].join(","));
    expect(result.strippedBytes).toBeGreaterThan(0);
  });

  it("refuses a script wearing an image label", () => {
    const script = Array.from("<script>alert(1)</script>", (c) => c.charCodeAt(0));
    expect(intakeClientImage(toDataUrl("image/jpeg", script))).toEqual({
      ok: false,
      reason: "not-an-image",
    });
  });

  it("refuses bytes that contradict the declared type", () => {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
    expect(intakeClientImage(toDataUrl("image/jpeg", png)).ok).toBe(false);
  });

  it("refuses types we do not accept, and non-data-URLs", () => {
    expect(intakeClientImage(toDataUrl("image/svg+xml", [0x3c, 0x73]))).toEqual({
      ok: false,
      reason: "type",
    });
    expect(intakeClientImage("https://cdn.example/a.jpg")).toEqual({
      ok: false,
      reason: "not-a-data-url",
    });
  });

  it("refuses anything over the size ceiling", () => {
    const huge = new Array(9 * 1024 * 1024).fill(0);
    huge[0] = 0xff;
    huge[1] = 0xd8;
    huge[2] = 0xff;
    expect(intakeClientImage(toDataUrl("image/jpeg", huge))).toEqual({
      ok: false,
      reason: "too-large",
    });
  });

  it("strips PNG text/EXIF chunks and keeps the critical ones", () => {
    const chunk = (type: string, data: number[]) => [
      (data.length >> 24) & 0xff, (data.length >> 16) & 0xff, (data.length >> 8) & 0xff, data.length & 0xff,
      ...Array.from(type, (c) => c.charCodeAt(0)),
      ...data,
      0, 0, 0, 0, // crc (not validated here)
    ];
    const png = [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...chunk("IHDR", [1, 2, 3, 4]),
      ...chunk("eXIf", [0x47, 0x50, 0x53]),
      ...chunk("IDAT", [9, 9, 9]),
      ...chunk("IEND", []),
    ];

    const result = intakeClientImage(toDataUrl("image/png", png));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const out = Array.from(Buffer.from(result.dataUrl.split(",")[1], "base64"));
    expect(out.join(",")).toContain([1, 2, 3, 4].join(",")); // IHDR kept
    expect(out.join(",")).toContain([9, 9, 9].join(",")); // IDAT kept
    expect(out.join(",")).not.toContain([0x47, 0x50, 0x53].join(",")); // eXIf gone
  });
});
