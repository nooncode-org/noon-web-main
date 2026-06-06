/**
 * lib/maxwell/serialize-v0-source.ts
 *
 * Pure helper that serializes the V0 SDK's per-file source output
 * (`latestVersion.files: { name, content }[]`) into a single string suitable
 * for the cross-repo `prototype.generated_html` wire field.
 *
 * Why a single string: the share contract field is `string | null` and App's
 * post-payment pipeline (Opus, Iter 9) reads it as the prototipo's source to
 * improve into the functional MVP. The file boundaries are preserved with a
 * delimited header per file so an LLM (or a human) can reconstruct the tree:
 *
 *   // === file: app/page.tsx ===
 *   <content>
 *
 *   // === file: components/hero.tsx ===
 *   <content>
 *
 * Format choice rationale: handoff `docs/handoff-piedra-2026-06-06-generated-html-code.md`
 * §1 — delimited per-file blocks, kept simple so Opus reads it as code. If App
 * later asks for a different shape (e.g. JSON of the files array) this is the
 * single place to change it.
 *
 * No I/O, no env reads — pure function so it stays trivially testable and can
 * run inside the poll route's hot path without side effects.
 */

/**
 * Minimal shape consumed from the V0 SDK's `latestVersion.files[]`. The SDK
 * type carries more (`object`, `locked`) but only `name` + `content` are
 * load-bearing for the serialized source.
 */
export type V0SourceFile = {
  name: string;
  content: string;
};

const FILE_HEADER_PREFIX = "// === file: ";
const FILE_HEADER_SUFFIX = " ===";

/**
 * Serialize V0 source files into the delimited single-string form, or `null`
 * when there is nothing meaningful to send.
 *
 * Returns `null` (not `""`) when:
 *   - `files` is undefined/empty, OR
 *   - every file has empty/whitespace-only content.
 * `null` lets the share action omit `generated_html` entirely so the App-side
 * `deployed_url OR generated_html` refine still passes on `deployed_url` and
 * older versions degrade to the prior demo-url-only behaviour.
 *
 * Files with a present name but empty content are skipped (a header with no body
 * is noise for the downstream reader). File order is preserved as the SDK
 * returns it.
 */
export function serializeV0Source(files: V0SourceFile[] | undefined | null): string | null {
  if (!files || files.length === 0) return null;

  const blocks: string[] = [];
  for (const file of files) {
    const name = file.name?.trim();
    const content = file.content ?? "";
    if (!name) continue;
    if (content.trim().length === 0) continue;
    blocks.push(`${FILE_HEADER_PREFIX}${name}${FILE_HEADER_SUFFIX}\n${content}`);
  }

  if (blocks.length === 0) return null;
  // Blank line between blocks so the next header is visually separated from the
  // previous file's trailing content.
  return blocks.join("\n\n");
}
