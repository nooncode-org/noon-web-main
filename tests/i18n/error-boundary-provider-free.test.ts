/**
 * tests/i18n/error-boundary-provider-free.test.ts
 *
 * The error page must render when everything else is broken.
 *
 * An App Router error boundary mounts OUTSIDE the app's `NextIntlClientProvider`
 * — that is a fact about where React catches, not a choice. So any component
 * reachable from `app/error.tsx` that calls `useTranslations()` throws "context
 * not found", and the screen a client lands on when something goes wrong goes
 * wrong itself: a blank page instead of a way back.
 *
 * This happened on 2026-08-08. The shared nav was translated during the language
 * pass, and the nav is what `app/error.tsx` mounts. Nothing caught it — the
 * build passes, the types pass, every page that HAS a provider still works. It
 * surfaces only at the one moment nobody is watching.
 *
 * The rule enforced here is a pairing, not a ban: a boundary may render
 * translated components as long as it carries its own dictionary. Banning
 * translation outright was the first fix and the wrong one — it would freeze
 * the shared nav in English, and that nav is exactly what blocks serving more
 * of the site in Spanish (see i18n/launch-locales.ts).
 *
 * Static, because reproducing this at runtime means first breaking something
 * else on purpose.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../..");

/** The files React mounts when a render throws. */
const ERROR_BOUNDARIES = ["app/error.tsx", "app/global-error.tsx"];

/**
 * Hooks that read from the provider. All fail the same way when it is absent —
 * next-intl draws no line between "no provider" and "no messages", which is why
 * the failure is total rather than one missing string.
 */
const PROVIDER_HOOKS = [
  "useTranslations",
  "useFormatter",
  "useLocale",
  "useMessages",
  "useNow",
  "useTimeZone",
];

/** Extensions to try when an import specifier has none, in resolution order. */
const EXTENSIONS = [".tsx", ".ts", "/index.tsx", "/index.ts"];

/** Resolve a `@/…` or `./…` specifier to a file on disk, or null if it isn't one. */
function resolveLocalImport(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) {
    base = path.join(REPO_ROOT, spec.slice(2));
  } else if (spec.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else {
    return null; // a package — not ours to walk
  }

  if (/\.(css|json|svg|png|jpg|webp)$/.test(base)) {
    return null; // assets and data can't call hooks
  }
  if (existsSync(base) && base.endsWith(".tsx")) {
    return base;
  }
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** Every import specifier in a source file — static, side-effect and dynamic. */
function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /import\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g,
    /import\s+["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specs.push(match[1]);
    }
  }
  return specs;
}

/**
 * Depth-first walk of everything an entry point can pull into the render.
 * Returns each reachable file with its source, entry included.
 */
function collectRenderTree(entryRelative: string): Map<string, string> {
  const found = new Map<string, string>();
  const queue = [path.join(REPO_ROOT, entryRelative)];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (found.has(file) || !existsSync(file)) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    found.set(file, source);

    for (const spec of importSpecifiers(source)) {
      const resolved = resolveLocalImport(spec, file);
      if (resolved !== null && !found.has(resolved)) {
        queue.push(resolved);
      }
    }
  }
  return found;
}

/** Strip comments so a hook NAMED in prose doesn't read as a hook CALLED. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Reachable files that call a provider hook, as "file calls hook()" lines. */
function findProviderHookCallers(tree: Map<string, string>): string[] {
  const callers: string[] = [];
  for (const [file, source] of tree) {
    const code = stripComments(source);
    for (const hook of PROVIDER_HOOKS) {
      if (new RegExp(`\\b${hook}\\s*\\(`).test(code)) {
        callers.push(`${path.relative(REPO_ROOT, file).replace(/\\/g, "/")} calls ${hook}()`);
      }
    }
  }
  return callers;
}

describe("error boundaries render without the app's locale provider", () => {
  for (const entry of ERROR_BOUNDARIES) {
    it(`${entry}: anything translated is under a provider it supplies itself`, () => {
      const tree = collectRenderTree(entry);
      // A tree of nothing means resolution silently failed and the assertion
      // below would pass vacuously.
      expect(tree.size).toBeGreaterThan(0);

      const callers = findProviderHookCallers(tree);
      if (callers.length === 0) {
        return; // nothing translated in reach — no provider needed
      }

      const boundarySource = stripComments(tree.get(path.join(REPO_ROOT, entry))!);
      const mountsProvider = /<NextIntlClientProvider[\s>]/.test(boundarySource);
      // Messages must be handed in explicitly. Left to fetch them, the provider
      // looks for a context that, here, is the thing that isn't there.
      // `[^>]*` already spans newlines, so the attribute may sit on its own
      // line; no dotAll flag (the repo targets a pre-ES2018 lib).
      const suppliesMessages = /<NextIntlClientProvider[^>]*\bmessages=/.test(boundarySource);

      expect(
        mountsProvider && suppliesMessages,
        `${entry} renders outside the app's NextIntlClientProvider, and these ` +
          `files in its tree read from it:\n  ${callers.join("\n  ")}\n\n` +
          `Calling a next-intl hook there throws and takes the error page down ` +
          `with it — the one page that has to survive. Either wrap them in a ` +
          `<NextIntlClientProvider locale="en" messages={…}> that this file ` +
          `supplies (see how app/error.tsx does it), or pass the text in as a ` +
          `prop.`,
      ).toBe(true);
    });
  }

  it("the walk actually reaches past the entry file", () => {
    // Guards the guard: if import resolution breaks, everything above passes
    // for the wrong reason. The shared nav is what broke last time.
    const files = [...collectRenderTree("app/error.tsx").keys()].map((f) =>
      path.relative(REPO_ROOT, f).replace(/\\/g, "/"),
    );
    expect(files).toContain("app/_components/site/site-nav-rd.tsx");
  });

  it("names the component that actually broke", () => {
    // The shared nav is the one that took the error page down on 2026-08-08.
    // It now takes its copy as props (see SiteNavRdLabels), so it reads from
    // nothing. Called out by name because the general rule above passes just as
    // happily when import resolution quietly stops reaching this file.
    const nav = "app/_components/site/site-nav-rd.tsx";
    const source = stripComments(readFileSync(path.join(REPO_ROOT, nav), "utf8"));
    for (const hook of PROVIDER_HOOKS) {
      expect(
        new RegExp(`\\b${hook}\\s*\\(`).test(source),
        `${nav} calls ${hook}(). app/error.tsx mounts it outside the locale ` +
          `provider, so this throws and blanks the error page. Add the string ` +
          `to SiteNavRdLabels and resolve it in site-nav.tsx instead.`,
      ).toBe(false);
    }
  });
});
