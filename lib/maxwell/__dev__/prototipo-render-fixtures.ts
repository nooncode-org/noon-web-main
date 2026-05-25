/**
 * lib/maxwell/__dev__/prototipo-render-fixtures.ts
 *
 * Canned fixtures for the prototipo signed-read GET endpoint. Used in two
 * places that must stay in sync:
 *
 *   1. `tests/visual/prototipo-decision.spec.ts` — Playwright a11y scan
 *      intercepts the upstream GET via `page.route()` and serves these.
 *   2. `app/api/integrations/website/prototype-signed-read/[token]/route.ts`
 *      — dev-only loopback handler so local visual smoke does not need the
 *      App backend (set `NOON_APP_BASE_URL=http://localhost:3000` and the
 *      Web dev server answers its own outbound GET).
 *
 * The `__dev__` directory marker keeps these clearly out of production code
 * paths. The loopback handler itself returns 404 in production NODE_ENV so
 * even if these fixtures end up in the prod bundle they cannot leak.
 */

import type { PrototipoRenderData } from "@/lib/maxwell/prototipo-render-types";

export type RenderFixtureKey =
  | "test-pending"
  | "test-accepted"
  | "test-rejected"
  | "test-superseded"
  | "test-notfound";

export const RENDER_FIXTURE_KEYS: readonly RenderFixtureKey[] = [
  "test-pending",
  "test-accepted",
  "test-rejected",
  "test-superseded",
  "test-notfound",
] as const;

const baseRenderData: PrototipoRenderData = {
  workspace: {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    version: 1,
    generatedAt: "2026-05-25T14:32:18.000Z",
  },
  leadContext: {
    businessName: "Acme Co",
    projectTypeLabel: "Landing Page",
  },
  prototype: {
    deployedUrl: "about:blank",
    generatedHtml: null,
  },
  decision: {
    status: "pending",
    notes: null,
    decidedAt: null,
  },
  lifecycle: { tokenSuperseded: false, iterationNumber: 1 },
  serverTime: "2026-05-25T16:45:02.123Z",
};

export type RenderFixtureResponse = {
  status: number;
  body: Record<string, unknown>;
};

/** Returns the wire-shaped 200 / 4xx / 5xx response for a fixture token. */
export function getRenderFixture(key: RenderFixtureKey): RenderFixtureResponse {
  if (key === "test-pending") {
    return {
      status: 200,
      body: { data: baseRenderData, requestId: "req-pending" },
    };
  }
  if (key === "test-accepted") {
    return {
      status: 200,
      body: {
        data: {
          ...baseRenderData,
          decision: {
            status: "accepted",
            notes: null,
            decidedAt: "2026-05-25T10:00:00.000Z",
          },
        },
        requestId: "req-accepted",
      },
    };
  }
  if (key === "test-rejected") {
    return {
      status: 200,
      body: {
        data: {
          ...baseRenderData,
          decision: {
            status: "rejected",
            notes: "Necesito que el header sea más grande.",
            decidedAt: "2026-05-25T10:00:00.000Z",
          },
        },
        requestId: "req-rejected",
      },
    };
  }
  if (key === "test-superseded") {
    return {
      status: 410,
      body: {
        error: "Superseded",
        code: "PROTOTYPE_READ_TOKEN_SUPERSEDED",
        requestId: "req-superseded",
      },
    };
  }
  // test-notfound
  return {
    status: 404,
    body: {
      error: "Not found",
      code: "PROTOTYPE_READ_TOKEN_NOT_FOUND",
      requestId: "req-notfound",
    },
  };
}

/** Type-safe check for unknown tokens before invoking `getRenderFixture`. */
export function isRenderFixtureKey(token: string): token is RenderFixtureKey {
  return (RENDER_FIXTURE_KEYS as readonly string[]).includes(token);
}
