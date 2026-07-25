/**
 * tests/maxwell/prototype-stage.test.ts
 *
 * The prototype trace's vocabulary. What's pinned here is the property that
 * makes the trace worth building: step status comes from the REAL stage, so a
 * step can only read "done" when the run has genuinely moved past it. The block
 * this replaced ticked its first step unconditionally (`index < 1`), which is
 * exactly the failure these tests exist to prevent coming back.
 */
import { describe, expect, it } from "vitest";
import {
  PROTOTYPE_STAGE_ORDER,
  isPrototypeStage,
  prototypeStageDetail,
  prototypeStageLabel,
  prototypeStepStatus,
  type PrototypeStage,
} from "@/lib/maxwell/prototype-stage";

describe("prototypeStepStatus", () => {
  it("marks earlier steps done, the current one active, later ones pending", () => {
    expect(prototypeStepStatus("generating", "publishing")).toBe("done");
    expect(prototypeStepStatus("assembling", "publishing")).toBe("done");
    expect(prototypeStepStatus("publishing", "publishing")).toBe("active");
    expect(prototypeStepStatus("ready", "publishing")).toBe("pending");
  });

  it("never reports a step done before the run has passed it", () => {
    // The bug this replaces: the old block hardcoded `complete = index < 1`, so
    // the first step showed a checkmark the moment the block mounted. At the
    // first stage NOTHING is finished yet.
    for (const step of PROTOTYPE_STAGE_ORDER) {
      expect(prototypeStepStatus(step, "generating")).not.toBe("done");
    }
    expect(prototypeStepStatus("generating", "generating")).toBe("active");
  });

  it("treats `ready` as terminal — it settles instead of spinning on itself", () => {
    // A spinner that never resolves on the final step reads as a hang.
    expect(prototypeStepStatus("ready", "ready")).toBe("done");
    for (const step of PROTOTYPE_STAGE_ORDER) {
      expect(prototypeStepStatus(step, "ready")).toBe("done");
    }
  });

  it("regresses honestly when v0 goes backwards", () => {
    // v0 can re-generate a version after we thought it had settled. There is no
    // high-water mark on purpose: a latched checkmark would claim work that came
    // undone.
    expect(prototypeStepStatus("publishing", "assembling")).toBe("pending");
  });
});

describe("stage vocabulary", () => {
  it("accepts only real stages off the wire", () => {
    for (const stage of PROTOTYPE_STAGE_ORDER) {
      expect(isPrototypeStage(stage)).toBe(true);
    }
    // The client must not trust the payload: anything else is rejected rather
    // than rendered as an unknown step.
    for (const bogus of ["pending", "completed", "", null, undefined, 3, {}]) {
      expect(isPrototypeStage(bogus)).toBe(false);
    }
  });

  it("gives every stage its own label and detail — no placeholder text", () => {
    const labels = new Set<string>();
    const details = new Set<string>();
    for (const stage of PROTOTYPE_STAGE_ORDER) {
      const label = prototypeStageLabel(stage);
      const detail = prototypeStageDetail(stage);
      expect(label.length).toBeGreaterThan(0);
      expect(detail.length).toBeGreaterThan(0);
      labels.add(label);
      details.add(detail);
    }
    expect(labels.size).toBe(PROTOTYPE_STAGE_ORDER.length);
    expect(details.size).toBe(PROTOTYPE_STAGE_ORDER.length);
  });

  it("never promises a time estimate", () => {
    // The reference UI showed "2 MIN REMAINING". v0's duration is not
    // predictable, so the trace reports elapsed time and never an ETA.
    for (const stage of PROTOTYPE_STAGE_ORDER) {
      const copy = `${prototypeStageLabel(stage)} ${prototypeStageDetail(stage)}`;
      expect(copy).not.toMatch(/remaining|estimat|\bmin\b|\bseconds?\b|\bminutes?\b/i);
    }
  });

  it("starts at generating and ends at ready", () => {
    // Order is load-bearing: prototypeStepStatus is positional against it.
    expect(PROTOTYPE_STAGE_ORDER[0]).toBe<PrototypeStage>("generating");
    expect(PROTOTYPE_STAGE_ORDER[PROTOTYPE_STAGE_ORDER.length - 1]).toBe<PrototypeStage>("ready");
  });
});
