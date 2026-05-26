/**
 * app/api/integrations/website/prototype-signed-read/[token]/route.ts
 *
 * **Dev-only loopback handler.** When the local dev server runs with
 * `NOON_APP_BASE_URL=http://localhost:3000`, the outbound GET inside
 * `fetchPrototipoRender` (the route's Pull B.2 fetch) hits this handler
 * instead of a real App backend. Useful for local visual smoke of the
 * `/maxwell/prototipo/[token]` route without needing App-side handlers
 * live or Playwright fixture interception.
 *
 * Production safety:
 *   - Returns 404 whenever `NODE_ENV === "production"` (the prod App
 *     deploy serves the real endpoint at its own host).
 *   - Token dispatch is limited to the small `RENDER_FIXTURE_KEYS` set;
 *     anything else returns 404.
 *   - No HMAC validation — fixtures are canned, no sensitive resolution
 *     happens. The signed-read contract assumes server-to-server only,
 *     so a missing-sig in dev does not weaken the prod posture.
 *
 * How to use locally:
 *   1. Set `MAXWELL_PROTOTIPO_DECISION_ROUTE=1` and
 *      `NOON_APP_BASE_URL=http://localhost:3000` + a value for
 *      `NOON_WEBSITE_WEBHOOK_SECRET` (any non-empty string is fine —
 *      this handler does not check it).
 *   2. `npm run dev`.
 *   3. Open `http://localhost:3000/en/maxwell/prototipo/test-pending`
 *      (or `test-accepted` / `test-rejected` / `test-superseded` /
 *      `test-notfound`).
 */

import { NextResponse } from "next/server";
import {
  getRenderFixture,
  isRenderFixtureKey,
} from "@/lib/maxwell/__dev__/prototipo-render-fixtures";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Context) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }
  const { token } = await params;
  if (!isRenderFixtureKey(token)) {
    return NextResponse.json(
      {
        error: "Unknown fixture token (dev handler only knows test-* tokens).",
        code: "PROTOTYPE_READ_TOKEN_NOT_FOUND",
        requestId: "req-dev-unknown",
      },
      { status: 404 },
    );
  }
  const fixture = getRenderFixture(token);
  return NextResponse.json(fixture.body, { status: fixture.status });
}
