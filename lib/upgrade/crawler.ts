/**
 * lib/upgrade/crawler.ts
 * Server-side website crawler for the /upgrade module.
 *
 * Technical decisions (documented per spec addendum §3):
 *   - Discovery: sitemap.xml first, then BFS from homepage
 *   - Priority order: home → about → services → contact → pricing → landings → other
 *   - maxPages = 20, maxDepth = 2
 *   - pageTimeout = 10 000 ms, totalTimeout = 90 000 ms
 *   - maxContentPerPage = 100 KB of text
 *   - Dedup by normalized URL
 *   - Skip: external domains, media files, pagination patterns, fragments, mailto/tel
 *   - On total failure: return homepage only (best-effort)
 *   - 3 retries with exponential backoff per page (500ms, 1000ms, 2000ms)
 */

import type { PageType } from "./types";

// ---------------------------------------------------------------------------
// Guardrails (internal, not shown to user)
// ---------------------------------------------------------------------------

const MAX_PAGES = 20;
const MAX_DEPTH = 2;
const PAGE_TIMEOUT_MS = 10_000;
const TOTAL_TIMEOUT_MS = 90_000;
const MAX_CONTENT_BYTES = 100 * 1024; // 100 KB
const MAX_RETRIES = 3;

const MEDIA_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
  ".mp4", ".mp3", ".wav", ".ogg", ".pdf", ".zip", ".gz",
  ".woff", ".woff2", ".ttf", ".eot",
  ".js", ".css", ".map",
]);

const SKIP_PATTERNS = [
  /[?&](page|p|offset|start|from)=\d+/i,  // pagination
  /#/,                                      // fragments (handled separately)
  /\/(tag|category|author|archive|feed)\//i,
  /\/(wp-admin|wp-content|wp-includes)\//i,
  /\/(cdn-cgi|__next|_next|api)\//i,
];

// Priority order for page classification
const PAGE_TYPE_PATTERNS: { type: PageType; patterns: RegExp[] }[] = [
  { type: "home",     patterns: [/^\/?(index\.(html?|php|aspx?))?$/i] },
  { type: "about",    patterns: [/about/i, /who-we-are/i, /our-story/i, /team/i, /nosotros/i] },
  { type: "services", patterns: [/service/i, /solution/i, /what-we-do/i, /offerings?/i, /servicios/i] },
  { type: "contact",  patterns: [/contact/i, /get-in-touch/i, /reach-us/i, /contacto/i] },
  { type: "pricing",  patterns: [/pric/i, /plan/i, /cost/i, /rate/i, /precio/i] },
  { type: "landing",  patterns: [/landing/i, /lp\//i, /campaign/i] },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CrawledPage = {
  url: string;
  title: string | null;
  contentText: string;
  pageType: PageType;
  crawlOrder: number;
  crawlDepth: number;
};

export type CrawlResult =
  | { ok: true; pages: CrawledPage[] }
  | { ok: false; error: string; pages: CrawledPage[] }; // partial results on failure

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyPageType(url: string): PageType {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path === "/" || path === "") return "home";
    for (const { type, patterns } of PAGE_TYPE_PATTERNS) {
      if (patterns.some((p) => p.test(path))) return type;
    }
  } catch {
    // ignore
  }
  return "other";
}

function shouldSkipUrl(url: string, baseHost: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return true;
    if (parsed.hostname !== baseHost) return true;

    const ext = parsed.pathname.split(".").pop()?.toLowerCase();
    if (ext && MEDIA_EXTENSIONS.has(`.${ext}`)) return true;

    const fullUrl = url;
    if (SKIP_PATTERNS.some((p) => p.test(fullUrl))) return true;

    return false;
  } catch {
    return true;
  }
}

function stripFragment(url: string): string {
  return url.split("#")[0];
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NoonUpgradeBot/1.0; +https://nooncode.dev)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, PAGE_TIMEOUT_MS);
      if (!res.ok) return null;

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) return null;

      const html = await res.text();
      return html;
    } catch {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }
  return null;
}

