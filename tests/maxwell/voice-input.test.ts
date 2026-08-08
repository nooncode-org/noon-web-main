/**
 * tests/maxwell/voice-input.test.ts
 *
 * Dictation appends to the composer instead of replacing it, so someone can
 * type half a thought, dictate the rest, and get one sentence. The joining rule
 * is the whole trick and it is easy to get subtly wrong — a missing space
 * welds two words together, a naive space adds a leading one to an empty box.
 */

import { describe, expect, it } from "vitest";
import { appendTranscript } from "@/components/maxwell/use-voice-input";

describe("appendTranscript", () => {
  it("uses the dictated text as-is when nothing was typed", () => {
    expect(appendTranscript("", "una app de reservas")).toBe("una app de reservas");
  });

  it("joins typed and dictated text with exactly one space", () => {
    expect(appendTranscript("quiero", "una app de reservas")).toBe(
      "quiero una app de reservas",
    );
  });

  it("does not double the space when the box already ends in one", () => {
    // The composer usually does: someone speaks after typing a word and a space.
    expect(appendTranscript("quiero ", "una app")).toBe("quiero una app");
    expect(appendTranscript("quiero   ", "una app")).toBe("quiero una app");
  });

  it("treats a whitespace-only box as empty, with no leading space", () => {
    expect(appendTranscript("   ", "hola")).toBe("hola");
    expect(appendTranscript("\n\n", "hola")).toBe("hola");
  });

  it("keeps everything the person typed, including inner spacing", () => {
    // Only the TAIL is trimmed: a deliberate blank line mid-brief is theirs.
    expect(appendTranscript("linea uno\n\nlinea dos", "y tres")).toBe(
      "linea uno\n\nlinea dos y tres",
    );
  });

  it("accumulates across several dictated chunks", () => {
    // Recognition delivers a long brief in pieces; each one appends.
    let text = "";
    for (const chunk of ["Quiero una tienda", "con pagos", "y envíos"]) {
      text = appendTranscript(text, chunk);
    }
    expect(text).toBe("Quiero una tienda con pagos y envíos");
  });
});
