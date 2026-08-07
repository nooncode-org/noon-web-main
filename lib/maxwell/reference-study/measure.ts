/**
 * lib/maxwell/reference-study/measure.ts
 *
 * Fase A · Paso 3, mitad determinista — "Playwright MIDE lo medible"
 * (docs/maxwell/fase-a-spec.md §3). Visits a reference page for real and
 * extracts exact values from computed CSS: font families and weights, the
 * heading scale in px, line-heights, letter-spacing, the dominant palette
 * in hex, container widths, section rhythm (heights, paddings, gaps),
 * radii, shadows and button anatomy — on desktop AND mobile, plus
 * section-sliced JPEG captures for the judge (long pages degrade vision
 * models; slices keep each image legible).
 *
 * These measurements are the anti-adjective rule's raw material: the
 * judge (Sol) receives values it can quote instead of adjectives it
 * would invent.
 *
 * Runtime affinity: NOT imported by any Next.js route. Consumers are the
 * harness scripts (Entrega 1) and, later, whatever worker Entrega 2/3
 * chooses for production. Playwright is loaded dynamically so merely
 * importing this module never drags a browser into a server bundle.
 *
 * Trust boundary: Entrega 1 only ever measures OUR curated pool
 * references (trusted URLs). The SSRF guard for client-supplied URLs is
 * Entrega 3 work (spec §2) and must land before this runs on arbitrary
 * input.
 *
 * Never throws for page-level trouble it can absorb (missing sections,
 * style read errors); DOES reject on navigation/browser failure — the
 * caller (the study) catches and degrades to family tokens (Regla 0).
 */

export type MeasuredTextStyle = {
  /** Which element this was sampled from ("h1", "h2", "body"). */
  role: string;
  fontFamily: string;
  fontSizePx: number;
  fontWeight: number;
  /** Unitless ratio (line-height px / font-size px), 2 decimals. */
  lineHeight: number;
  /** Computed letter-spacing in px (0 when "normal"). */
  letterSpacingPx: number;
};

export type MeasuredColor = {
  hex: string;
  /** Where it was seen: text | background | border. */
  role: "text" | "background" | "border";
  /** How many sampled elements carried it — dominance signal. */
  count: number;
};

export type MeasuredButton = {
  backgroundHex: string | null;
  textHex: string | null;
  borderRadiusPx: number;
  paddingPx: string;
  fontSizePx: number;
};

export type MeasuredSection = {
  index: number;
  /** Tag plus a compact hint ("section.hero", "footer"). */
  label: string;
  topPx: number;
  heightPx: number;
  paddingTopPx: number;
  paddingBottomPx: number;
  backgroundHex: string | null;
};

/**
 * The site's own mark, found ONLY where a logo lives by convention: inside
 * the header's link back to home. A logo picked from anywhere else could
 * be a partner's, a payment badge or a press mention — and a prototype
 * wearing someone else's brand is far worse than one wearing none.
 */
export type MeasuredLogo = {
  /** Absolute image URL, or a data: URI when the mark is inline SVG. */
  url: string;
  kind: "img" | "svg";
};

export type PageMeasurement = {
  viewport: { width: number; height: number };
  logo: MeasuredLogo | null;
  fonts: { family: string; weights: number[] }[];
  textStyles: MeasuredTextStyle[];
  palette: MeasuredColor[];
  /** Most common max-width constraint among content wrappers, px. */
  containerWidthPx: number | null;
  sections: MeasuredSection[];
  /** Vertical gaps between consecutive sections, px. */
  sectionGapsPx: number[];
  borderRadiiPx: number[];
  boxShadows: string[];
  buttons: MeasuredButton[];
};

export type SectionCapture = {
  viewport: "desktop" | "mobile";
  /** Section index this slice covers; -1 = full page. */
  sectionIndex: number;
  label: string;
  /** JPEG data: URL, ready for the vision call. */
  dataUrl: string;
};

export type ReferenceMeasurements = {
  url: string;
  measuredAt: string;
  desktop: PageMeasurement;
  mobile: PageMeasurement;
  captures: SectionCapture[];
};

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
/** Desktop slices sent to the judge — capped so one analysis stays cheap. */
const MAX_SECTION_CAPTURES = 6;
const NAV_TIMEOUT_MS = 45_000;
const CAPTURE_JPEG_QUALITY = 70;

export type PlaywrightModule = {
  chromium: {
    launch(opts?: { headless?: boolean }): Promise<{
      newContext(opts?: object): Promise<{
        newPage(): Promise<PlaywrightPage>;
        addInitScript(script: string): Promise<void>;
        close(): Promise<void>;
      }>;
      close(): Promise<void>;
    }>;
  };
};

