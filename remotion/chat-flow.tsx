import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// ChatFlow — a Remotion composition of the Maxwell experience: a user types a
// request, sends it, and the result streams back (scope → build → review),
// ending in a human-review handoff. Frame-driven (no wall-clock), so it renders
// identically in @remotion/player (live, in-site) and via `remotion render`.

const C = {
  bg: "#0b0d12",
  panel: "#11151d",
  panelSoft: "#0e121a",
  border: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.05)",
  accent: "#6a78ff", // lifted brand for dark surface (site primary #1200c5 is too dark here)
  accentSoft: "rgba(106,120,255,0.14)",
  success: "#2cc49a",
  successSoft: "rgba(44,196,154,0.14)",
  text: "#e7eaf2",
  muted: "#8b93a7",
  faint: "#5d6479",
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "Cascadia Mono", monospace',
};

const PROMPT = "Build a returns dashboard with AI triage and Shopify sync.";
const STREAM = [
  "Scoping the returns flow with your 3PL",
  "Building the orders table + triage queue",
  "Wiring AI classification into Shopify",
];
const FINAL = "Draft ready — pending human review";

// frame → how many characters have been "typed"
function typed(text: string, frame: number, start: number, cps: number, fps: number) {
  if (frame < start) return "";
  return text.slice(0, Math.floor(((frame - start) / fps) * cps));
}

const SEND = 98; // frame the prompt is sent

function Caret({ show }: { show: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 2,
        height: "1em",
        marginLeft: 2,
        verticalAlign: "-2px",
        background: C.accent,
        opacity: show ? 1 : 0,
      }}
    />
  );
}

function StreamLine({ text, startFrame, index }: { text: string; startFrame: number; index: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - startFrame, fps, config: { damping: 18, mass: 0.6 } });
  const t = typed(text, frame, startFrame + 4, 34, fps);
  const done = t.length >= text.length;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [8, 0])}px)`,
        marginBottom: 14,
      }}
    >
      <span
        style={{
          flex: "0 0 22px",
          width: 22,
          height: 22,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: done ? C.successSoft : C.accentSoft,
          color: done ? C.success : C.accent,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {done ? "✓" : index + 1}
      </span>
      <span style={{ fontSize: 19, color: done ? C.muted : C.text, lineHeight: 1.3 }}>
        {t}
        {!done ? <Caret show={Math.floor(frame / 8) % 2 === 0} /> : null}
      </span>
    </div>
  );
}

export const ChatFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const blink = Math.floor(frame / 9) % 2 === 0;

  const typingPhase = frame < SEND;
  const inputText = typed(PROMPT, frame, 12, 24, fps);

  // user bubble springs in after send
  const bubble = spring({ frame: frame - SEND, fps, config: { damping: 16, mass: 0.7 } });

  // assistant "thinking" dots, then the stream
  const thinking = frame >= 104 && frame < 132;
  const L0 = 132;
  const L1 = 176;
  const L2 = 214;
  const FIN = 252;
  const finIn = spring({ frame: frame - FIN, fps, config: { damping: 15, mass: 0.7 } });

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: C.sans, padding: 56 }}>
      {/* faint grid wash */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${C.borderSoft} 1px, transparent 1px), linear-gradient(90deg, ${C.borderSoft} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          opacity: 0.5,
        }}
      />

      {/* app window */}
      <div
        style={{
          position: "relative",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 22px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <span style={{ width: 26, height: 26, borderRadius: 7, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14 }}>M</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Maxwell</span>
          <span style={{ fontFamily: C.mono, fontSize: 12, color: C.faint, marginLeft: 4 }}>scoping studio</span>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: C.mono, fontSize: 12, color: C.muted }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.success }} /> live
          </span>
        </div>

        {/* conversation */}
        <div style={{ flex: 1, padding: "26px 28px", display: "flex", flexDirection: "column", gap: 18, overflow: "hidden" }}>
          {/* user bubble (after send) */}
          {frame >= SEND ? (
            <div style={{ display: "flex", justifyContent: "flex-end", opacity: bubble, transform: `translateY(${interpolate(bubble, [0, 1], [10, 0])}px)` }}>
              <div style={{ maxWidth: "76%", background: C.accent, color: "#fff", fontSize: 20, lineHeight: 1.4, padding: "13px 17px", borderRadius: 14, borderBottomRightRadius: 4 }}>
                {PROMPT}
              </div>
            </div>
          ) : null}

          {/* assistant thinking */}
          {thinking ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center", paddingLeft: 2 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: C.muted,
                    opacity: 0.35 + 0.65 * (Math.floor(frame / 6) % 3 === i ? 1 : 0),
                  }}
                />
              ))}
            </div>
          ) : null}

          {/* assistant stream (no <Sequence> — these compute their own timing
             from global startFrame, and a Sequence would re-base useCurrentFrame). */}
          <div>
              {frame >= L0 ? <StreamLine text={STREAM[0]} startFrame={L0} index={0} /> : null}
              {frame >= L1 ? <StreamLine text={STREAM[1]} startFrame={L1} index={1} /> : null}
              {frame >= L2 ? <StreamLine text={STREAM[2]} startFrame={L2} index={2} /> : null}

              {/* final human-review handoff chip */}
              {frame >= FIN ? (
                <div
                  style={{
                    marginTop: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    background: C.successSoft,
                    border: `1px solid rgba(44,196,154,0.3)`,
                    color: C.success,
                    fontSize: 17,
                    fontWeight: 600,
                    padding: "10px 16px",
                    borderRadius: 12,
                    opacity: finIn,
                    transform: `translateY(${interpolate(finIn, [0, 1], [10, 0])}px) scale(${interpolate(finIn, [0, 1], [0.96, 1])})`,
                  }}
                >
                  <span style={{ fontSize: 18 }}>✓</span>
                  {FINAL}
                </div>
              ) : null}
          </div>
        </div>

        {/* input bar */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 22px", display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              flex: 1,
              minHeight: 30,
              display: "flex",
              alignItems: "center",
              fontSize: 19,
              color: typingPhase && inputText ? C.text : C.faint,
            }}
          >
            {typingPhase ? (
              <>
                {inputText || "Describe what you want to build…"}
                {inputText ? <Caret show={blink} /> : null}
              </>
            ) : (
              "Describe what you want to build…"
            )}
          </div>
          <span
            style={{
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: 10,
              background: typingPhase && inputText.length > 4 ? C.accent : "rgba(255,255,255,0.06)",
              color: typingPhase && inputText.length > 4 ? "#fff" : C.faint,
              fontSize: 18,
              transition: "none",
            }}
          >
            ↑
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