function extractTextFromHtml(html: string): { title: string | null; text: string } {
  // Basic text extraction without a DOM parser (server-side, no browser)
  // Removes script, style, nav, footer, header tags and their content
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Extract title
  const titleMatch = cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/&[a-z]+;/gi, " ").trim() : null;

  // Strip all remaining tags
  const text = cleaned
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Truncate to max content size
  const truncated =
    text.length > MAX_CONTENT_BYTES ? text.slice(0, MAX_CONTENT_BYTES) : text;

  return { title, text: truncated };
}

function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href=["']([^"'#\s]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    try {
      const resolved = new URL(href, baseUrl).href;
      links.push(stripFragment(resolved));
    } catch {
      // invalid URL — skip
    }
  }

  return links;
}

async function fetchSitemapUrls(baseUrl: string, baseHost: string): Promise<string[]> {
  const sitemapUrl = `${baseUrl}/sitemap.xml`;
  try {
    const res = await fetchWithTimeout(sitemapUrl, PAGE_TIMEOUT_MS);
    if (!res.ok) return [];
    const xml = await res.text();
    const locRegex = /<loc>([\s\S]*?)<\/loc>/gi;
    const urls: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = locRegex.exec(xml)) !== null) {
      const u = m[1].trim();
      if (!shouldSkipUrl(u, baseHost)) {
        urls.push(stripFragment(u));
      }
    }
    return urls;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Priority sort
// ---------------------------------------------------------------------------

const TYPE_PRIORITY: Record<PageType, number> = {
  home: 0,
  about: 1,
  services: 2,
  contact: 3,
  pricing: 4,
  landing: 5,
  other: 6,
};

function sortByPriority(urls: string[]): string[] {
  return [...urls].sort((a, b) => {
    return TYPE_PRIORITY[classifyPageType(a)] - TYPE_PRIORITY[classifyPageType(b)];
  });
}

// ---------------------------------------------------------------------------
// Main crawler
// ---------------------------------------------------------------------------

export async function crawlWebsite(fullUrl: string): Promise<CrawlResult> {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const pages: CrawledPage[] = [];
  const visited = new Set<string>();
  let crawlOrder = 0;

  let baseHost: string;
  try {
    baseHost = new URL(fullUrl).hostname;
  } catch {
    return { ok: false, error: "Invalid URL.", pages };
  }

  // Seed queue: sitemap first, then BFS
  const sitemapUrls = await fetchSitemapUrls(fullUrl, baseHost);
  const seedUrls = sitemapUrls.length > 0 ? sitemapUrls : [fullUrl];
  const prioritized = sortByPriority([fullUrl, ...seedUrls]);

  // BFS queue: [url, depth]
  const queue: [string, number][] = prioritized.map((u) => [u, 0]);
  const queued = new Set<string>(prioritized);

  while (queue.length > 0 && pages.length < MAX_PAGES && Date.now() < deadline) {
    const item = queue.shift();
    if (!item) break;
    const [url, depth] = item;

    if (visited.has(url)) continue;
    visited.add(url);

    const html = await fetchWithRetry(url);
    if (!html) continue;

    const { title, text } = extractTextFromHtml(html);
    const pageType = classifyPageType(url);

    pages.push({
      url,
      title,
      contentText: text,
      pageType,
      crawlOrder: crawlOrder++,
      crawlDepth: depth,
    });

    // Discover links if we haven't reached max depth
    if (depth < MAX_DEPTH) {
      const links = extractLinksFromHtml(html, url);
      const newLinks = sortByPriority(
        links.filter((l) => !queued.has(l) && !shouldSkipUrl(l, baseHost))
      );
      for (const link of newLinks) {
        queued.add(link);
        queue.push([link, depth + 1]);
      }
    }
  }

  if (pages.length === 0) {
    return { ok: false, error: "Could not fetch any pages from the website.", pages };
  }

  return { ok: true, pages };
}
