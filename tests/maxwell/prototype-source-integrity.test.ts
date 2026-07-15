/**
 * tests/maxwell/prototype-source-integrity.test.ts
 *
 * Unit tests for `findMissingLocalImports` — the W2 content gate that keeps
 * the poll route from committing (and burning quota on) a v0 version whose
 * source imports files v0 never emitted. Mirrors the two live failures from
 * the 2026-07-14 E2E: `@/components/hero-section` and
 * `@/components/whatsapp-float` referenced but absent.
 */

import { describe, expect, it } from "vitest";
import { findMissingLocalImports } from "@/lib/maxwell/prototype-source-integrity";

const page = (content: string) => ({ name: "app/page.tsx", content });

describe("findMissingLocalImports", () => {
  it("returns [] for undefined / null / empty input", () => {
    expect(findMissingLocalImports(undefined)).toEqual([]);
    expect(findMissingLocalImports(null)).toEqual([]);
    expect(findMissingLocalImports([])).toEqual([]);
  });

  it("flags an @/ import with no emitted file (the live 2026-07-14 failure)", () => {
    const missing = findMissingLocalImports([
      page(
        'import HeroSection from "@/components/hero-section";\n' +
          'import WhatsappFloat from "@/components/whatsapp-float";\n',
      ),
    ]);
    expect(missing).toEqual(["@/components/hero-section", "@/components/whatsapp-float"]);
  });

  it("passes when the imported files ARE emitted (any resolvable extension)", () => {
    const missing = findMissingLocalImports([
      page('import HeroSection from "@/components/hero-section";'),
      { name: "components/hero-section.tsx", content: "export default () => null;" },
    ]);
    expect(missing).toEqual([]);
  });

  it("resolves index files and exact-name matches", () => {
    const missing = findMissingLocalImports([
      page(
        'import A from "@/components/cards";\nimport B from "@/lib2/thing";',
      ),
      { name: "components/cards/index.tsx", content: "x" },
      { name: "lib2/thing.ts", content: "x" },
    ]);
    expect(missing).toEqual([]);
  });

  it("resolves relative imports against the importing file's directory", () => {
    const missing = findMissingLocalImports([
      {
        name: "components/sections/hero.tsx",
        content: 'import { Item } from "./item";\nimport { Up } from "../shared";',
      },
      { name: "components/sections/item.tsx", content: "x" },
      // ../shared → components/shared — NOT emitted.
    ]);
    expect(missing).toEqual(["../shared"]);
  });

  it("never flags the v0-provided shadcn registry (components/ui, lib, hooks)", () => {
    const missing = findMissingLocalImports([
      page(
        'import { Button } from "@/components/ui/button";\n' +
          'import { cn } from "@/lib/utils";\n' +
          'import { useMobile } from "@/hooks/use-mobile";',
      ),
    ]);
    expect(missing).toEqual([]);
  });

  it("skips package imports and imports with an extension (css/svg/json)", () => {
    const missing = findMissingLocalImports([
      page(
        'import { motion } from "framer-motion";\n' +
          'import { Star } from "lucide-react";\n' +
          'import "./globals.css";\n' +
          'import logo from "@/public/logo.svg";',
      ),
    ]);
    expect(missing).toEqual([]);
  });

  it("only scans code files — import-like text in css/md never matches", () => {
    const missing = findMissingLocalImports([
      { name: "app/globals.css", content: '@import "tailwindcss";' },
      { name: "README.md", content: 'import X from "@/components/ghost"' },
    ]);
    expect(missing).toEqual([]);
  });

  it("dedupes a specifier imported from several files", () => {
    const missing = findMissingLocalImports([
      page('import G from "@/components/ghost";'),
      { name: "components/other.tsx", content: 'import G from "@/components/ghost";' },
    ]);
    expect(missing).toEqual(["@/components/ghost"]);
  });

  it("handles export-from and dynamic import() forms", () => {
    const missing = findMissingLocalImports([
      page(
        'export { thing } from "@/components/re-exported";\n' +
          'const Lazy = import("@/components/lazy-missing");',
      ),
    ]);
    expect(missing).toEqual(["@/components/re-exported", "@/components/lazy-missing"]);
  });
});