type PlaywrightPage = {
  goto(url: string, opts?: object): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  addStyleTag(opts: { content: string }): Promise<unknown>;
  evaluate<R>(fn: () => R): Promise<R>;
  evaluate<R, A>(fn: (arg: A) => R, arg: A): Promise<R>;
  screenshot(opts?: object): Promise<Buffer>;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
};

/**
 * Playwright ships as a transitive dep of @playwright/test; try the direct
 * package first, fall back to the test wrapper (both re-export chromium).
 * Exported for siblings (card-capture) so the loading strategy lives once.
 */
export async function loadPlaywright(): Promise<PlaywrightModule> {
  try {
    return (await import("playwright")) as unknown as PlaywrightModule;
  } catch {
    return (await import("@playwright/test")) as unknown as PlaywrightModule;
  }
}

/**
 * Runs inside the page. Self-contained on purpose (no closure captures —
 * Playwright serializes it), and defensive: any style it cannot read is
 * skipped, never thrown.
 */
function collectPageMeasurement(): PageMeasurement {
  const toHex = (css: string): string | null => {
    const m = css.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\)/);
    if (!m) return null;
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
    const h = (n: string) => parseInt(n, 10).toString(16).padStart(2, "0");
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  };
  const px = (v: string): number => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
  };

  const fonts = new Map<string, Set<number>>();
  const colorCounts = new Map<string, number>();
  const radii = new Map<number, number>();
  const shadows = new Map<string, number>();
  const maxWidths = new Map<number, number>();

  const all = Array.from(document.querySelectorAll("body *")).slice(0, 4000);
  for (const el of all) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    let cs: CSSStyleDeclaration;
    try {
      cs = getComputedStyle(el);
    } catch {
      continue;
    }
    if (cs.display === "none" || cs.visibility === "hidden") continue;

    const family = cs.fontFamily.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
    if (family) {
      const weight = parseInt(cs.fontWeight, 10) || 400;
      if (!fonts.has(family)) fonts.set(family, new Set());
      fonts.get(family)!.add(weight);
    }

    const textHex = el.textContent?.trim() ? toHex(cs.color) : null;
    if (textHex) colorCounts.set(`text:${textHex}`, (colorCounts.get(`text:${textHex}`) ?? 0) + 1);
    const bgHex = toHex(cs.backgroundColor);
    if (bgHex) colorCounts.set(`background:${bgHex}`, (colorCounts.get(`background:${bgHex}`) ?? 0) + 1);
    const borderHex = px(cs.borderTopWidth) > 0 ? toHex(cs.borderTopColor) : null;
    if (borderHex) colorCounts.set(`border:${borderHex}`, (colorCounts.get(`border:${borderHex}`) ?? 0) + 1);

    const radius = px(cs.borderTopLeftRadius);
    if (radius > 0 && radius < 200) radii.set(radius, (radii.get(radius) ?? 0) + 1);
    if (cs.boxShadow && cs.boxShadow !== "none") {
      shadows.set(cs.boxShadow, (shadows.get(cs.boxShadow) ?? 0) + 1);
    }
    const mw = cs.maxWidth.endsWith("px") ? Math.round(px(cs.maxWidth)) : 0;
    if (mw >= 600 && mw <= 1920) maxWidths.set(mw, (maxWidths.get(mw) ?? 0) + 1);
  }

  const textStyles: MeasuredTextStyle[] = [];
  for (const role of ["h1", "h2", "h3", "h4", "p"]) {
    const el = Array.from(document.querySelectorAll(role)).find((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && (e.textContent?.trim().length ?? 0) > 0;
    });
    if (!el) continue;
    try {
      const cs = getComputedStyle(el);
      const size = px(cs.fontSize);
      textStyles.push({
        role: role === "p" ? "body" : role,
        fontFamily: cs.fontFamily.split(",")[0]?.trim().replace(/^["']|["']$/g, "") ?? "",
        fontSizePx: size,
        fontWeight: parseInt(cs.fontWeight, 10) || 400,
        lineHeight: size > 0 ? Math.round((px(cs.lineHeight) / size) * 100) / 100 : 0,
        letterSpacingPx: cs.letterSpacing === "normal" ? 0 : px(cs.letterSpacing),
      });
    } catch {
      // skip unreadable style
    }
  }

  const sectionRoots =
    document.querySelector("main") ?? document.body;
  const candidates = [
    ...Array.from(document.querySelectorAll("body > header, main > header")),
    ...Array.from(sectionRoots.children),
    ...Array.from(document.querySelectorAll("body > footer, main ~ footer")),
  ];
  const seen = new Set<Element>();
  const sections: MeasuredSection[] = [];
  for (const el of candidates) {
    if (seen.has(el)) continue;
    seen.add(el);
    const rect = el.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    if (rect.height < 120 || rect.width < 200) continue;
    let bg: string | null = null;
    let padTop = 0;
    let padBottom = 0;
    try {
      const cs = getComputedStyle(el);
      bg = toHex(cs.backgroundColor);
      padTop = px(cs.paddingTop);
      padBottom = px(cs.paddingBottom);
    } catch {
      // defaults stand
    }
    const cls = (el.className && typeof el.className === "string"
      ? `.${el.className.split(/\s+/)[0]}`
      : ""
    ).slice(0, 30);
    sections.push({
      index: sections.length,
      label: `${el.tagName.toLowerCase()}${cls}`,
      topPx: Math.round(top),
      heightPx: Math.round(rect.height),
      paddingTopPx: padTop,
      paddingBottomPx: padBottom,
      backgroundHex: bg,
    });
    if (sections.length >= 12) break;
  }
  sections.sort((a, b) => a.topPx - b.topPx);
  sections.forEach((s, i) => (s.index = i));

  const sectionGapsPx: number[] = [];
  for (let i = 0; i < sections.length - 1; i++) {
    sectionGapsPx.push(
      Math.max(0, sections[i + 1].topPx - (sections[i].topPx + sections[i].heightPx)),
    );
  }

  const buttons: MeasuredButton[] = [];
  const btnEls = Array.from(
    document.querySelectorAll('button, [role="button"], a[class*="btn" i], a[class*="button" i]'),
  ).slice(0, 40);
  const btnSeen = new Set<string>();
  for (const el of btnEls) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 24) continue;
    try {
      const cs = getComputedStyle(el);
      const key = `${cs.backgroundColor}|${cs.borderRadius}|${cs.fontSize}`;
      if (btnSeen.has(key)) continue;
      btnSeen.add(key);
      buttons.push({
        backgroundHex: toHex(cs.backgroundColor),
        textHex: toHex(cs.color),
        borderRadiusPx: px(cs.borderTopLeftRadius),
        paddingPx: `${px(cs.paddingTop)} ${px(cs.paddingRight)}`,
        fontSizePx: px(cs.fontSize),
      });
      if (buttons.length >= 5) break;
    } catch {
      // skip
    }
  }

  // The mark, conservatively: header/nav → link to home → its image. No
  // match means no logo, never a guess.
  let logo: MeasuredLogo | null = null;
  try {
    const containers = Array.from(
      document.querySelectorAll('header, nav, [class*="header" i], [class*="navbar" i]'),
    ).slice(0, 4);
    for (const container of containers) {
      // The mark is the FIRST image inside the header, and it links back
      // into the site. Real headers rarely point the logo at exactly "/"
      // (vercel.com uses "/home"), but they do always put it first — and
      // an image that links OFF-SITE is a partner or a badge, never the
      // brand. Position + same-origin together keep this honest.
      const homeLinks = Array.from(container.querySelectorAll("a"))
        .filter((a) => {
          if (!a.querySelector("img") && !a.querySelector("svg")) return false;
          const href = a.getAttribute("href") ?? "";
          if (href.startsWith("#") || href.startsWith("mailto:")) return false;
          return a.href.startsWith(location.origin);
        })
        .slice(0, 2);

      for (const link of homeLinks) {
        // A logo is BIGGER than a UI icon. Measuring the rendered box is
        // what separates the brand from the store-locator pin sitting
        // next to it — guessing by markup alone picked the pin.
        const img = link.querySelector("img");
        const src = img?.currentSrc || img?.src;
        if (img && src && img.getBoundingClientRect().width >= 24) {
          logo = { url: src, kind: "img" };
          break;
        }
        const svg = link.querySelector("svg");
        if (svg) {
          // Size is NOT the discriminator: Vercel's mark is 21px wide, the
          // same as an icon. What separates them is what they are CALLED —
          // interface icons are labelled as such, brands are not.
          const box = svg.getBoundingClientRect();
          const naming = `${svg.getAttribute("class") ?? ""} ${svg.getAttribute("aria-label") ?? ""} ${link.getAttribute("aria-label") ?? ""}`;
          const looksLikeIcon =
            box.width < 12 ||
            /\b(icon|chevron|arrow|caret|menu|hamburger|search|cart|bag|close|pin|marker|account|user|globe)\b/i.test(
              naming,
            );
          const markup = svg.outerHTML;
          // Big inline SVGs are usually illustrations, not marks.
          if (!looksLikeIcon && markup.length > 0 && markup.length < 20000) {
            logo = {
              url: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(markup)))}`,
              kind: "svg",
            };
            break;
          }
        }
      }
      if (logo) break;
    }
  } catch {
    // No mark found — the prototype simply goes without one.
  }

  const palette: MeasuredColor[] = Array.from(colorCounts.entries())
    .map(([key, count]) => {
      const [role, hex] = key.split(":");
      return { hex, role: role as MeasuredColor["role"], count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const containerWidthPx =
    Array.from(maxWidths.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    logo,
    fonts: Array.from(fonts.entries())
      .map(([family, weights]) => ({
        family,
        weights: Array.from(weights).sort((a, b) => a - b),
      }))
      .slice(0, 6),
    textStyles,
    palette,
    containerWidthPx,
    sections,
    sectionGapsPx,
    borderRadiiPx: Array.from(radii.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([r]) => r),
    boxShadows: Array.from(shadows.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([s]) => s),
    buttons,
  };
}

/** Scroll through the page so lazy content mounts before measuring. */
async function settlePage(page: PlaywrightPage): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      let y = 0;
      const step = () => {
        y += window.innerHeight;
        window.scrollTo(0, y);
        if (y < document.body.scrollHeight && y < 12_000) {
          setTimeout(step, 120);
        } else {
          window.scrollTo(0, 0);
          setTimeout(() => resolve(), 250);
        }
      };
      step();
    });
  });
  // Freeze animations so slices are stable (motion is judged from CSS,
  // not from stills — nothing is lost by freezing).
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
  await page.waitForTimeout(300);
}

async function measureViewport(
  page: PlaywrightPage,
  viewport: "desktop" | "mobile",
): Promise<{ measurement: PageMeasurement; captures: SectionCapture[] }> {
  await settlePage(page);
  const measurement = await page.evaluate(collectPageMeasurement);

  const captures: SectionCapture[] = [];
  const toDataUrl = (buf: Buffer) => `data:image/jpeg;base64,${buf.toString("base64")}`;

  if (viewport === "desktop") {
    // Section slices — scroll to each section and shoot the VIEWPORT, i.e.
    // exactly what a visitor sees at that scroll position. Coordinate-clip
    // shots proved unreliable (lazy sections unmount off-screen and come
    // back blank); being in view forces content to mount first.
    for (const section of measurement.sections.slice(0, MAX_SECTION_CAPTURES)) {
      try {
        await page.evaluate((y: number) => window.scrollTo(0, y), section.topPx);
        await page.waitForTimeout(350);
        const buf = await page.screenshot({
          type: "jpeg",
          quality: CAPTURE_JPEG_QUALITY,
        });
        captures.push({
          viewport,
          sectionIndex: section.index,
          label: section.label,
          dataUrl: toDataUrl(buf),
        });
      } catch {
        // A failed slice is dropped; the judge works with the rest.
      }
    }
  } else {
    // Mobile: one full-page capture answers "how does it respond?" —
    // per-section slices would double vision cost for little judgment gain.
    try {
      const buf = await page.screenshot({
        type: "jpeg",
        quality: CAPTURE_JPEG_QUALITY,
        fullPage: true,
      });
      captures.push({
        viewport,
        sectionIndex: -1,
        label: "full-page",
        dataUrl: toDataUrl(buf),
      });
    } catch {
      // Mobile capture is an enhancement; measurements still ship.
    }
  }

  return { measurement, captures };
}

/**
 * Measure one reference page on desktop + mobile.
 *
 * Rejects on browser/navigation failure — the study catches and degrades
 * (Regla 0). Everything below navigation is absorb-and-continue.
 */
export async function measureReference(url: string): Promise<ReferenceMeasurements> {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  try {
    const results: Record<"desktop" | "mobile", { measurement: PageMeasurement; captures: SectionCapture[] }> =
      {} as never;

    for (const [name, size] of [
      ["desktop", DESKTOP],
      ["mobile", MOBILE],
    ] as const) {
      const context = await browser.newContext({
        viewport: size,
        userAgent:
          name === "mobile"
            ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
            : undefined,
        reducedMotion: "reduce",
      });
      try {
        // esbuild-based runners (tsx, vitest) decorate functions with a
        // `__name` helper that doesn't exist inside the page when Playwright
        // serializes our evaluate callbacks — define a no-op so measurement
        // works identically under any transpiler.
        await context.addInitScript("window.__name = window.__name || ((f) => f);");
        const page = await context.newPage();
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: NAV_TIMEOUT_MS });
        } catch {
          // Busy pages never reach networkidle — fall back to load.
          await page.goto(url, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
        }
        results[name] = await measureViewport(page, name);
      } finally {
        await context.close();
      }
    }

    return {
      url,
      measuredAt: new Date().toISOString(),
      desktop: results.desktop.measurement,
      mobile: results.mobile.measurement,
      captures: [...results.desktop.captures, ...results.mobile.captures],
    };
  } finally {
    await browser.close();
  }
}
