/**
 * tests/maxwell/ownership.test.ts
 *
 * Cobertura completa de `viewerOwnsStudioSession` (lib/auth/ownership.ts).
 *
 * El helper es la única defensa entre un usuario autenticado y una sesión
 * de Maxwell ajena. Cualquier tolerancia inesperada (case, whitespace,
 * cadenas vacías) se traduce en bypass de ownership en `/api/maxwell/chat`,
 * `/api/maxwell/proposal`, `/api/maxwell/prototype/*`, etc.
 */

import { describe, expect, it } from "vitest";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";

describe("viewerOwnsStudioSession — match positivo", () => {
  it("acepta cuando los emails coinciden exactamente", () => {
    expect(
      viewerOwnsStudioSession(
        { email: "owner@noon.dev" },
        { ownerEmail: "owner@noon.dev" },
      ),
    ).toBe(true);
  });

  it("normaliza el case del owner (UPPER → lower)", () => {
    expect(
      viewerOwnsStudioSession(
        { email: "owner@noon.dev" },
        { ownerEmail: "OWNER@NOON.DEV" },
      ),
    ).toBe(true);
  });

  it("normaliza el case del viewer (UPPER → lower)", () => {
    expect(
      viewerOwnsStudioSession(
        { email: "OWNER@NOON.DEV" },
        { ownerEmail: "owner@noon.dev" },
      ),
    ).toBe(true);
  });

  it("normaliza case mixto en ambos lados", () => {
    expect(
      viewerOwnsStudioSession(
        { email: "OwNer@Noon.Dev" },
        { ownerEmail: "oWnEr@nOOn.dEv" },
      ),
    ).toBe(true);
  });
});

describe("viewerOwnsStudioSession — rechazo", () => {
  it("rechaza emails distintos", () => {
    expect(
      viewerOwnsStudioSession(
        { email: "intruder@noon.dev" },
        { ownerEmail: "owner@noon.dev" },
      ),
    ).toBe(false);
  });

  it("rechaza cuando la sesión no tiene owner (null)", () => {
    expect(
      viewerOwnsStudioSession(
        { email: "owner@noon.dev" },
        { ownerEmail: null },
      ),
    ).toBe(false);
  });

  it("rechaza cuando el viewer email coincide pero el owner es vacío", () => {
    // Un owner empty-string no debe matchear a nadie, ni siquiera a un viewer
    // con email empty-string. La función exige Boolean(ownerEmail) primero.
    expect(
      viewerOwnsStudioSession(
        { email: "" },
        { ownerEmail: "" },
      ),
    ).toBe(false);
  });

  it("NO normaliza espacios en blanco — exige match exacto tras lowercase", () => {
    // Si el flujo de creación deja whitespace, ownership no debe matchear.
    // Esto documenta el contrato actual: trim debe ocurrir AGUAS ARRIBA
    // (en getAuthenticatedViewer y en createStudioSession), no aquí.
    expect(
      viewerOwnsStudioSession(
        { email: "owner@noon.dev" },
        { ownerEmail: " owner@noon.dev " },
      ),
    ).toBe(false);
  });

  it("rechaza cuando el viewer tiene un email con whitespace que el owner no tiene", () => {
    expect(
      viewerOwnsStudioSession(
        { email: " owner@noon.dev" },
        { ownerEmail: "owner@noon.dev" },
      ),
    ).toBe(false);
  });

  it("rechaza emails con dominios diferentes pese a same local-part", () => {
    expect(
      viewerOwnsStudioSession(
        { email: "owner@noon.dev" },
        { ownerEmail: "owner@evil.dev" },
      ),
    ).toBe(false);
  });
});
