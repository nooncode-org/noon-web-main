/**
 * tests/visual/global-setup.ts
 *
 * Gives the browser tests a signed-in client with real data behind them.
 *
 * Until now nothing behind the sign-in had browser coverage at all: the studio,
 * the payment page and the whole client portal were reachable only by hand.
 * `studio-share-cta.spec.ts` says so in its own header and has been skipped
 * since the day it was written, because "no Playwright auth-bypass fixture
 * exists". This is that fixture.
 *
 * Two pieces, and neither is a special test-only code path in the app:
 *
 *   the session   `DEV_VIEWER_EMAIL` — the bypass the app already ships for
 *                 local development. It is inert in production twice over:
 *                 `getDevBypassEmail()` returns null when NODE_ENV is
 *                 "production", AND it only applies when no real auth provider
 *                 is configured. Nothing here widens that.
 *   the data      A throwaway Postgres (PGlite — Postgres compiled to
 *                 WebAssembly, nothing to install) started IN MEMORY and seeded
 *                 with the demo client the repo already ships.
 *
 * In memory and on port 5433 on purpose: a run must never touch the persisted
 * dev database on 5432, and must never leave a row behind. Every run starts
 * from the same empty schema, so a test can't pass because of what the last one
 * left lying around.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { execFile } from "node:child_process";
import { createConnection } from "node:net";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Away from 5432 so the owner's persisted dev database is never touched. */
export const TEST_DB_PORT = 5433;
export const TEST_DB_URL = `postgresql://dev:dev@127.0.0.1:${TEST_DB_PORT}/dev`;
/** Matches the email the repo's seed assigns to the demo client. */
export const TEST_VIEWER_EMAIL = "dev@noon.dev";

let dbProcess: ChildProcess | null = null;

function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = createConnection({ port, host: "127.0.0.1" });
      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`The test database never opened port ${port}.`));
          return;
        }
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

export default async function globalSetup() {
  dbProcess = spawn(
    process.execPath,
    ["scripts/dev-db-server.mjs", "--memory", "--port", String(TEST_DB_PORT)],
    { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env } },
  );

  // A database that dies on boot must fail the run loudly, not time out in a
  // test five minutes later with a confusing "cannot connect".
  let bootLog = "";
  dbProcess.stdout?.on("data", (chunk) => (bootLog += chunk));
  dbProcess.stderr?.on("data", (chunk) => (bootLog += chunk));
  dbProcess.once("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[test-db] exited with ${code}:\n${bootLog}`);
    }
  });

  // Migrations run in-process while the server boots, so this can take a while
  // on a cold machine.
  await waitForPort(TEST_DB_PORT, 120_000);

  // Seed through the repo's own CLI rather than a copy of its SQL: one seed,
  // one place, and it can't drift from what a developer gets locally.
  await execFileAsync(
    process.execPath,
    ["scripts/dev-db.mjs", "seed", "--force"],
    { env: { ...process.env, DATABASE_URL: TEST_DB_URL, DEV_VIEWER_EMAIL: TEST_VIEWER_EMAIL } },
  );
}

export async function globalTeardown() {
  dbProcess?.kill();
  dbProcess = null;
}
