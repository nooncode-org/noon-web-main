/**
 * lib/maxwell/image-intake.ts
 *
 * Fase A · E3.3 — the door every client-supplied image walks through
 * (docs/maxwell/fase-a-spec.md §1: "verificar que de verdad es una imagen,
 * limitar el tamaño, borrarle los metadatos ocultos — las fotos llevan
 * ubicación y datos personales dentro — y guardarla en sitio seguro").
 *
 * Three checks, in this order:
 *   1. It must be a data URL declaring an image type we accept.
 *   2. Its BYTES must agree with that claim (magic numbers). A .jpg header
 *      on a script is the oldest trick there is; the declared type is a
 *      claim, the first bytes are evidence.
 *   3. It must fit the size limit — decoded, not base64-inflated.
 *
 * Then it strips metadata: JPEG APP1 (where EXIF and its GPS coordinates
 * live) and PNG eXIf/tEXt/iTXt chunks. A client sharing a photo of their
 * shop should never be sharing their home address with it.
 *
 * Pure and synchronous; never throws. Refusals come back as a reason the
 * caller turns into a calm sentence, never an error page.
 */

export type ImageIntakeResult =
  | { ok: true; dataUrl: string; strippedBytes: number }
  | { ok: false; reason: "not-a-data-url" | "type" | "not-an-image" | "too-large" };

/** Decoded ceiling. Generous for a phone photo, far under any DoS threshold. */
const MAX_DECODED_BYTES = 8 * 1024 * 1024;

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** First bytes that PROVE the format, independent of what the header claims. */
function sniff(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  const ascii = (i: number, s: string) =>
    s.split("").every((c, k) => bytes[i + k] === c.charCodeAt(0));
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  return null;
}

/** Drop JPEG APP1 segments — the container EXIF (and its GPS) rides in. */
function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    // Start of scan: the rest is entropy-coded image data, copy verbatim.
    if (marker === 0xda) {
      for (let k = i; k < bytes.length; k++) out.push(bytes[k]);
      return Uint8Array.from(out);
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2) break;
    const isMetadata = marker === 0xe1 || marker === 0xed || marker === 0xfe; // APP1 · APP13 · COM
    if (!isMetadata) {
      for (let k = i; k < i + 2 + length; k++) out.push(bytes[k]);
    }
    i += 2 + length;
  }
  return Uint8Array.from(out);
}

/** Drop PNG text/EXIF chunks, keeping the critical ones intact. */
function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let k = 0; k < 8; k++) out.push(bytes[k]); // signature
  let i = 8;
  const name = (at: number) =>
    String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  while (i + 8 <= bytes.length) {
    const length =
      (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 0) break;
    const type = name(i + 4);
    const total = 12 + length; // length + type + data + crc
    if (i + total > bytes.length) break;
    if (type !== "eXIf" && type !== "tEXt" && type !== "iTXt" && type !== "zTXt") {
      for (let k = i; k < i + total; k++) out.push(bytes[k]);
    }
    i += total;
    if (type === "IEND") break;
  }
  return Uint8Array.from(out);
}

/**
 * Validate and sanitize one client image given as a data URL. Returns the
 * cleaned data URL, or the reason it was refused.
 */
export function intakeClientImage(dataUrl: string): ImageIntakeResult {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!match) return { ok: false, reason: "not-a-data-url" };

  const declared = match[1].toLowerCase();
  if (!ACCEPTED.has(declared)) return { ok: false, reason: "type" };

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  } catch {
    return { ok: false, reason: "not-an-image" };
  }
  if (bytes.length === 0) return { ok: false, reason: "not-an-image" };
  if (bytes.length > MAX_DECODED_BYTES) return { ok: false, reason: "too-large" };

  // The bytes must back the claim — and must back THIS claim, so a PNG
  // announced as JPEG is refused rather than quietly re-labelled.
  const sniffed = sniff(bytes);
  if (!sniffed || sniffed !== declared) return { ok: false, reason: "not-an-image" };

  const cleaned =
    sniffed === "image/jpeg"
      ? stripJpegMetadata(bytes)
      : sniffed === "image/png"
        ? stripPngMetadata(bytes)
        : bytes;

  return {
    ok: true,
    dataUrl: `data:${sniffed};base64,${Buffer.from(cleaned).toString("base64")}`,
    strippedBytes: bytes.length - cleaned.length,
  };
}
