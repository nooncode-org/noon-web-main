/**
 * SEC-M7 (auditoría 2026-07) — badge honesto del workspace bajo outage de App.
 * La regla es pequeña pero es exactamente la que evita mostrarle al cliente un
 * "Active" congelado como si fuera el estado live del proyecto.
 */

import { describe, expect, it } from "vitest";
import {
  WORKSPACE_STATUS_UNAVAILABLE_META,
  resolveWorkspaceStatusSource,
} from "@/lib/maxwell/workspace-status";

describe("resolveWorkspaceStatusSource", () => {
  it("app pull OK → app (authoritative), regardless of mapping", () => {
    expect(resolveWorkspaceStatusSource({ linkedToApp: true, appPullOk: true })).toBe("app");
  });

  it("linked to an App project + pull failed → unavailable (NEVER the frozen local)", () => {
    expect(resolveWorkspaceStatusSource({ linkedToApp: true, appPullOk: false })).toBe(
      "unavailable",
    );
  });

  it("not linked to App (pre-handoff) → local is the only truth", () => {
    expect(resolveWorkspaceStatusSource({ linkedToApp: false, appPullOk: false })).toBe("local");
  });

  it("unavailable meta is neutral and does not claim a project state", () => {
    expect(WORKSPACE_STATUS_UNAVAILABLE_META.label).toBe("Status unavailable");
    expect(WORKSPACE_STATUS_UNAVAILABLE_META.description).not.toMatch(/active|development|review/i);
  });
});
