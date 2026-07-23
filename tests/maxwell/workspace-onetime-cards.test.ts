/**
 * tests/maxwell/workspace-onetime-cards.test.ts
 *
 * The one-time buyer's own surfaces. These are CLIENT components, so the page
 * test can't see their copy (it walks the server tree, where a client component
 * is an opaque element) — but they're still plain functions returning JSX, so
 * calling them directly gives real coverage of what the client actually reads.
 *
 * What's pinned here is business truth, not wording taste: a membership REPLACES
 * standalone hosting rather than being added to it, and the code is theirs.
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

// The cards' actions hand off to the chat; the bridge touches browser APIs.
vi.mock("@/components/maxwell/workspace-chat", () => ({ goToWorkspaceChat: vi.fn() }));

import {
  MembershipUpsellCard,
  WorkspaceCodePanel,
} from "@/components/maxwell/workspace-onetime-cards";

/** Flatten every string in a returned element tree. */
function textOf(node: unknown, acc: string[] = []): string {
  if (node == null || typeof node === "boolean") return acc.join(" ");
  if (typeof node === "string" || typeof node === "number") {
    acc.push(String(node));
    return acc.join(" ");
  }
  if (Array.isArray(node)) {
    for (const n of node) textOf(n, acc);
    return acc.join(" ");
  }
  const props = ((node as ReactElement).props ?? {}) as Record<string, unknown>;
  for (const value of Object.values(props)) textOf(value, acc);
  return acc.join(" ");
}

describe("MembershipUpsellCard", () => {
  const render = (over: Record<string, unknown> = {}) =>
    textOf(
      MembershipUpsellCard({
        delivered: true,
        monthlyAmountUsd: 104,
        currency: "USD",
        ...over,
      } as Parameters<typeof MembershipUpsellCard>[0]),
    );

  it("says the membership INCLUDES hosting, so it replaces it instead of stacking", () => {
    // Owner model 2026-07-23: taking a membership cancels the standalone
    // hosting. Without saying so, the client reads the monthly as a charge ON
    // TOP of what they already pay, and the step looks far pricier than it is.
    const text = render();
    expect(text).toContain("includes your hosting");
    expect(text).toContain("stop paying that separately");
  });

  it("shows the monthly it was given, and nothing when there is none", () => {
    expect(render()).toContain("$104");
    // No price known yet → the card still renders, just without a figure to
    // promise (never invent one).
    const noPrice = render({ monthlyAmountUsd: null });
    expect(noPrice).not.toContain("$");
    expect(noPrice).toContain("membership");
  });

  it("tells the truth about the project's state in the heading", () => {
    expect(render({ delivered: true })).toContain("delivered");
    expect(render({ delivered: false })).toContain("being built");
  });
});

describe("WorkspaceCodePanel", () => {
  it("offers both ways out and states the code is theirs to keep", () => {
    const text = textOf(WorkspaceCodePanel());
    expect(text).toContain("Repository");
    expect(text).toContain("Download");
    expect(text).toContain("yours to keep");
  });
});
