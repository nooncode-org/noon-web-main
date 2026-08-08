/**
 * tests/visual/global-teardown.ts
 *
 * Stops the throwaway test database. Playwright wants teardown as its own
 * module, so this is a one-line re-export of the setup file's stop function —
 * the process handle lives there, next to the code that started it.
 */

import { globalTeardown } from "./global-setup";

export default globalTeardown;
